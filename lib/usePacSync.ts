'use client'

// Keeps PAC positions current: quantity and average price are recomputed from the plan
// (every instalment due so far, bought at its historical close) and saved when they changed.
// Runs when the portfolio loads and again when the date changes with the dashboard still open.

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { usePortfolioStore } from '@/lib/store'
import { pacQuery, validPlan } from '@/lib/pac'
import { localDate } from '@/lib/portfolioMath'
import type { PortfolioItem } from '@/types'

const CHECK_EVERY_MS = 30 * 60 * 1000

export function usePacSync(items: PortfolioItem[]) {
  const updateItem = usePortfolioStore(s => s.updateItem)
  const done = useRef(new Set<string>())   // `${id}|${plan}|${day}` already synced

  useEffect(() => {
    let cancelled = false

    async function sync() {
      const day = localDate()
      for (const item of items) {
        if (!item.is_pac) continue
        const plan = {
          amount: Number(item.pac_amount),
          frequency: item.pac_frequency ?? undefined,
          start: item.pac_start ?? '',
          end: item.pac_end ?? null,
          initial: Number(item.pac_initial ?? 0),
        }
        if (!validPlan(plan)) continue
        const key = `${item.id}|${JSON.stringify(plan)}|${day}`
        if (done.current.has(key)) continue
        done.current.add(key)
        try {
          const r = await fetch(pacQuery({ ...plan, symbol: item.symbol }))
          if (!r.ok || cancelled) continue
          const res: { quantity: number; avgPrice: number; count: number } = await r.json()
          if (!res.count) continue
          const changed = Math.abs(res.quantity - item.quantity) > 1e-6 || Math.abs(res.avgPrice - item.avg_price) > 1e-6
          if (!changed) continue
          const { error } = await supabase.from('portfolios')
            .update({ quantity: res.quantity, avg_price: res.avgPrice })
            .eq('id', item.id)
          if (!error && !cancelled) updateItem(item.id, { quantity: res.quantity, avg_price: res.avgPrice })
        } catch {
          done.current.delete(key) // network error: retry on the next check
        }
      }
    }

    sync()
    const id = setInterval(sync, CHECK_EVERY_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [items, updateItem])
}
