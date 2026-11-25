import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQuotes } from '@/lib/yahooQuote'
import { reconstructHistory } from '@/lib/portfolioHistory'
import { buildRows, positionHeaders, totalsByCurrency, mergeGrowth, localDate, type PriceQuote, type Snapshot } from '@/lib/portfolioMath'
import { t as translate, type Language } from '@/lib/i18n'
import type { PortfolioItem } from '@/types'

// GET /api/feed/<token>/positions.csv?lang=IT  — live positions with current prices
// GET /api/feed/<token>/history.csv?lang=IT    — net worth vs invested over time, per currency
//
// Meant for Google Sheets =IMPORTDATA(url; ","; "en_US") and Excel Data → From Web.
// No user session here: the token is resolved by SECURITY DEFINER functions (see supabase-schema.sql).
// Plain CSV: comma separator, dot decimals, ISO dates, percentages as numbers (1.5 = 1.5%).

const LANGS: Language[] = ['EN', 'IT', 'ES', 'FR', 'DE']

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function csv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    if (v == null) return ''
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6)
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  return rows.map(r => r.map(cell).join(',')).join('\r\n')
}

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'private, max-age=60',
      'X-Robots-Tag': 'noindex',
    },
  })
}

const pct = (n: number | null) => (n == null ? null : Math.round(n * 10000) / 100)

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; file: string }> }) {
  const { token, file } = await params
  const langParam = (req.nextUrl.searchParams.get('lang') ?? 'EN').toUpperCase() as Language
  const lang = LANGS.includes(langParam) ? langParam : 'EN'
  const t = (key: string) => translate(lang, key)

  if (file !== 'positions.csv' && file !== 'history.csv') return text('Not found', 404)
  if (!/^[a-f0-9]{32,128}$/.test(token)) return text('Invalid link', 404)

  const supabase = db()
  const { data: items, error } = await supabase.rpc('feed_positions', { p_token: token })
  if (error) return text('Live links are not enabled', 503)
  if (!items?.length) {
    // Unknown token and empty portfolio look the same from here — only the owner can tell them apart
    const { data: snaps } = await supabase.rpc('feed_snapshots', { p_token: token })
    if (!snaps?.length) return text('Invalid or revoked link', 404)
  }

  const portfolio = (items ?? []) as PortfolioItem[]
  const raw = await getQuotes([...new Set(portfolio.map(i => i.symbol))])
  const quotes: Record<string, PriceQuote> = {}
  Object.values(raw).forEach(q => { quotes[q.symbol] = { price: q.c, changePercent: q.dp, currency: q.cur } })
  const rows = buildRows(portfolio, quotes)

  if (file === 'positions.csv') {
    const headers = positionHeaders(t)
    headers[9] += ' %'
    headers[14] += ' %'
    return text(csv([
      headers,
      ...rows.map(r => [
        r.symbol, r.name, r.type, r.isin, r.position, r.currency, r.quantity,
        r.avgPrice, r.price, pct(r.dayChangePct), r.value, r.cost, r.pnl, pct(r.pnlPct), pct(r.weight),
      ]),
    ]), 200)
  }

  // history.csv
  const { data: snaps } = await supabase.rpc('feed_snapshots', { p_token: token })
  const byCurrency: Record<string, { symbol: string; quantity: number }[]> = {}
  rows.forEach(r => (byCurrency[r.currency] ??= []).push({ symbol: r.symbol, quantity: r.quantity }))
  const estimated: Record<string, { date: string; value: number }[]> = {}
  await Promise.all(Object.entries(byCurrency).map(async ([cur, h]) => { estimated[cur] = await reconstructHistory(h, '1Y') }))

  const today = localDate()
  const live = Object.entries(totalsByCurrency(rows)).map(([currency, v]) => ({ date: today, currency, value: v.value, cost: v.cost }))
  const growth = mergeGrowth([...((snaps ?? []) as Snapshot[]).filter(s => s.date !== today), ...live], estimated)

  return text(csv([
    [t('exp_date'), t('exp_currency'), t('value'), t('exp_invested'), t('pnl'), `${t('pnl')} %`, t('exp_source')],
    ...growth.map(p => {
      const pnl = p.cost == null ? null : p.value - p.cost
      return [
        p.date, p.currency, Math.round(p.value * 100) / 100, p.cost,
        pnl == null ? null : Math.round(pnl * 100) / 100, pnl == null || !p.cost ? null : pct(pnl / p.cost),
        t(p.source === 'real' ? 'exp_real' : 'exp_estimated'),
      ]
    }),
  ]), 200)
}
