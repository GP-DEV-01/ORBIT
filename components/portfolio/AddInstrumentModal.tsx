'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortfolioStore } from '@/lib/store'
import { useLang } from '@/lib/LanguageContext'
import { PAC_FREQUENCIES, pacQuery, validPlan, type PacResult } from '@/lib/pac'
import { PortfolioItem, PacFrequency } from '@/types'

interface SearchResult {
  symbol: string
  description: string
  type: string
  displaySymbol: string
  exchange: string
  source: string
  isin?: string
  price?: number
  currency?: string
}

interface NewListing { symbol: string; name: string; date: string; exchange: string; price: string | null; listed: boolean }

type Category = 'all' | 'stock' | 'etf' | 'fund' | 'crypto' | 'index' | 'forex' | 'commodity' | 'new'

const CATEGORIES: Category[] = ['all', 'stock', 'etf', 'fund', 'crypto', 'index', 'forex', 'commodity', 'new']

const TYPE_COLORS: Record<string, string> = {
  Stock: '#4488ff', ETF: '#a78bfa', Crypto: '#f59e0b',
  Index: '#22c55e', Forex: '#f43f5e', Fund: '#60a5fa', Commodity: '#fb923c',
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'GBp', 'CHF', 'JPY', 'CAD', 'AUD', 'HKD', 'SGD', 'NOK', 'SEK', 'DKK', 'PLN', 'CZK', 'HUF']

const REGION: Record<string, string> = { IT: 'IT', DE: 'DE', FR: 'FR', ES: 'ES', EN: 'US' }

const label = { display: 'block', marginBottom: '6px' } as const

function TypeBadge({ type }: { type: string }) {
  if (!type) return null
  return (
    <span style={{
      fontSize: '8px', padding: '1px 6px', borderRadius: '999px', fontWeight: '600',
      color: TYPE_COLORS[type] ?? 'var(--text-muted)', background: `${TYPE_COLORS[type] ?? '#888'}20`,
    }}>{type.toUpperCase()}</span>
  )
}

interface Props { onClose: () => void; userId: string }

export default function AddInstrumentModal({ onClose, userId }: Props) {
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [listings, setListings] = useState<NewListing[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [isin, setIsin] = useState('')
  const [isinLoading, setIsinLoading] = useState(false)
  // Single purchase
  const [mode, setMode] = useState<'single' | 'pac'>('single')
  const [quantity, setQuantity] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  // PAC
  const [pacAmount, setPacAmount] = useState('')
  const [pacFrequency, setPacFrequency] = useState<PacFrequency>('monthly')
  const [pacStart, setPacStart] = useState('')
  const [pacEnd, setPacEnd] = useState('')
  const [pacInitial, setPacInitial] = useState('')
  const [pacPreview, setPacPreview] = useState<PacResult | null>(null)
  const [pacLoading, setPacLoading] = useState(false)
  const [pacError, setPacError] = useState(false)
  const [showInstalments, setShowInstalments] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addItem = usePortfolioStore(s => s.addItem)
  const searchSeq = useRef(0)

  const fmt = (n: number, digits = 2) => n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString()

  // Debounced search; the sequence number drops responses that arrive out of order
  useEffect(() => {
    if (category === 'new') return
    if (!query.trim()) { setResults([]); setSearching(false); return }
    setSearching(true)
    const seq = ++searchSeq.current
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/market/search?q=${encodeURIComponent(query.trim())}&type=${category}&region=${REGION[lang] ?? 'US'}`)
        const d = await r.json()
        if (seq === searchSeq.current) setResults(d.results ?? [])
      } catch {
        if (seq === searchSeq.current) setResults([])
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, 350)
    return () => clearTimeout(id)
  }, [query, category, lang])

  useEffect(() => {
    if (category !== 'new' || listings) return
    fetch('/api/market/new-listings').then(r => r.json()).then(d => setListings(d.listings ?? []), () => setListings([]))
  }, [category, listings])

  // Live PAC preview: instalments due so far at historical closes
  useEffect(() => {
    if (!selected || mode !== 'pac') return
    const plan = {
      amount: parseFloat(pacAmount), frequency: pacFrequency, start: pacStart,
      end: pacEnd || null, initial: parseFloat(pacInitial) || 0,
    }
    if (!validPlan(plan)) { setPacPreview(null); setPacError(false); return }
    setPacLoading(true)
    let cancelled = false
    const id = setTimeout(async () => {
      try {
        const r = await fetch(pacQuery({ ...plan, symbol: selected.symbol }))
        if (!r.ok) throw new Error()
        const d = await r.json()
        if (!cancelled) { setPacPreview(d); setPacError(false) }
      } catch {
        if (!cancelled) { setPacPreview(null); setPacError(true) }
      } finally {
        if (!cancelled) setPacLoading(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(id) }
  }, [selected, mode, pacAmount, pacFrequency, pacStart, pacEnd, pacInitial])

  async function fetchIsin(symbol: string, prefilledIsin?: string) {
    if (prefilledIsin) { setIsin(prefilledIsin); return }
    setIsinLoading(true)
    try {
      const d = await (await fetch(`/api/market/isin?symbol=${encodeURIComponent(symbol)}`)).json()
      if (d.isin) setIsin(d.isin)
    } catch { /* optional field */ }
    setIsinLoading(false)
  }

  // Currency and current price come from the live quote, so the user doesn't have to guess them
  async function fetchQuote(symbol: string) {
    try {
      const d = await (await fetch(`/api/market/quotes-batch?symbols=${encodeURIComponent(symbol)}`)).json()
      const q = d.quotes?.[symbol]
      if (q?.cur) setCurrency(q.cur)
      if (q?.c) setCurrentPrice(q.c)
    } catch { /* keep defaults */ }
  }

  function selectInstrument(r: SearchResult) {
    setSelected(r)
    setName(r.description)
    setIsin('')
    setCurrentPrice(r.price ?? null)
    if (r.currency) setCurrency(r.currency)
    fetchIsin(r.symbol, r.isin)
    fetchQuote(r.symbol)
  }

  function selectListing(l: NewListing) {
    selectInstrument({ symbol: l.symbol, description: l.name, type: 'Stock', displaySymbol: l.symbol, exchange: l.exchange, source: 'Finnhub IPO' })
  }

  async function handleAdd() {
    if (!selected || !userId) return
    setLoading(true)
    setError(null)

    const base = {
      user_id: userId,
      symbol: selected.symbol,
      name: name || selected.description,
      type: selected.type?.toLowerCase() || 'stock',
      currency,
      ...(isin ? { isin } : {}),
    }
    const insertData = mode === 'pac' && pacPreview
      ? {
        ...base,
        quantity: pacPreview.quantity,
        avg_price: pacPreview.avgPrice,
        is_pac: true,
        pac_amount: parseFloat(pacAmount),
        pac_frequency: pacFrequency,
        pac_start: pacStart,
        pac_end: pacEnd || null,
        pac_initial: parseFloat(pacInitial) || 0,
      }
      : { ...base, quantity: parseFloat(quantity) || 0, avg_price: parseFloat(avgPrice) || 0 }

    let { data, error: err } = await supabase.from('portfolios').insert(insertData).select().single()

    // Older databases without the currency column: retry without it (a PAC needs the migration anyway)
    if (err && mode === 'single' && err.message?.includes('currency')) {
      const { currency: _, ...withoutCurrency } = insertData
      const retry = await supabase.from('portfolios').insert(withoutCurrency).select().single()
      data = retry.data
      err = retry.error
    }

    if (!err && data) { addItem(data as PortfolioItem); onClose() }
    else if (err) setError(mode === 'pac' && /pac_|is_pac/.test(err.message ?? '') ? t('pac_setupNeeded') : err.message || t('exportFailed'))
    setLoading(false)
  }

  const canSubmit = mode === 'single'
    ? !!quantity && !!avgPrice
    : !!pacPreview && !pacLoading

  const chip = (active: boolean) => ({
    padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const,
    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    background: active ? 'var(--green-dim)' : 'transparent',
    color: active ? 'var(--green)' : 'var(--text-secondary)',
  })

  const rowStyle = (last: boolean) => ({
    padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderBottom: last ? 'none' : '1px solid var(--border)', transition: 'background 0.1s',
  })
  const hover = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'transparent' },
  }
  const listBox = {
    marginTop: '10px', border: '1px solid var(--border-hover)', borderRadius: '16px',
    maxHeight: '360px', overflowY: 'auto' as const, background: 'var(--bg-elevated)',
  }
  const hint = { padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }

  const currencyPrefixInput = (value: string, onChange: (v: string) => void, placeholder: string, withSelect = true) => (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      {withSelect ? (
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRight: 'none',
            borderRadius: '12px 0 0 12px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600',
            padding: '0 8px', cursor: 'pointer', outline: 'none', flexShrink: 0, letterSpacing: '0.02em',
          }}
        >
          {[...new Set([currency, ...CURRENCIES])].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <span style={{
          display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRight: 'none', borderRadius: '12px 0 0 12px', color: 'var(--text-secondary)', fontSize: '11px',
          fontWeight: '600', padding: '0 10px',
        }}>{currency}</span>
      )}
      <div style={{ width: '1px', background: 'var(--border)', flexShrink: 0 }} />
      <input
        className="input-dark" type="number" placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} step="any" min="0"
        style={{ borderRadius: '0 12px 12px 0', borderLeft: 'none' }}
      />
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '24px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card animate-fadeIn" style={{ width: '100%', maxWidth: '540px', padding: '28px', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('addInstrument')}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {!selected ? (
          /* STEP 1: Search */
          <div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '4px' }}>
              {CATEGORIES.map(c => (
                <button key={c} style={chip(category === c)} onClick={() => setCategory(c)}>
                  {c === 'new' ? `✦ ${t('ins_new')}` : t(`ins_${c}`)}
                </button>
              ))}
            </div>

            {category !== 'new' && (
              <>
                <label className="section-label" style={{ display: 'block', marginBottom: '8px' }}>{t('searchSymbol')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input-dark"
                    placeholder={t('searchPlaceholder')}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                    style={{ paddingLeft: '36px' }}
                  />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '15px', pointerEvents: 'none' }}>⌕</span>
                </div>

                {query.trim() && (
                  <div style={listBox}>
                    {searching && results.length === 0 && <div style={hint}>{t('searching')}</div>}
                    {!searching && results.length === 0 && <div style={hint}>{t('noResults')}</div>}
                    {results.map((r, i) => (
                      <div key={`${r.symbol}-${i}`} onClick={() => selectInstrument(r)} style={rowStyle(i === results.length - 1)} {...hover}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', fontSize: '13px' }}>{r.displaySymbol || r.symbol}</span>
                            <TypeBadge type={r.type} />
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.description}
                          </div>
                          {r.isin && <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>ISIN: {r.isin}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                          {r.price != null && (
                            <div style={{ fontSize: '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                              {fmt(r.price)}{r.currency ? ` ${r.currency}` : ''}
                            </div>
                          )}
                          {r.exchange && <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{r.exchange}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {category === 'new' && (
              <>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('new_note')}</p>
                <div style={listBox}>
                  {listings === null && <div style={hint}>{t('searching')}</div>}
                  {listings?.length === 0 && <div style={hint}>{t('noResults')}</div>}
                  {listings?.map((l, i) => (
                    <div
                      key={`${l.symbol}-${l.date}`}
                      onClick={() => l.listed && selectListing(l)}
                      style={{ ...rowStyle(i === listings.length - 1), cursor: l.listed ? 'pointer' : 'default', opacity: l.listed ? 1 : 0.6 }}
                      {...(l.listed ? hover : {})}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px' }}>{l.symbol}</span>
                          <span style={{
                            fontSize: '8px', padding: '1px 6px', borderRadius: '999px', fontWeight: 600,
                            color: l.listed ? 'var(--green)' : 'var(--text-muted)', border: `1px solid ${l.listed ? 'var(--green)' : 'var(--border)'}`,
                          }}>{t(l.listed ? 'new_listed' : 'new_upcoming')}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600 }}>{fmtDate(l.date)}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{l.exchange}{l.price ? ` · $${l.price}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          /* STEP 2: Fill in details */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Selected instrument chip */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 14px', background: 'var(--bg-elevated)',
              borderRadius: '14px', border: '1px solid var(--border)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ fontWeight: '800', fontSize: '15px' }}>{selected.symbol}</span>
                  <TypeBadge type={selected.type} />
                  {selected.exchange && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{selected.exchange}</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selected.description}</div>
                {currentPrice != null && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('currentPrice')}: {fmt(currentPrice)} {currency}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setSelected(null); setPacPreview(null) }}
                style={{ background: 'var(--bg-card)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }}
              >
                {t('change')}
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="section-label" style={label}>{t('name')}</label>
              <input className="input-dark" value={name} onChange={e => setName(e.target.value)} placeholder={selected.description} />
            </div>

            {/* Single purchase vs PAC */}
            <div>
              <label className="section-label" style={label}>{t('buyMode')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)' }}>
                {(['single', 'pac'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: '8px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    background: mode === m ? 'var(--green)' : 'transparent', color: mode === m ? '#000' : 'var(--text-secondary)',
                  }}>{t(m === 'single' ? 'buySingle' : 'buyPac')}</button>
                ))}
              </div>
            </div>

            {mode === 'single' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="section-label" style={label}>{t('quantity')}</label>
                  <input className="input-dark" type="number" placeholder="10" value={quantity}
                    onChange={e => setQuantity(e.target.value)} step="any" min="0" />
                </div>
                <div>
                  <label className="section-label" style={label}>{t('avgPrice')}</label>
                  {currencyPrefixInput(avgPrice, setAvgPrice, currentPrice != null ? currentPrice.toFixed(2) : '150.00')}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="section-label" style={label}>{t('pac_amount')}</label>
                    {currencyPrefixInput(pacAmount, setPacAmount, '200')}
                  </div>
                  <div>
                    <label className="section-label" style={label}>{t('pac_frequency')}</label>
                    <select className="input-dark" value={pacFrequency} onChange={e => setPacFrequency(e.target.value as PacFrequency)}>
                      {PAC_FREQUENCIES.map(f => <option key={f} value={f}>{t(`freq_${f}`)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="section-label" style={label}>{t('pac_start')}</label>
                    <input className="input-dark" type="date" value={pacStart} onChange={e => setPacStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="section-label" style={label}>
                      {t('pac_end')}
                      <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>({t('optional')})</span>
                    </label>
                    <input className="input-dark" type="date" value={pacEnd} min={pacStart || undefined} onChange={e => setPacEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="section-label" style={label}>
                    {t('pac_initial')}
                    <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>({t('pac_initialHint')})</span>
                  </label>
                  {currencyPrefixInput(pacInitial, setPacInitial, '0', false)}
                </div>

                {/* Preview */}
                {(pacLoading || pacPreview || pacError) && (
                  <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    {pacLoading && !pacPreview && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('pac_calculating')}</div>}
                    {pacError && <div style={{ fontSize: '11px', color: 'var(--red)' }}>{t('pac_noData')}</div>}
                    {pacPreview && (
                      <div style={{ opacity: pacLoading ? 0.5 : 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {pacPreview.count === 0 && pacPreview.next && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('pac_notStarted').replace('{date}', fmtDate(pacPreview.next))}</div>
                        )}
                        {pacPreview.count > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {[
                              [t('pac_instalments'), String(pacPreview.count)],
                              [t('pac_invested'), `${fmt(pacPreview.invested)} ${currency}`],
                              [t('pac_units'), fmt(pacPreview.quantity, 4)],
                              [t('pac_avgPrice'), fmt(pacPreview.avgPrice)],
                            ].map(([k, v]) => (
                              <div key={k}>
                                <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</div>
                                <div style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {currentPrice != null && pacPreview.quantity > 0 && (() => {
                          const value = pacPreview.quantity * currentPrice
                          const pnl = value - pacPreview.invested
                          return (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {t('value')}: <b>{fmt(value)} {currency}</b>{' · '}
                              <span style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                {pnl >= 0 ? '+' : '−'}{fmt(Math.abs(pnl))} ({pacPreview.invested ? `${pnl >= 0 ? '+' : '−'}${fmt(Math.abs(pnl / pacPreview.invested * 100))}%` : '—'})
                              </span>
                            </div>
                          )
                        })()}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {pacPreview.next && pacPreview.count > 0 && <>{t('pac_next')}: {fmtDate(pacPreview.next)}</>}
                          {pacPreview.pending > 0 && <> · {t('pac_pending').replace('{n}', String(pacPreview.pending))}</>}
                        </div>
                        {pacPreview.instalments.length > 0 && (
                          <>
                            <button onClick={() => setShowInstalments(s => !s)} style={{
                              alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
                              color: 'var(--green)', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                            }}>{t(showInstalments ? 'pac_hideInstalments' : 'pac_showInstalments')}</button>
                            {showInstalments && (
                              <div style={{ maxHeight: '160px', overflowY: 'auto', fontSize: '10px', fontVariantNumeric: 'tabular-nums' }}>
                                {[...pacPreview.instalments].reverse().map(x => (
                                  <div key={x.date} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', padding: '3px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                                    <span>{fmtDate(x.execDate)}</span>
                                    <span style={{ textAlign: 'right' }}>{fmt(x.amount)}</span>
                                    <span style={{ textAlign: 'right' }}>@ {fmt(x.price)}</span>
                                    <span style={{ textAlign: 'right' }}>{fmt(x.units, 4)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('pac_autoNote')}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ISIN */}
            <div>
              <label className="section-label" style={label}>
                {t('isin')}
                <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>({t('optional')})</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-dark"
                  value={isin}
                  onChange={e => setIsin(e.target.value.toUpperCase())}
                  placeholder="US0378331005"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em', paddingRight: isinLoading ? '80px' : '16px' }}
                />
                {isinLoading && (
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-muted)' }}>
                    {t('fetching')}
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--red-dim)', color: 'var(--red)', fontSize: '11px' }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={handleAdd}
              disabled={loading || !canSubmit}
              style={{ width: '100%', marginTop: '4px', padding: '12px', fontSize: '14px' }}
            >
              {loading ? t('adding') : t(mode === 'pac' ? 'pac_add' : 'addToPortfolio')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
