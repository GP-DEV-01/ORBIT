'use client'

import { useEffect, useRef, useState } from 'react'
import { usePortfolioStore } from '@/lib/store'

const INDICES = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'NASDAQ' },
  { symbol: 'DIA', label: 'DOW' },
  { symbol: 'BTC-USD', label: 'BTC' },
  { symbol: 'ETH-USD', label: 'ETH' },
]

interface TickerItem {
  label: string
  price: number
  change: number
  changePercent: number
}

export default function LiveTicker() {
  const [tickers, setTickers] = useState<TickerItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    async function fetchTickers() {
      const results = await Promise.allSettled(
        INDICES.map(async ({ symbol, label }) => {
          const res = await fetch(`/api/market/quote?symbol=${symbol}`)
          const data = await res.json()
          return { label, price: data.c, change: data.d, changePercent: data.dp }
        })
      )
      setTickers(
        results
          .filter((r): r is PromiseFulfilledResult<TickerItem> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(t => t.price > 0)
      )
    }

    fetchTickers()
    const interval = setInterval(fetchTickers, 30000)
    return () => clearInterval(interval)
  }, [mounted])

  if (!mounted) return null

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 24px',
      display: 'flex',
      gap: '32px',
      overflowX: 'auto',
      fontSize: '12px',
      whiteSpace: 'nowrap',
    }}>
      {tickers.map((t) => {
        const up = t.change >= 0
        return (
          <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.label}</span>
            <span style={{ fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
              ${t.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{
              color: up ? 'var(--green)' : 'var(--red)',
              fontWeight: 500,
            }}>
              {up ? '▲' : '▼'} {Math.abs(t.changePercent)?.toFixed(2)}%
            </span>
          </div>
        )
      })}
      <div style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--green)',
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--green)',
          display: 'inline-block',
          animation: 'pulse 2s infinite',
        }} />
        LIVE
      </div>
    </div>
  )
}
