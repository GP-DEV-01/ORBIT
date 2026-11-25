'use client'

import { useEffect, useState } from 'react'
import TradingChart from '@/components/charts/TradingChart'

interface DetailData {
  profile: {
    name: string; logo: string; exchange: string; industry: string
    country: string; currency: string; ipo: string; website: string
    description: string; marketCap: number; shareOutstanding: number
  }
  quote: { price: number; change: number; changePct: number }
  metrics: Record<string, number | null>
  peers: { symbol: string; price: number; changePct: number }[]
  news: { id: number; headline: string; url: string; source: string; datetime: number; image: string }[]
  earnings: { period: string; actual: number; estimate: number; surprise: number; surprisePercent: number }[]
}

interface FundData {
  name: string; nav: number; change: number; changePct: number; currency: string
  ter: number | null; category: string | null; fundFamily: string | null
  totalAssets: number | null; inceptionDate: string | null
  ytdReturn: number | null; return1y: number | null; return3y: number | null; return5y: number | null
  starRating: number | null; riskRating: string | null
  isin: string | null; morningstarId: string | null
  navHistory: { date: string; nav: number }[]
}

type Tab = 'overview' | 'financials' | 'events' | 'similar' | 'derivatives' | 'fund'

interface Props { symbol: string; name: string; type?: string }

function fmt(n: number | null | undefined, decimals = 2, suffix = ''): string {
  if (n == null) return '—'
  return n.toFixed(decimals) + suffix
}

function fmtLarge(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toFixed(0)}`
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function Stars({ n }: { n: number | null }) {
  if (!n) return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
  return (
    <span style={{ fontSize: '18px', letterSpacing: '2px' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? '#f59e0b' : '#333' }}>★</span>
      ))}
    </span>
  )
}

function PerfBadge({ v }: { v: number | null }) {
  if (v == null) return <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>—</span>
  const up = v >= 0
  return (
    <span style={{ color: up ? 'var(--green)' : 'var(--red)', fontWeight: '700', fontSize: '13px' }}>
      {up ? '+' : ''}{v.toFixed(2)}%
    </span>
  )
}

export default function InstrumentDetail({ symbol, name, type }: Props) {
  const [data, setData] = useState<DetailData | null>(null)
  const [fundData, setFundData] = useState<FundData | null>(null)
  const [loading, setLoading] = useState(true)

  const isFund = type === 'Fund' || type === 'fund' || type === 'MUTUALFUND'
  const [tab, setTab] = useState<Tab>(isFund ? 'fund' : 'overview')

  useEffect(() => {
    const isF = type === 'Fund' || type === 'fund' || type === 'MUTUALFUND'
    setLoading(true)
    setData(null)
    setFundData(null)
    setTab(isF ? 'fund' : 'overview')

    const detailFetch = fetch(`/api/market/detail?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json()).then(d => setData(d)).catch(() => {})

    if (isF) {
      Promise.all([
        detailFetch,
        fetch(`/api/market/fund?symbol=${encodeURIComponent(symbol)}`)
          .then(r => r.json()).then(d => setFundData(d)).catch(() => {}),
      ]).finally(() => setLoading(false))
    } else {
      detailFetch.finally(() => setLoading(false))
    }
  }, [symbol, type])

  const TABS: { key: Tab; label: string }[] = [
    ...(isFund ? [{ key: 'fund' as Tab, label: '★ Fund' }] : []),
    { key: 'overview', label: 'Overview' },
    ...(!isFund ? [{ key: 'financials' as Tab, label: 'Financials' }] : []),
    { key: 'events', label: 'Events' },
    { key: 'similar', label: 'Similar' },
    ...(!isFund ? [{ key: 'derivatives' as Tab, label: 'Derivatives' }] : []),
  ]

  const up = data && data.quote.changePct >= 0
  const fUp = fundData && fundData.changePct >= 0

  return (
    <div className="card animate-fadeIn" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
          {data?.profile.logo && (
            <img src={data.profile.logo} alt="" style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#fff', objectFit: 'contain', padding: '3px' }} onError={e => { e.currentTarget.style.display = 'none' }} />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>{symbol}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {fundData?.name ?? data?.profile.name ?? name}
              </span>
              {data?.profile.exchange && <span className="tag">{data.profile.exchange}</span>}
              {isFund && fundData?.category && <span className="tag">{fundData.category}</span>}
              {!isFund && data?.profile.industry && <span className="tag">{data.profile.industry}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
              {isFund && fundData ? (
                <>
                  <span style={{ fontSize: '24px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                    {fundData.currency} {fundData.nav.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </span>
                  <span style={{
                    fontSize: '13px', fontWeight: '600', padding: '3px 10px', borderRadius: '5px',
                    color: fUp ? 'var(--green)' : 'var(--red)',
                    background: fUp ? 'var(--green-dim)' : 'var(--red-dim)',
                  }}>
                    {fUp ? '+' : ''}{fundData.change.toFixed(4)} ({fUp ? '+' : ''}{fundData.changePct.toFixed(2)}%)
                  </span>
                  {fundData.starRating && (
                    <Stars n={fundData.starRating} />
                  )}
                </>
              ) : data ? (
                <>
                  <span style={{ fontSize: '24px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                    {data.profile.currency !== 'USD' ? data.profile.currency + ' ' : '$'}
                    {data.quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    fontSize: '13px', fontWeight: '600', padding: '3px 10px', borderRadius: '5px',
                    color: up ? 'var(--green)' : 'var(--red)',
                    background: up ? 'var(--green-dim)' : 'var(--red-dim)',
                  }}>
                    {up ? '+' : ''}{data.quote.change.toFixed(2)} ({up ? '+' : ''}{data.quote.changePct.toFixed(2)}%)
                  </span>
                </>
              ) : null}
            </div>
          </div>
          {data?.profile.website && (
            <a href={data.profile.website} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ marginLeft: 'auto', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Website ↗
            </a>
          )}
          {isFund && fundData?.morningstarId && (
            <a
              href={`https://global.morningstar.com/it/funds/${fundData.morningstarId}`}
              target="_blank" rel="noopener noreferrer"
              className="btn-ghost"
              style={{ marginLeft: data?.profile.website ? '0' : 'auto', fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Morningstar ↗
            </a>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', borderTop: '1px solid var(--border)', marginTop: '14px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: tab === t.key ? '700' : '400',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t.key ? 'var(--green)' : 'transparent'}`,
              transition: 'all 0.12s', marginBottom: '-1px',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Loading data...
        </div>
      ) : !data && !fundData ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Data not available
        </div>
      ) : (
        <div style={{ padding: '20px' }}>

          {/* FUND TAB */}
          {tab === 'fund' && fundData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Star rating + key info banner */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '12px',
              }}>
                {[
                  {
                    label: 'Morningstar Rating',
                    value: <Stars n={fundData.starRating} />,
                  },
                  {
                    label: 'Categoria',
                    value: <span style={{ fontSize: '12px', fontWeight: '600' }}>{fundData.category ?? '—'}</span>,
                  },
                  {
                    label: 'TER / Spese',
                    value: <span style={{ fontSize: '14px', fontWeight: '700', color: fundData.ter != null && fundData.ter < 0.5 ? 'var(--green)' : fundData.ter != null && fundData.ter > 1.5 ? 'var(--red)' : 'var(--text-primary)' }}>
                      {fundData.ter != null ? `${fundData.ter.toFixed(2)}%` : '—'}
                    </span>,
                  },
                  {
                    label: 'AUM',
                    value: <span style={{ fontSize: '12px', fontWeight: '600' }}>{fmtLarge(fundData.totalAssets)}</span>,
                  },
                  {
                    label: 'Gestore',
                    value: <span style={{ fontSize: '11px', fontWeight: '600' }}>{fundData.fundFamily ?? '—'}</span>,
                  },
                  {
                    label: 'Inizio',
                    value: <span style={{ fontSize: '12px', fontWeight: '600' }}>{fundData.inceptionDate ?? '—'}</span>,
                  },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: 'var(--bg-elevated)', borderRadius: '14px',
                    padding: '14px 16px', border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
                    {value}
                  </div>
                ))}
              </div>

              {/* Performance table */}
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '600' }}>PERFORMANCE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'YTD', value: fundData.ytdReturn },
                    { label: '1 Anno', value: fundData.return1y },
                    { label: '3 Anni (ann.)', value: fundData.return3y },
                    { label: '5 Anni (ann.)', value: fundData.return5y },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: 'var(--bg-elevated)', borderRadius: '14px',
                      padding: '16px', border: '1px solid var(--border)', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
                      <PerfBadge v={value} />
                    </div>
                  ))}
                </div>
              </div>

              {/* NAV mini-chart using CSS bars */}
              {fundData.navHistory.length > 4 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: '600' }}>NAV – ULTIME 24 MENSILITÀ</div>
                  <div style={{
                    background: 'var(--bg-elevated)', borderRadius: '14px', padding: '16px',
                    border: '1px solid var(--border)', height: '80px',
                    display: 'flex', alignItems: 'flex-end', gap: '3px',
                  }}>
                    {(() => {
                      const vals = fundData.navHistory.map(h => h.nav)
                      const min = Math.min(...vals)
                      const max = Math.max(...vals)
                      const range = max - min || 1
                      return vals.map((v, i) => {
                        const h = ((v - min) / range) * 100
                        const isLast = i === vals.length - 1
                        return (
                          <div
                            key={i}
                            style={{
                              flex: 1, height: `${Math.max(h, 4)}%`,
                              background: isLast ? 'var(--green)' : v >= (vals[i - 1] ?? v) ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
                              borderRadius: '2px 2px 0 0',
                            }}
                          />
                        )
                      })
                    })()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
                    <span>{fundData.navHistory[0]?.date}</span>
                    <span>{fundData.navHistory.at(-1)?.date}</span>
                  </div>
                </div>
              )}

              {/* ISIN + Links */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                {fundData.isin && (
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: '999px', padding: '6px 14px', fontSize: '11px', border: '1px solid var(--border)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                    ISIN: <strong>{fundData.isin}</strong>
                  </div>
                )}
                {[
                  { label: 'Yahoo Finance', href: `https://finance.yahoo.com/quote/${symbol}` },
                  { label: 'Morningstar', href: `https://global.morningstar.com/it/search?query=${encodeURIComponent(symbol)}` },
                  { label: 'Borsa Italiana', href: `https://www.borsaitaliana.it/borsa/fondi/fondi-comuni-e-sicav/scheda/${fundData.isin ?? symbol}.html` },
                ].map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost" style={{ fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isFund ? (
                /* NAV inline SVG chart — TradingView doesn't support Morningstar fund symbols */
                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700' }}>NAV History</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{symbol}</span>
                    </div>
                    {fundData && (
                      <span style={{
                        fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px',
                        color: fundData.changePct >= 0 ? 'var(--green)' : 'var(--red)',
                        background: fundData.changePct >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
                      }}>
                        {fundData.changePct >= 0 ? '+' : ''}{fundData.changePct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  {!fundData ? (
                    <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '24px', height: '24px', border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    </div>
                  ) : fundData.navHistory.length < 2 ? (
                    <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      NAV history not available
                    </div>
                  ) : (() => {
                    const history = fundData.navHistory
                    const vals = history.map(h => h.nav)
                    const minVal = Math.min(...vals)
                    const maxVal = Math.max(...vals)
                    const range = maxVal - minVal || 1
                    const W = 560
                    const H = 140
                    const PAD_L = 52
                    const PAD_R = 12
                    const PAD_T = 12
                    const PAD_B = 28
                    const chartW = W - PAD_L - PAD_R
                    const chartH = H - PAD_T - PAD_B
                    const n = vals.length
                    const toX = (i: number) => PAD_L + (i / (n - 1)) * chartW
                    const toY = (v: number) => PAD_T + chartH - ((v - minVal) / range) * chartH
                    const pts = vals.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
                    const firstNav = vals[0]
                    const lastNav = vals[n - 1]
                    const trendUp = lastNav >= firstNav
                    const lineColor = trendUp ? 'var(--green)' : 'var(--red)'
                    const gradId = `nav-grad-${symbol.replace(/[^a-z0-9]/gi, '')}`
                    // Y-axis ticks (4 labels)
                    const yTicks = [0, 0.33, 0.67, 1].map(f => ({
                      val: minVal + f * range,
                      y: PAD_T + chartH - f * chartH,
                    }))
                    // X-axis: last 5 date labels evenly spaced
                    const xLabelCount = Math.min(5, n)
                    const xIndices = Array.from({ length: xLabelCount }, (_, k) =>
                      Math.round((k / (xLabelCount - 1)) * (n - 1))
                    )
                    return (
                      <div style={{ padding: '0 0 8px 0', background: '#0f0f0f' }}>
                        <svg
                          viewBox={`0 0 ${W} ${H}`}
                          width="100%"
                          height="180"
                          preserveAspectRatio="none"
                          style={{ display: 'block' }}
                        >
                          <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={trendUp ? '#22c55e' : '#ef4444'} stopOpacity="0.25" />
                              <stop offset="100%" stopColor={trendUp ? '#22c55e' : '#ef4444'} stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          {/* Grid lines */}
                          {yTicks.map((t, i) => (
                            <line key={i} x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y}
                              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                          ))}
                          {/* Y-axis labels */}
                          {yTicks.map((t, i) => (
                            <text key={i} x={PAD_L - 4} y={t.y + 4}
                              textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.35)"
                              fontFamily="system-ui,sans-serif">
                              {t.val.toFixed(t.val >= 100 ? 0 : t.val >= 10 ? 1 : 2)}
                            </text>
                          ))}
                          {/* Area fill */}
                          <polygon
                            points={`${PAD_L},${PAD_T + chartH} ${pts} ${toX(n - 1).toFixed(1)},${PAD_T + chartH}`}
                            fill={`url(#${gradId})`}
                          />
                          {/* Line */}
                          <polyline
                            points={pts}
                            fill="none"
                            stroke={lineColor}
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          {/* Last dot */}
                          <circle
                            cx={toX(n - 1)} cy={toY(lastNav)} r="3"
                            fill={lineColor} stroke="#0f0f0f" strokeWidth="1.5"
                          />
                          {/* X-axis labels */}
                          {xIndices.map((idx) => {
                            const dateStr = history[idx].date
                            const label = dateStr.slice(0, 7) // YYYY-MM
                            return (
                              <text key={idx} x={toX(idx)} y={H - 6}
                                textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.3)"
                                fontFamily="system-ui,sans-serif">
                                {label}
                              </text>
                            )
                          })}
                        </svg>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <TradingChart symbol={symbol} name={(data?.profile.name || fundData?.name) ?? name} />
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>KEY DATA</div>
                  {isFund && fundData ? (
                    <>
                      <StatRow label="NAV" value={`${fundData.currency} ${fundData.nav.toFixed(4)}`} />
                      <StatRow label="TER" value={fundData.ter != null ? `${fundData.ter.toFixed(2)}%` : '—'} />
                      <StatRow label="AUM" value={fmtLarge(fundData.totalAssets)} />
                      <StatRow label="Categoria" value={fundData.category ?? '—'} />
                      <StatRow label="Gestore" value={fundData.fundFamily ?? '—'} />
                      <StatRow label="Inception" value={fundData.inceptionDate ?? '—'} />
                    </>
                  ) : data ? (
                    <>
                      <StatRow label="Market Cap" value={fmtLarge(data.profile.marketCap * 1e6 || data.profile.marketCap)} />
                      <StatRow label="52W High" value={`$${fmt(data.metrics.high52)}`} />
                      <StatRow label="52W Low" value={`$${fmt(data.metrics.low52)}`} />
                      <StatRow label="Avg Vol (10D)" value={`${fmt(data.metrics.avgVolume10d, 2)}M`} />
                      <StatRow label="Beta" value={fmt(data.metrics.beta)} />
                      <StatRow label="Dividend Yield" value={fmt(data.metrics.dividendYield, 2, '%')} />
                      <StatRow label="IPO Date" value={data.profile.ipo || '—'} />
                    </>
                  ) : null}
                </div>

                <div>
                  {isFund && fundData ? (
                    <>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>PERFORMANCE</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>YTD</span>
                        <PerfBadge v={fundData.ytdReturn} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>1 Anno</span>
                        <PerfBadge v={fundData.return1y} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>3 Anni (ann.)</span>
                        <PerfBadge v={fundData.return3y} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>5 Anni (ann.)</span>
                        <PerfBadge v={fundData.return5y} />
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: '600' }}>RATING MORNINGSTAR</div>
                        <Stars n={fundData.starRating} />
                        {fundData.riskRating && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Rischio: {fundData.riskRating}</div>
                        )}
                      </div>
                    </>
                  ) : data ? (
                    <>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>VALUATION</div>
                      <StatRow label="P/E Ratio" value={fmt(data.metrics.pe)} />
                      <StatRow label="P/B Ratio" value={fmt(data.metrics.pb)} />
                      <StatRow label="P/S Ratio" value={fmt(data.metrics.ps)} />
                      <StatRow label="EPS (TTM)" value={`$${fmt(data.metrics.eps)}`} />
                      <StatRow label="Book Value/Share" value={`$${fmt(data.metrics.bookValuePerShare)}`} />
                      <StatRow label="Cash/Share" value={`$${fmt(data.metrics.cashPerShare)}`} />
                      <StatRow label="FCF/Share" value={`$${fmt(data.metrics.fcfPerShare)}`} />
                    </>
                  ) : null}
                </div>
              </div>

              {data?.profile.description && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '14px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: '600' }}>ABOUT</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
                    {data.profile.description.slice(0, 500)}{data.profile.description.length > 500 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* FINANCIALS */}
          {tab === 'financials' && data && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>PROFITABILITY</div>
                <StatRow label="Gross Margin" value={fmt(data.metrics.grossMargin, 2, '%')} color={data.metrics.grossMargin && data.metrics.grossMargin > 0 ? 'var(--green)' : undefined} />
                <StatRow label="Operating Margin" value={fmt(data.metrics.operatingMargin, 2, '%')} color={data.metrics.operatingMargin && data.metrics.operatingMargin > 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="Net Margin" value={fmt(data.metrics.netMargin, 2, '%')} color={data.metrics.netMargin && data.metrics.netMargin > 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="ROE" value={fmt(data.metrics.roe, 2, '%')} />
                <StatRow label="ROA" value={fmt(data.metrics.roa, 2, '%')} />
                <StatRow label="Payout Ratio" value={fmt(data.metrics.payoutRatio, 2, '%')} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>GROWTH & LEVERAGE</div>
                <StatRow label="Revenue Growth YoY" value={fmt(data.metrics.revenueGrowth, 2, '%')} color={data.metrics.revenueGrowth && data.metrics.revenueGrowth > 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="EPS Growth YoY" value={fmt(data.metrics.earningsGrowth, 2, '%')} color={data.metrics.earningsGrowth && data.metrics.earningsGrowth > 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="Debt/Equity" value={fmt(data.metrics.debtEquity)} />
                <StatRow label="52W Return" value={fmt(data.metrics.priceReturn52w, 2, '%')} color={data.metrics.priceReturn52w && data.metrics.priceReturn52w > 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="13W Return" value={fmt(data.metrics.priceReturn13w, 2, '%')} color={data.metrics.priceReturn13w && data.metrics.priceReturn13w > 0 ? 'var(--green)' : 'var(--red)'} />
                <StatRow label="Avg Vol (3M)" value={`${fmt(data.metrics.avgVolume3m, 2)}M`} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>DATA SOURCES</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { name: 'Finnhub', href: `https://finnhub.io/` },
                    { name: 'Morningstar', href: `https://www.morningstar.com/stocks/${symbol?.toLowerCase()}/quote` },
                    { name: 'Yahoo Finance', href: `https://finance.yahoo.com/quote/${symbol}` },
                  ].map(src => (
                    <a key={src.name} href={src.href} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {src.name} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EVENTS */}
          {tab === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {data?.earnings && data.earnings.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '600' }}>EARNINGS HISTORY</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {data.earnings.map((e, i) => {
                      const beat = e.surprise > 0
                      return (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 100px', gap: '12px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '6px', alignItems: 'center', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{e.period}</span>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>ACTUAL</div><span style={{ fontWeight: '600' }}>${fmt(e.actual)}</span></div>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>ESTIMATE</div><span>${fmt(e.estimate)}</span></div>
                          <div><div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>SURPRISE</div><span style={{ color: beat ? 'var(--green)' : 'var(--red)', fontWeight: '600' }}>{beat ? '+' : ''}{fmt(e.surprisePercent, 2, '%')}</span></div>
                          <span style={{ textAlign: 'right', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: beat ? 'var(--green-dim)' : 'var(--red-dim)', color: beat ? 'var(--green)' : 'var(--red)', fontWeight: '600' }}>
                            {beat ? '▲ BEAT' : '▼ MISS'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {data?.news && data.news.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '600' }}>RECENT NEWS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.news.map((n) => {
                      const date = new Date(n.datetime * 1000)
                      const ago = Math.floor((Date.now() - date.getTime()) / 3600000)
                      return (
                        <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" style={{
                          display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '10px 14px',
                          background: 'var(--bg-secondary)', borderRadius: '6px', textDecoration: 'none',
                          border: '1px solid transparent', transition: 'border-color 0.12s',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent' }}
                        >
                          {n.image && <img src={n.image} alt="" style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none' }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', lineHeight: '1.4', marginBottom: '4px' }}>{n.headline}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{n.source} · {ago < 24 ? `${ago}h ago` : date.toLocaleDateString()}</div>
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {(!data?.earnings || data.earnings.length === 0) && (!data?.news || data.news.length === 0) && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No event data available for this instrument
                </div>
              )}
            </div>
          )}

          {/* SIMILAR */}
          {tab === 'similar' && (
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '14px', fontWeight: '600' }}>
                PEER INSTRUMENTS{data?.profile.industry ? ` · ${data.profile.industry}` : ''}
              </div>
              {!data?.peers || data.peers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>No peer data available</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {data.peers.map(p => {
                    const pUp = p.changePct >= 0
                    return (
                      <div key={p.symbol} style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '14px', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{p.symbol}</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', marginBottom: '4px' }}>
                          ${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: pUp ? 'var(--green)' : 'var(--red)' }}>
                          {pUp ? '▲' : '▼'} {Math.abs(p.changePct).toFixed(2)}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* DERIVATIVES */}
          {tab === 'derivatives' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '6px', padding: '20px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '600' }}>OPTIONS & DERIVATIVES</div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
                  Access options chains, Greeks, and derivatives data for <strong>{symbol}</strong> on these professional platforms:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { name: 'Yahoo Finance Options', href: `https://finance.yahoo.com/quote/${symbol}/options/`, desc: 'Full options chain, calls & puts' },
                    { name: 'Barchart Options', href: `https://www.barchart.com/stocks/quotes/${symbol}/options`, desc: 'Implied volatility, Greeks, OI' },
                    { name: 'MarketWatch Options', href: `https://www.marketwatch.com/investing/stock/${symbol?.toLowerCase()}/options`, desc: 'Options overview and analysis' },
                    { name: 'CBOE Options', href: `https://www.cboe.com/delayed_quotes/${symbol?.toLowerCase()}/options`, desc: 'CBOE official options data' },
                  ].map(({ name, href, desc }) => (
                    <a key={name} href={href} target="_blank" rel="noopener noreferrer" style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 14px', background: 'var(--bg-card)', borderRadius: '6px',
                      border: '1px solid var(--border)', textDecoration: 'none',
                      transition: 'border-color 0.12s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-light)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>↗</span>
                    </a>
                  ))}
                </div>
              </div>

              {data && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px', fontWeight: '600' }}>RELEVANT METRICS</div>
                  <StatRow label="Beta (Market Sensitivity)" value={fmt(data.metrics.beta)} />
                  <StatRow label="52W High" value={`$${fmt(data.metrics.high52)}`} />
                  <StatRow label="52W Low" value={`$${fmt(data.metrics.low52)}`} />
                  <StatRow label="Avg Volume (10D)" value={`${fmt(data.metrics.avgVolume10d, 2)}M shares`} />
                  <StatRow label="Current Price" value={`$${data.quote.price.toFixed(2)}`} />
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
