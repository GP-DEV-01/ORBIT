'use client'

import { memo, useMemo, useState } from 'react'
import { PortfolioItem, Quote } from '@/types'
import { supabase } from '@/lib/supabase'
import { usePortfolioStore } from '@/lib/store'
import { useLang } from '@/lib/LanguageContext'
import InstrumentDetail from '@/components/instruments/InstrumentDetail'
import FlashPrice from '@/components/ui/FlashPrice'

interface Props {
  items: PortfolioItem[]
  quotes: Record<string, Quote>
  onAddClick: () => void
}

interface EditState {
  id: string
  quantity: string
  avg_price: string
}

const MARKET_BADGE: Record<string, string> = { pre: 'marketPre', post: 'marketPost', closed: 'marketClosed' }

function formatPrice(price: number, currency = 'USD') {
  try {
    return price.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

export default memo(function PortfolioTable({ items, quotes, onAddClick }: Props) {
  const [selected, setSelected] = useState<{ symbol: string; name: string; type?: string } | null>(null)
  const [editing, setEditing] = useState<EditState | null>(null)
  const removeItem = usePortfolioStore(s => s.removeItem)
  const updateItem = usePortfolioStore(s => s.updateItem)
  const { t } = useLang()

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await supabase.from('portfolios').delete().eq('id', id)
    removeItem(id)
    if (selected) setSelected(null)
  }

  function startEdit(item: PortfolioItem, e: React.MouseEvent) {
    e.stopPropagation()
    setEditing({ id: item.id, quantity: String(item.quantity), avg_price: String(item.avg_price) })
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(null)
  }

  async function confirmEdit(e: React.MouseEvent) {
    e.stopPropagation()
    if (!editing) return
    const quantity = parseFloat(editing.quantity)
    const avg_price = parseFloat(editing.avg_price)
    if (isNaN(quantity) || isNaN(avg_price) || quantity <= 0 || avg_price <= 0) return
    await supabase.from('portfolios').update({ quantity, avg_price }).eq('id', editing.id)
    updateItem(editing.id, { quantity, avg_price })
    setEditing(null)
  }

  function calcPnL(item: PortfolioItem) {
    const q = quotes[item.symbol]
    if (!q?.price || !item.avg_price) return null
    const currentValue = q.price * item.quantity
    const costBasis = item.avg_price * item.quantity
    const pnl = currentValue - costBasis
    const pnlPct = ((q.price - item.avg_price) / item.avg_price) * 100
    return { currentValue, pnl, pnlPct }
  }

  const { totalValue, totalCost, totalPnL, totalPnLPct, up } = useMemo(() => {
    const totalValue = items.reduce((s, i) => {
      const q = quotes[i.symbol]
      return s + (q?.price ? q.price * i.quantity : i.avg_price * i.quantity)
    }, 0)
    const totalCost = items.reduce((s, i) => s + i.avg_price * i.quantity, 0)
    const totalPnL = totalValue - totalCost
    const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
    const up = totalPnL >= 0
    return { totalValue, totalCost, totalPnL, totalPnLPct, up }
  }, [items, quotes])

  if (items.length === 0) {
    return (
      <div className="card" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '40px', opacity: 0.1, marginBottom: '16px' }}>▣</div>
        <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{t('portfolioEmpty')}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '24px' }}>
          {t('addInstrumentsMsg')}
        </p>
        <button className="btn-primary" onClick={onAddClick}>+ {t('addInstrument')}</button>
      </div>
    )
  }

  const COLS = '1.4fr 90px 90px 120px 120px 90px 100px'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[
          {
            label: t('totalValue'),
            value: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            color: undefined,
          },
          {
            label: t('totalPnL'),
            value: `${up ? '+' : '−'}$${Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            color: up ? 'var(--green)' : 'var(--orange)',
          },
          {
            label: t('returnPct'),
            value: `${up ? '+' : ''}${totalPnLPct.toFixed(2)}%`,
            color: up ? 'var(--green)' : 'var(--orange)',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '20px 24px' }}>
            <div className="section-label" style={{ marginBottom: '10px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: color ?? 'var(--text-primary)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Instrument detail panel */}
      {selected && (
        <div className="animate-fadeIn">
          <InstrumentDetail symbol={selected.symbol} name={selected.name} type={selected.type} />
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: COLS,
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          {[t('instrument'), t('price'), t('dayChange'), t('value'), t('pnl'), t('returnPct'), ''].map((h, i) => (
            <div key={i} className="section-label" style={{ textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {items.map((item, idx) => {
          const q = quotes[item.symbol]
          const pnl = calcPnL(item)
          const isActive = selected?.symbol === item.symbol
          const isEditing = editing?.id === item.id
          const dayUp = q && q.changePercent >= 0
          const pnlUp = pnl && pnl.pnl >= 0

          return (
            <div
              key={item.id}
              onClick={() => !isEditing && setSelected(isActive ? null : { symbol: item.symbol, name: item.name, type: item.type })}
              style={{
                display: 'grid',
                gridTemplateColumns: COLS,
                padding: '14px 20px',
                borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: isEditing ? 'default' : 'pointer',
                alignItems: 'center',
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                transition: 'background 0.1s',
                borderLeft: `3px solid ${isActive ? 'var(--green)' : 'transparent'}`,
              }}
              onMouseEnter={e => { if (!isActive && !isEditing) e.currentTarget.style.background = 'rgba(255,255,255,0.015)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--bg-elevated)' : 'transparent' }}
            >
              {/* Instrument name + inline edit inputs */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>{item.symbol}</span>
                  {q?.marketState && MARKET_BADGE[q.marketState] && (
                    <span style={{
                      fontSize: '8px', fontWeight: '700', letterSpacing: '0.06em', padding: '1px 5px',
                      borderRadius: '999px', color: 'var(--text-muted)', border: '1px solid var(--border)',
                    }}>
                      {t(MARKET_BADGE[q.marketState])}
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      value={editing.quantity}
                      onChange={e => setEditing(prev => prev ? { ...prev, quantity: e.target.value } : prev)}
                      placeholder="Qty"
                      style={{
                        width: '72px', padding: '3px 6px', borderRadius: '6px', fontSize: '11px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', outline: 'none',
                      }}
                    />
                    <input
                      type="number"
                      value={editing.avg_price}
                      onChange={e => setEditing(prev => prev ? { ...prev, avg_price: e.target.value } : prev)}
                      placeholder="Avg $"
                      style={{
                        width: '80px', padding: '3px 6px', borderRadius: '6px', fontSize: '11px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', outline: 'none',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {Number(item.quantity.toFixed(4))} × avg {item.currency ?? 'USD'} {item.avg_price.toFixed(2)}
                    {item.is_pac && item.pac_amount != null && item.pac_frequency && (
                      <span title={t('pac_autoNote')} style={{
                        marginLeft: '6px', fontSize: '8px', fontWeight: '700', letterSpacing: '0.04em', padding: '1px 6px',
                        borderRadius: '999px', color: 'var(--green)', border: '1px solid var(--green)',
                      }}>
                        PAC · {item.pac_amount} {item.currency ?? ''} {t(`freq_${item.pac_frequency}`).toLowerCase()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                {q?.price ? <FlashPrice value={q.price}>{formatPrice(q.price, q.currency)}</FlashPrice> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>

              <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: '600', color: q ? (dayUp ? 'var(--green)' : 'var(--orange)') : 'var(--text-muted)' }}>
                {q ? `${dayUp ? '+' : ''}${q.changePercent.toFixed(2)}%` : '—'}
              </div>

              <div style={{ textAlign: 'right', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                {pnl ? `$${pnl.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </div>

              <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: pnl ? (pnlUp ? 'var(--green)' : 'var(--orange)') : 'var(--text-muted)' }}>
                {pnl ? `${pnlUp ? '+' : '−'}$${Math.abs(pnl.pnl).toFixed(2)}` : '—'}
              </div>

              <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: '600', color: pnl ? (pnlUp ? 'var(--green)' : 'var(--orange)') : 'var(--text-muted)' }}>
                {pnl ? `${pnlUp ? '+' : ''}${pnl.pnlPct.toFixed(2)}%` : '—'}
              </div>

              {/* Actions */}
              <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                {isEditing ? (
                  <>
                    {/* Confirm */}
                    <button
                      onClick={confirmEdit}
                      title="Confirm"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '6px', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.background = 'var(--green-dim)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    >✓</button>
                    {/* Cancel */}
                    <button
                      onClick={cancelEdit}
                      title="Cancel"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '6px', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--orange)'; e.currentTarget.style.background = 'var(--orange-dim)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    >✕</button>
                  </>
                ) : (
                  <>
                    {/* Edit — PAC rows are derived from the plan, a manual edit would be overwritten */}
                    {!item.is_pac && <button
                      onClick={e => startEdit(item, e)}
                      title="Edit"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '6px', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.background = 'var(--green-dim)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
>✎</button>}
                    {/* Delete */}
                    <button
                      onClick={e => handleDelete(item.id, e)}
                      title="Delete"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', padding: '4px 6px', borderRadius: '6px', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--orange)'; e.currentTarget.style.background = 'var(--orange-dim)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    >✕</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
