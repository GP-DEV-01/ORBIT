'use client'

import { useEffect, useRef, useState } from 'react'
import { TimeRange } from '@/types'

const TIME_RANGES: { label: TimeRange; tv: string }[] = [
  { label: '1D', tv: '1' },
  { label: '1W', tv: '5' },
  { label: '1M', tv: '30' },
  { label: '3M', tv: 'D' },
  { label: '6M', tv: 'W' },
  { label: '1Y', tv: 'W' },
  { label: '5Y', tv: 'M' },
]

interface Props {
  symbol: string
  name: string
  yahooSymbol?: string
}

// Convert Yahoo Finance symbol → TradingView symbol
function toTVSymbol(symbol: string): string {
  const map: Record<string, string> = {
    '^GSPC': 'SP:SPX',
    '^IXIC': 'NASDAQ:COMP',
    '^DJI': 'DJ:DJI',
    '^RUT': 'RUSSELL:RUT',
    '^FTSE': 'SPREADEX:FTSE',
    '^GDAXI': 'XETR:DAX',
    '^FCHI': 'EURONEXT:PX1',
    '^N225': 'TVC:NI225',
    '^HSI': 'TVC:HSI',
    '^STOXX50E': 'EURONEXT:STOXX50E',
    '^VIX': 'CBOE:VIX',
    'BTC-USD': 'BINANCE:BTCUSDT',
    'ETH-USD': 'BINANCE:ETHUSDT',
    'GC=F': 'COMEX:GC1!',
    'CL=F': 'NYMEX:CL1!',
    'SI=F': 'COMEX:SI1!',
    'NG=F': 'NYMEX:NG1!',
    'ZW=F': 'CBOT:ZW1!',
    'ZC=F': 'CBOT:ZC1!',
    'EURUSD=X': 'FX:EURUSD',
    'USDJPY=X': 'FX:USDJPY',
    'GBPUSD=X': 'FX:GBPUSD',
    'EURGBP=X': 'FX:EURGBP',
    'EURJPY=X': 'FX:EURJPY',
    'DX-Y.NYB': 'TVC:DXY',
    'FTSEMIB.MI': 'EURONEXT:FTSEMIB',
  }
  if (map[symbol]) return map[symbol]
  // European equities — exchange suffix mapping
  if (symbol.endsWith('.MI')) return `MIL:${symbol.replace('.MI', '')}`
  if (symbol.endsWith('.PA')) return `EURONEXT:${symbol.replace('.PA', '')}`
  if (symbol.endsWith('.DE') || symbol.endsWith('.F')) return `XETR:${symbol.replace(/\.(DE|F)$/, '')}`
  if (symbol.endsWith('.L')) return `LSE:${symbol.replace('.L', '')}`
  if (symbol.endsWith('.SW')) return `SIX:${symbol.replace('.SW', '')}`
  if (symbol.endsWith('.AS')) return `EURONEXT:${symbol.replace('.AS', '')}`
  if (symbol.endsWith('.MC')) return `BME:${symbol.replace('.MC', '')}`
  if (symbol.endsWith('.BR')) return `EURONEXT:${symbol.replace('.BR', '')}`
  // Crypto
  if (symbol.endsWith('-USD') && !symbol.startsWith('^')) {
    return `BINANCE:${symbol.replace('-USD', 'USDT')}`
  }
  // Forex
  if (symbol.endsWith('=X')) return `FX:${symbol.replace('=X', '')}`
  return symbol
}

function getRangeStr(r: TimeRange): string {
  const map: Record<string, string> = {
    '1D': '1D', '1W': '5D', '1M': '1M',
    '3M': '3M', '6M': '6M', '1Y': '12M',
    '5Y': '60M',
  }
  return map[r] ?? '3M'
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TradingView: any
  }
}

export default function TradingChart({ symbol, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<unknown>(null)
  const [activeRange, setActiveRange] = useState<TimeRange>('3M')
  const [chartLoading, setChartLoading] = useState(true)
  const [priceInfo, setPriceInfo] = useState<{ price: number; change: number; pct: number } | null>(null)

  // Fetch price info separately
  useEffect(() => {
    fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => {
        if (d.c > 0) setPriceInfo({ price: d.c, change: d.d, pct: d.dp })
      })
      .catch(() => null)
  }, [symbol])

  // Build (or rebuild) the TradingView widget when symbol or range changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const containerId = `tv_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`
    container.id = containerId
    let cancelled = false
    let fallback: ReturnType<typeof setTimeout> | undefined

    function buildWidget() {
      if (cancelled || !window.TradingView || !containerRef.current) return
      containerRef.current.innerHTML = ''
      setChartLoading(true)
      const widget = new window.TradingView.widget({
        autosize: true,
        symbol: toTVSymbol(symbol),
        interval: TIME_RANGES.find(r => r.label === activeRange)?.tv ?? 'D',
        container_id: containerId,
        locale: 'en',
        theme: 'dark',
        style: '1',
        toolbar_bg: '#0f0f0f',
        backgroundColor: '#0f0f0f',
        gridColor: 'rgba(255,255,255,0.03)',
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        hide_volume: false,
        allow_symbol_change: true,
        withdateranges: true,
        range: getRangeStr(activeRange),
        timezone: 'Etc/UTC',
        studies: [],
      })
      widgetRef.current = widget
      // tv.js has no onChartReady option (that's the paid Charting Library): use widget.ready(),
      // with a fallback so the overlay can never hide the chart forever
      widget.ready?.(() => { if (!cancelled) setChartLoading(false) })
      fallback = setTimeout(() => { if (!cancelled) setChartLoading(false) }, 6000)
    }

    if (window.TradingView) {
      buildWidget()
    } else {
      let script = document.querySelector<HTMLScriptElement>('script[data-tradingview]')
      if (!script) {
        script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/tv.js'
        script.async = true
        script.dataset.tradingview = 'true'
        document.head.appendChild(script)
      }
      script.addEventListener('load', buildWidget)
    }

    return () => {
      cancelled = true
      clearTimeout(fallback)
      document.querySelector('script[data-tradingview]')?.removeEventListener('load', buildWidget)
      container.innerHTML = ''
      widgetRef.current = null
    }
  }, [symbol, activeRange])


  const up = priceInfo && priceInfo.change >= 0

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700' }}>{symbol}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </div>
          {priceInfo && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                {priceInfo.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{
                fontSize: '12px', fontWeight: '600',
                color: up ? 'var(--green)' : 'var(--red)',
                background: up ? 'var(--green-dim)' : 'var(--red-dim)',
                padding: '2px 7px', borderRadius: '4px',
              }}>
                {up ? '+' : ''}{priceInfo.change.toFixed(2)} ({up ? '+' : ''}{priceInfo.pct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-secondary)', borderRadius: '5px', padding: '3px' }}>
          {TIME_RANGES.map(({ label }) => (
            <button
              key={label}
              onClick={() => setActiveRange(label)}
              style={{
                padding: '3px 9px', borderRadius: '4px', border: 'none',
                fontSize: '11px', fontWeight: activeRange === label ? '700' : '400',
                cursor: 'pointer',
                background: activeRange === label ? 'var(--bg-card)' : 'transparent',
                color: activeRange === label ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.1s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView chart */}
      <div style={{ position: 'relative', height: '420px' }}>
        {chartLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f', color: '#444', fontSize: '12px', zIndex: 1 }}>
            Loading chart...
          </div>
        )}
        <div ref={containerRef} style={{ height: '420px', background: '#0f0f0f' }} />
      </div>
    </div>
  )
}
