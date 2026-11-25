'use client'

import { usePortfolioStore } from '@/lib/store'
import { useLiveQuotes } from '@/lib/liveQuotes'
import LiveStatus from './LiveStatus'

const INDICES = [
  { symbol: '^GSPC',     label: 'S&P 500',    flag: '🇺🇸' },
  { symbol: '^IXIC',     label: 'NASDAQ',      flag: '🇺🇸' },
  { symbol: '^DJI',      label: 'DOW JONES',   flag: '🇺🇸' },
  { symbol: '^RUT',      label: 'RUSSELL 2K',  flag: '🇺🇸' },
  { symbol: '^FTSE',     label: 'FTSE 100',    flag: '🇬🇧' },
  { symbol: '^GDAXI',    label: 'DAX',         flag: '🇩🇪' },
  { symbol: '^FCHI',     label: 'CAC 40',      flag: '🇫🇷' },
  { symbol: 'FTSEMIB.MI',label: 'FTSE MIB',    flag: '🇮🇹' },
  { symbol: '^N225',     label: 'NIKKEI 225',  flag: '🇯🇵' },
  { symbol: '^HSI',      label: 'HANG SENG',   flag: '🇭🇰' },
  { symbol: 'BTC-USD',   label: 'BITCOIN',     flag: '₿' },
  { symbol: 'ETH-USD',   label: 'ETHEREUM',    flag: 'Ξ' },
  { symbol: 'GC=F',      label: 'GOLD',        flag: '◈' },
  { symbol: 'CL=F',      label: 'OIL WTI',     flag: '◈' },
  { symbol: 'EURUSD=X',  label: 'EUR/USD',     flag: '💱' },
  { symbol: 'DX-Y.NYB',  label: 'USD INDEX',   flag: '💱' },
]

const INDEX_SYMBOLS = INDICES.map(i => i.symbol)

interface TickerItem {
  symbol: string
  label: string
  flag: string
  price: number
  changePct: number
}

export default function MarketTicker() {
  const quotes = usePortfolioStore(s => s.quotes)
  useLiveQuotes(INDEX_SYMBOLS)

  const tickers = INDICES.reduce<TickerItem[]>((acc, { symbol, label, flag }) => {
    const q = quotes[symbol]
    if (q && q.price > 0) acc.push({ symbol, label, flag, price: q.price, changePct: q.changePercent ?? 0 })
    return acc
  }, [])

  if (tickers.length === 0) {
    return <div style={{ height: '36px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }} />
  }

  const items = [...tickers, ...tickers]

  return (
    <div style={{
      height: '36px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Left fade */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40px', background: 'linear-gradient(to right, var(--bg-secondary), transparent)', zIndex: 2, pointerEvents: 'none' }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        animation: `scrollTicker ${tickers.length * 4}s linear infinite`,
        willChange: 'transform',
      }}>
        {items.map((t, i) => {
          const up = t.changePct >= 0
          return (
            <div key={`${t.symbol}-${i}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '0 18px', borderRight: '1px solid var(--border)',
              height: '100%', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: '11px' }}>{t.flag}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.04em' }}>
                {t.label}
              </span>
              <span style={{ fontSize: '11px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: '#fff' }}>
                {t.price < 1
                  ? t.price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                  : t.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: '600',
                color: up ? 'var(--green)' : 'var(--red)',
                background: up ? 'var(--green-dim)' : 'var(--red-dim)',
                padding: '1px 5px', borderRadius: '3px',
              }}>
                {up ? '▲' : '▼'} {Math.abs(t.changePct).toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Right: LIVE badge */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '120px', zIndex: 2,
        background: 'linear-gradient(to left, var(--bg-secondary) 50%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '12px',
      }}>
        <LiveStatus />
      </div>
    </div>
  )
}
