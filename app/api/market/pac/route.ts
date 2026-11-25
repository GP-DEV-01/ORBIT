import { NextRequest, NextResponse } from 'next/server'
import { computePac, validPlan, type PacPlan } from '@/lib/pac'
import type { PacFrequency } from '@/types'

// GET /api/market/pac?symbol=VWCE.MI&amount=200&frequency=monthly&start=2024-01-15[&end=…][&initial=1000]
// Instalments executed so far at historical closes → units, invested capital, average price, next date.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const symbol = sp.get('symbol')?.trim()
  const plan: Partial<PacPlan> = {
    amount: parseFloat(sp.get('amount') ?? ''),
    frequency: sp.get('frequency') as PacFrequency,
    start: sp.get('start') ?? '',
    end: sp.get('end') || null,
    initial: sp.get('initial') ? parseFloat(sp.get('initial')!) : 0,
  }
  if (!symbol || !validPlan(plan)) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const now = Math.floor(Date.now() / 1000)
  const from = Math.floor(Date.parse(`${plan.start}T00:00:00Z`) / 1000) - 86400
  const today = new Date().toISOString().slice(0, 10)

  let closes: { date: string; close: number }[] = []
  let currency: string | null = null
  if (from < now) {
    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${from}&period2=${now}&interval=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 1800 } },
      )
      const result = (await r.json())?.chart?.result?.[0]
      if (!result) return NextResponse.json({ error: 'no_data' }, { status: 404 })
      currency = result.meta?.currency ?? null
      // Same day key on every exchange (bars are stamped at the exchange's local midnight)
      const offset: number = result.meta?.gmtoffset ?? 0
      const ts: number[] = result.timestamp ?? []
      const cl: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
      const seen = new Set<string>()
      ts.forEach((t, i) => {
        const c = cl[i]
        const date = new Date((t + offset) * 1000).toISOString().slice(0, 10)
        if (c != null && c > 0 && !seen.has(date)) { seen.add(date); closes.push({ date, close: c }) }
      })
      closes = closes.sort((a, b) => a.date.localeCompare(b.date))
    } catch {
      return NextResponse.json({ error: 'no_data' }, { status: 502 })
    }
  }

  return NextResponse.json({ ...computePac(plan, closes, today), currency })
}
