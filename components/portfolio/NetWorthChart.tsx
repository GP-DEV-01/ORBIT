'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle, AreaSeries, IChartApi, ISeriesApi } from 'lightweight-charts'
import { PortfolioItem, Quote } from '@/types'

interface HistoryPoint { date: string; value: number }

const RANGES = ['1M', '3M', '6M', '1Y', '2Y'] as const
type Range = typeof RANGES[number]

const CATEGORY_LABELS: Record<string, string> = {
  all: 'TOTALE',
  stock: 'AZIONI',
  etf: 'ETF',
  crypto: 'CRYPTO',
  fund: 'FUND',
  forex: 'FOREX',
  commodity: 'COMMODITY',
  index: 'INDICI',
  derivative: 'DERIVATI',
}

interface Props {
  items: PortfolioItem[]
  quotes: Record<string, Quote>
}

export default memo(function NetWorthChart({ items, quotes }: Props) {
  const [range, setRange] = useState<Range>('1Y')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState<{ time: string; value: number } | null>(null)

  // Imperative refs for the chart — never recreated
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  // Unique categories derived from items
  const categories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.type.toLowerCase())))
  }, [items])

  const allTabs = ['all', ...categories]

  // Filtered items based on active category
  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return items
    return items.filter(i => i.type.toLowerCase() === activeCategory)
  }, [items, activeCategory])

  // Current total value (live)
  const { currentValue, costBasis } = useMemo(() => ({
    currentValue: filteredItems.reduce((s, i) => {
      const q = quotes[i.symbol]
      return s + (q?.price ? q.price * i.quantity : i.avg_price * i.quantity)
    }, 0),
    costBasis: filteredItems.reduce((s, i) => s + i.avg_price * i.quantity, 0),
  }), [filteredItems, quotes])

  const totalPnL = currentValue - costBasis
  const totalPnLPct = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0
  const up = totalPnL >= 0

  // Stable dependency key — re-fetch only when range or symbols+quantities change
  const holdingsKey = useMemo(
    () => filteredItems.map(i => `${i.symbol}:${i.quantity}`).sort().join(','),
    [filteredItems]
  )

  // ── Init chart ONCE ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#555',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Solid },
        horzLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Solid },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        textColor: '#555',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: false,
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: 220,
    })

    // Default to green area — will be updated when data arrives
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#22c55e',
      topColor: 'rgba(34,197,94,0.2)',
      bottomColor: 'rgba(34,197,94,0)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: '#000',
      crosshairMarkerBackgroundColor: '#22c55e',
    })

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        setHovered(null)
        return
      }
      const dataPoint = param.seriesData.get(series) as { value: number } | undefined
      if (dataPoint) {
        setHovered({ time: String(param.time), value: dataPoint.value })
      } else {
        setHovered(null)
      }
    })

    const ro = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      if (width > 0) chart.applyOptions({ width })
    })
    ro.observe(containerRef.current)

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, []) // ← empty: init only once

  // ── Update series data when history changes ───────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || history.length < 2) return

    const isUp = history.at(-1)!.value >= history[0].value
    const lineColor = isUp ? '#22c55e' : '#ef4444'
    const topColor = isUp ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'

    seriesRef.current.applyOptions({
      lineColor,
      topColor,
      bottomColor: 'rgba(0,0,0,0)',
      crosshairMarkerBackgroundColor: lineColor,
    })

    // Deduplicate by date and sort ascending — lightweight-charts requires unique ordered timestamps
    const seen = new Set<string>()
    const clean = history
      .filter(p => { if (seen.has(p.date)) return false; seen.add(p.date); return true })
      .sort((a, b) => a.date.localeCompare(b.date))

    seriesRef.current.setData(
      clean.map(p => ({ time: p.date as unknown as import('lightweight-charts').Time, value: p.value }))
    )

    chartRef.current.timeScale().fitContent()
  }, [history])

  // ── Fetch history when range or holdings change ───────────────────────────
  useEffect(() => {
    if (!holdingsKey) return
    setLoading(true)
    fetch(`/api/market/portfolio-history?holdings=${encodeURIComponent(holdingsKey)}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        setHistory(d.history ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [range, holdingsKey])

  const isPositiveTrend = history.length > 1 && history.at(-1)!.value >= history[0].value
  const lineColor = isPositiveTrend ? 'var(--green)' : 'var(--red)'

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

      {/* Bloomberg-style category selector — full width, border-bottom */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}>
        {allTabs.map(cat => {
          const isActive = cat === activeCategory
          const label = CATEGORY_LABELS[cat] ?? cat.toUpperCase()
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '10px 18px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--green)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: isActive ? '700' : '400',
                background: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'color 0.12s, border-bottom-color 0.12s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Header: value + PnL + range selector */}
      <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="section-label" style={{ marginBottom: '6px' }}>Patrimonio Netto</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '28px', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
              {currentValue.toLocaleString('it-IT', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
            </span>
            <span style={{
              fontSize: '13px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px',
              color: up ? 'var(--green)' : 'var(--red)',
              background: up ? 'var(--green-dim)' : 'var(--red-dim)',
            }}>
              {up ? '+' : ''}{totalPnL.toLocaleString('it-IT', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
              {' '}({up ? '+' : ''}{totalPnLPct.toFixed(2)}%)
            </span>
          </div>
          {/* Hovered datapoint info shown below the value */}
          {hovered ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {hovered.time} ·{' '}
              <span style={{ color: lineColor, fontWeight: '600' }}>
                {hovered.value.toLocaleString('it-IT', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'transparent', marginTop: '4px', userSelect: 'none' }}>
              &nbsp;
            </div>
          )}
        </div>

        {/* Range selector */}
        <div style={{
          display: 'flex', background: 'var(--bg-elevated)', borderRadius: '999px',
          padding: '3px', border: '1px solid var(--border)', flexShrink: 0,
        }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '5px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: range === r ? '700' : '400',
              background: range === r ? 'var(--bg-card)' : 'transparent',
              color: range === r ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.12s',
            }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div style={{ position: 'relative', padding: '0 0 4px' }}>
        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px',
            background: 'rgba(0,0,0,0.4)', zIndex: 10, borderRadius: '0 0 20px 20px',
          }}>
            Caricamento storico...
          </div>
        )}

        {/* No-data message — shown only when not loading and data is insufficient */}
        {!loading && history.length < 2 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px',
            height: '220px', zIndex: 5,
          }}>
            Dati storici non disponibili per questo periodo
          </div>
        )}

        {/* lightweight-charts canvas container — always mounted so the chart instance persists */}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '220px',
            // Hide canvas visually when no data, but keep it mounted
            opacity: !loading && history.length < 2 ? 0 : 1,
            transition: 'opacity 0.2s',
          }}
        />

        {/* Tooltip — fixed top-right, shows hovered value */}
        {hovered && !loading && history.length >= 2 && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '16px',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-hover)',
              borderRadius: '10px',
              padding: '6px 10px',
              fontSize: '10px',
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: '1.4',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
            }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>{hovered.time}</div>
              <div style={{ fontWeight: '700', fontSize: '12px', color: lineColor }}>
                {hovered.value.toLocaleString('it-IT', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
