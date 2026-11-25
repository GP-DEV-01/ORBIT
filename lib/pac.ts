// PAC (piano di accumulo): a fixed amount invested at a regular interval from a start date.
// Isomorphic: the schedule and the maths are shared by /api/market/pac, the add modal preview
// and the dashboard sync. Every instalment buys fractional units at the first close on/after its date.

import type { PacFrequency } from '@/types'

export const PAC_FREQUENCIES: PacFrequency[] = ['monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual']

const MONTHS: Record<PacFrequency, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 }

const MAX_INSTALMENTS = 1200

export interface PacPlan {
  amount: number
  frequency: PacFrequency
  start: string          // YYYY-MM-DD
  end?: string | null
  initial?: number | null
}

export interface PacInstalment {
  date: string           // scheduled
  execDate: string       // first trading day on/after `date`
  price: number
  amount: number
  units: number
}

export interface PacResult {
  instalments: PacInstalment[]
  count: number
  quantity: number
  invested: number
  avgPrice: number
  pending: number        // instalments due but not priced yet (today, before the close / holiday)
  next: string | null    // next scheduled instalment after today
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))

export function validPlan(p: Partial<PacPlan>): p is PacPlan {
  return !!p.amount && p.amount > 0
    && !!p.frequency && p.frequency in MONTHS
    && isDate(p.start)
    && (p.end == null || p.end === '' || (isDate(p.end) && p.end >= p.start))
    && (p.initial == null || p.initial >= 0)
}

// Day of month is kept from the start date and clamped to the month's length (31 Jan → 28 Feb → 31 Mar)
function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const total = (m - 1) + n
  const year = y + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

// Scheduled dates up to and including `until` (and the plan's end, if any)
export function pacSchedule(plan: PacPlan, until: string): string[] {
  const out: string[] = []
  const limit = plan.end && plan.end < until ? plan.end : until
  for (let k = 0; k < MAX_INSTALMENTS; k++) {
    const d = addMonths(plan.start, k * MONTHS[plan.frequency])
    if (d > limit) break
    out.push(d)
  }
  return out
}

export function nextInstalment(plan: PacPlan, after: string): string | null {
  for (let k = 0; k < MAX_INSTALMENTS; k++) {
    const d = addMonths(plan.start, k * MONTHS[plan.frequency])
    if (plan.end && d > plan.end) return null
    if (d > after) return d
  }
  return null
}

// closes: ascending by date, one per trading day
export function computePac(plan: PacPlan, closes: { date: string; close: number }[], today: string): PacResult {
  const instalments: PacInstalment[] = []
  let pending = 0
  let i = 0
  pacSchedule(plan, today).forEach((date, k) => {
    while (i < closes.length && closes[i].date < date) i++
    const bar = closes[i]
    if (!bar) { pending++; return }
    const amount = plan.amount + (k === 0 ? plan.initial ?? 0 : 0)
    instalments.push({ date, execDate: bar.date, price: bar.close, amount, units: amount / bar.close })
  })
  const quantity = instalments.reduce((s, x) => s + x.units, 0)
  const invested = instalments.reduce((s, x) => s + x.amount, 0)
  return {
    instalments,
    count: instalments.length,
    quantity: round(quantity, 6),
    invested: round(invested, 2),
    avgPrice: quantity > 0 ? round(invested / quantity, 6) : 0,
    pending,
    next: nextInstalment(plan, today),
  }
}

function round(n: number, digits: number) {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

export function pacQuery(p: PacPlan & { symbol: string }) {
  const q = new URLSearchParams({ symbol: p.symbol, amount: String(p.amount), frequency: p.frequency, start: p.start })
  if (p.end) q.set('end', p.end)
  if (p.initial) q.set('initial', String(p.initial))
  return `/api/market/pac?${q}`
}
