'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LanguageContext'
import InstrumentDetail from '@/components/instruments/InstrumentDetail'
import FlashPrice from '@/components/ui/FlashPrice'
import { usePortfolioStore } from '@/lib/store'
import { useLiveQuotes } from '@/lib/liveQuotes'

interface WatchlistItem { id: string; symbol: string; name: string; type: string }
interface SearchResult { symbol: string; description: string; type: string; displaySymbol: string; exchange: string; source: string }

const POPULAR: WatchlistItem[] = [
  { id: 'AAPL',    symbol: 'AAPL',    name: 'Apple Inc.',       type: 'Stock' },
  { id: 'MSFT',    symbol: 'MSFT',    name: 'Microsoft Corp.',  type: 'Stock' },
  { id: 'NVDA',    symbol: 'NVDA',    name: 'NVIDIA Corp.',     type: 'Stock' },
  { id: 'GOOGL',   symbol: 'GOOGL',   name: 'Alphabet Inc.',    type: 'Stock' },
  { id: 'AMZN',    symbol: 'AMZN',    name: 'Amazon.com',       type: 'Stock' },
  { id: 'META',    symbol: 'META',    name: 'Meta Platforms',   type: 'Stock' },
  { id: 'TSLA',    symbol: 'TSLA',    name: 'Tesla Inc.',       type: 'Stock' },
  { id: 'SPY',     symbol: 'SPY',     name: 'S&P 500 ETF',      type: 'ETF'   },
  { id: 'QQQ',     symbol: 'QQQ',     name: 'NASDAQ 100 ETF',   type: 'ETF'   },
  { id: 'VTI',     symbol: 'VTI',     name: 'Vanguard Total Mkt ETF', type: 'ETF' },
  { id: 'BTC-USD', symbol: 'BTC-USD', name: 'Bitcoin',          type: 'Crypto'},
  { id: 'ETH-USD', symbol: 'ETH-USD', name: 'Ethereum',         type: 'Crypto'},
  { id: '^GSPC',   symbol: '^GSPC',   name: 'S&P 500 Index',    type: 'Index' },
  { id: 'GC=F',    symbol: 'GC=F',    name: 'Gold Futures',     type: 'Commodity' },
]

const TYPE_COLORS: Record<string, string> = {
  Stock: '#4488ff', ETF: '#a78bfa', Crypto: '#f59e0b',
  Index: '#22c55e', Forex: '#f43f5e', Fund: '#60a5fa', Commodity: '#fb923c',
}

export default function WatchlistPage() {
  const { userId, ready } = useAuth()
  const { t } = useLang()
  const searchParams = useSearchParams()
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const quotes = usePortfolioStore(s => s.quotes)
  const [selected, setSelected] = useState<WatchlistItem | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'watchlist' | 'popular'>('watchlist')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Load watchlist
  useEffect(() => {
    if (!ready || !userId) return
    supabase.from('watchlists').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setWatchlist((data || []) as WatchlistItem[]); setLoading(false) })
  }, [ready, userId])

  // Auto-select instrument from URL param (e.g. ?symbol=AAPL from global search)
  useEffect(() => {
    const sym = searchParams.get('symbol')
    if (!sym) return
    // Check watchlist first
    const found = watchlist.find(w => w.symbol === sym)
    if (found) { setSelected(found); return }
    // Check popular list
    const popular = POPULAR.find(p => p.symbol === sym)
    if (popular) { setSelected(popular); setActiveTab('popular'); return }
    // Otherwise create a temporary item
    setSelected({ id: sym, symbol: sym, name: sym, type: 'Stock' })
  }, [searchParams, watchlist])

  useLiveQuotes([...watchlist.map(w => w.symbol), ...POPULAR.map(p => p.symbol)])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const r = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`)
      const d = await r.json()
      setResults(d.results || [])
      setSearching(false)
    }, 350)
  }, [query])

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function addToWatchlist(item: SearchResult) {
    if (!userId || watchlist.some(w => w.symbol === item.symbol)) return
    const { data } = await supabase.from('watchlists').insert({
      user_id: userId, symbol: item.symbol, name: item.description, type: item.type,
    }).select().single()
    if (data) { setWatchlist(prev => [data as WatchlistItem, ...prev]); setSelected(data as WatchlistItem) }
    setQuery(''); setResults([])
  }

  async function removeFromWatchlist(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('watchlists').delete().eq('id', id)
    setWatchlist(prev => prev.filter(w => w.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const displayList = activeTab === 'watchlist' ? watchlist : POPULAR

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '13px' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 96px)', minHeight: 0 }}>
      {/* LEFT panel */}
      <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>

        {/* Search */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <input
            className="input-dark"
            placeholder="Search any instrument..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ paddingLeft: '34px' }}
          />
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', pointerEvents: 'none' }}>⌕</span>

          {(searching || results.length > 0) && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
              background: 'var(--bg-card)', border: '1px solid var(--border-hover)',
              borderRadius: '16px', overflow: 'hidden', maxHeight: '380px', overflowY: 'auto',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}>
              {searching && (
                <div style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Searching Yahoo Finance · Finnhub · Morningstar...
                </div>
              )}
              {results.map((r, i) => (
                <div
                  key={`${r.symbol}-${i}`}
                  onClick={() => addToWatchlist(r)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px' }}>{r.displaySymbol || r.symbol}</span>
                      <span style={{
                        fontSize: '8px', padding: '1px 5px', borderRadius: '999px',
                        color: TYPE_COLORS[r.type] ?? 'var(--text-muted)',
                        background: `${TYPE_COLORS[r.type] ?? '#888'}18`,
                        fontWeight: '600',
                      }}>{r.type?.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                    {r.exchange && <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{r.exchange}</div>}
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5 }}>{r.source}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '999px', padding: '3px', border: '1px solid var(--border)' }}>
          {(['watchlist', 'popular'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '6px 8px', borderRadius: '999px', border: 'none',
              background: activeTab === tab ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '11px', fontWeight: activeTab === tab ? '600' : '400',
              cursor: 'pointer', transition: 'all 0.12s',
            }}>
              {tab === 'watchlist' ? `${t('myList')} (${watchlist.length})` : t('popular')}
            </button>
          ))}
        </div>

        {/* Items list */}
        <div className="card" style={{ flex: 1, padding: '6px', overflowY: 'auto', minHeight: 0 }}>
          {loading && activeTab === 'watchlist' ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading...</div>
          ) : displayList.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              {activeTab === 'watchlist' ? 'Search and add instruments above' : 'No items'}
            </div>
          ) : displayList.map(item => {
            const q = quotes[item.symbol]
            const isActive = selected?.symbol === item.symbol
            const up = q && q.changePercent >= 0
            const isWatched = watchlist.some(w => w.symbol === item.symbol)

            return (
              <div
                key={item.symbol}
                onClick={() => setSelected(isActive ? null : item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 10px', cursor: 'pointer', borderRadius: '12px', marginBottom: '2px',
                  background: isActive ? 'var(--bg-elevated)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? 'var(--green)' : 'transparent'}`,
                  transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontWeight: '700', fontSize: '12px' }}>{item.symbol}</span>
                    <span style={{
                      fontSize: '8px', padding: '1px 4px', borderRadius: '999px',
                      color: TYPE_COLORS[item.type] ?? 'var(--text-muted)',
                      background: `${TYPE_COLORS[item.type] ?? '#888'}15`,
                      fontWeight: '600',
                    }}>{item.type?.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {q ? (
                    <>
                      <div style={{ fontSize: '12px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                        <FlashPrice value={q.price}>{q.price < 1 ? q.price.toFixed(4) : q.price.toFixed(2)}</FlashPrice>
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: up ? 'var(--green)' : 'var(--red)' }}>
                        {up ? '▲' : '▼'}{Math.abs(q.changePercent).toFixed(2)}%
                      </div>
                    </>
                  ) : <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>···</div>}
                </div>
                {isWatched && activeTab === 'watchlist' && (
                  <button
                    onClick={e => removeFromWatchlist(item.id, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '1px 3px', lineHeight: 1, flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                  >×</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT panel */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {selected ? (
          <InstrumentDetail symbol={selected.symbol} name={selected.name} type={selected.type} />
        ) : (
          <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
            <div style={{ fontSize: '36px', opacity: 0.1 }}>◈</div>
            <p style={{ fontSize: '13px' }}>Select an instrument to view details</p>
            <p style={{ fontSize: '11px', opacity: 0.5 }}>Chart · Financials · Events · Similar · Derivatives</p>
          </div>
        )}
      </div>
    </div>
  )
}
