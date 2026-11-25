// Isomorphic portfolio math shared by the dashboard, the Excel export and the live feed.
// Values stay in each instrument's own currency; totals are grouped per currency (no FX conversion).

import type { PortfolioItem, Quote } from '@/types'

export type PriceQuote = Pick<Quote, 'price' | 'changePercent' | 'currency'>

export interface ExportRow {
  symbol: string
  name: string
  type: string
  isin: string
  position: string
  currency: string
  quantity: number
  avgPrice: number
  price: number | null
  dayChangePct: number | null // fraction (0.0123 = 1.23%)
  value: number
  cost: number
  pnl: number
  pnlPct: number               // fraction
  weight: number               // fraction of the total in the same currency
}

export function buildRows(items: PortfolioItem[], quotes: Record<string, PriceQuote>): ExportRow[] {
  const rows = items.map(item => {
    const q = quotes[item.symbol]
    const price = q?.price || null
    const cost = item.avg_price * item.quantity
    const value = (price ?? item.avg_price) * item.quantity
    return {
      symbol: item.symbol,
      name: item.name ?? '',
      type: item.type ?? '',
      isin: item.isin ?? '',
      position: item.position ?? 'long',
      currency: q?.currency || item.currency || 'USD',
      quantity: item.quantity,
      avgPrice: item.avg_price,
      price,
      dayChangePct: q ? q.changePercent / 100 : null,
      value,
      cost,
      pnl: value - cost,
      pnlPct: cost > 0 ? (value - cost) / cost : 0,
      weight: 0,
    }
  })
  const totals = totalsByCurrency(rows)
  rows.forEach(r => { r.weight = totals[r.currency].value > 0 ? r.value / totals[r.currency].value : 0 })
  return rows.sort((a, b) => a.currency.localeCompare(b.currency) || b.value - a.value)
}

export function positionHeaders(t: (key: string) => string) {
  return [
    t('exp_symbol'), t('name'), t('exp_type'), 'ISIN', t('position'), t('exp_currency'), t('quantity'),
    t('avgPrice'), t('price'), t('exp_dayChange'), t('value'), t('exp_cost'), t('pnl'), `${t('pnl')} %`, t('exp_weight'),
  ]
}

export function totalsByCurrency(rows: ExportRow[]) {
  const out: Record<string, { count: number; value: number; cost: number }> = {}
  rows.forEach(r => {
    const t = (out[r.currency] ??= { count: 0, value: 0, cost: 0 })
    t.count++
    t.value += r.value
    t.cost += r.cost
  })
  return out
}

// ── Growth history ────────────────────────────────────────────────────────────

export interface Snapshot {
  date: string      // YYYY-MM-DD
  currency: string
  value: number
  cost: number
}

export interface GrowthPoint {
  date: string
  currency: string
  value: number
  cost: number | null          // unknown for estimated points
  source: 'real' | 'estimated'
}

// Recorded snapshots are the truth; the reconstruction (today's quantities × past prices)
// only fills the period before the first snapshot of each currency.
// Sorted by currency, then date — the Excel charts rely on contiguous blocks per currency.
export function mergeGrowth(
  snapshots: Snapshot[],
  estimated: Record<string, { date: string; value: number }[]>,
): GrowthPoint[] {
  const out: GrowthPoint[] = []
  const currencies = new Set([...snapshots.map(s => s.currency), ...Object.keys(estimated)])
  for (const currency of [...currencies].sort()) {
    const real = snapshots
      .filter(s => s.currency === currency)
      .sort((a, b) => a.date.localeCompare(b.date))
    const firstReal = real[0]?.date ?? '9999-12-31'
    ;(estimated[currency] ?? [])
      .filter(p => p.date < firstReal)
      .forEach(p => out.push({ date: p.date, currency, value: p.value, cost: null, source: 'estimated' }))
    real.forEach(s => out.push({ date: s.date, currency, value: Number(s.value), cost: Number(s.cost), source: 'real' }))
  }
  return out
}

// Holdings grouped by currency, in the `SYMBOL:QTY,…` form /api/market/portfolio-history takes
export function holdingsByCurrency(rows: ExportRow[]): Record<string, string> {
  const out: Record<string, string[]> = {}
  rows.forEach(r => (out[r.currency] ??= []).push(`${r.symbol}:${r.quantity}`))
  return Object.fromEntries(Object.entries(out).map(([c, h]) => [c, h.join(',')]))
}

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
