'use client'

// Records today's net worth per currency into portfolio_snapshots while the dashboard is open.
// This is the real growth history: value AND invested capital, so deposits and sales show up.
// Writes only once every position has a live price (a fallback to avg_price would skew the value),
// then at most every 15 minutes — the last write of the day is effectively the close.

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { buildRows, totalsByCurrency, localDate } from '@/lib/portfolioMath'
import type { PortfolioItem, Quote } from '@/types'

const MIN_INTERVAL_MS = 15 * 60 * 1000

export function useSnapshotRecorder(userId: string | null, items: PortfolioItem[], quotes: Record<string, Quote>) {
  const lastWrite = useRef(0)
  const disabled = useRef(false)   // table missing (migration not run): stop trying

  useEffect(() => {
    if (!userId || !items.length || disabled.current) return
    if (Date.now() - lastWrite.current < MIN_INTERVAL_MS) return
    if (!items.every(i => quotes[i.symbol]?.price > 0)) return

    lastWrite.current = Date.now()
    const date = localDate()
    const totals = totalsByCurrency(buildRows(items, quotes))
    const rows = Object.entries(totals).map(([currency, v]) => ({
      user_id: userId,
      date,
      currency,
      value: Math.round(v.value * 100) / 100,
      cost: Math.round(v.cost * 100) / 100,
      positions: v.count,
      updated_at: new Date().toISOString(),
    }))

    supabase
      .from('portfolio_snapshots')
      .upsert(rows, { onConflict: 'user_id,date,currency' })
      .then(({ error }) => {
        if (!error) {
          // A currency sold out today must not keep this morning's value
          supabase.from('portfolio_snapshots').delete()
            .eq('user_id', userId).eq('date', date)
            .not('currency', 'in', `(${Object.keys(totals).map(c => `"${c}"`).join(',')})`)
            .then(() => {})
          return
        }
        if (error.code === '42P01' || error.code === 'PGRST205') disabled.current = true
        else lastWrite.current = Date.now() - MIN_INTERVAL_MS + 60_000 // transient: retry in a minute
      })
  }, [userId, items, quotes])
}
