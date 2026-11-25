'use client'

// Single live-quote engine for the whole app.
// Components declare the symbols they need with useLiveQuotes(); one poller fetches the union
// every POLL_MS, pauses while the tab is hidden, refreshes on focus/reconnect, and backs off on errors.
// Results land in the Zustand store (quotes, feedStatus, lastUpdate).

import { useEffect } from 'react'
import { usePortfolioStore } from '@/lib/store'
import type { Quote } from '@/types'
import type { RawQuote } from '@/lib/yahooQuote'

const POLL_MS = 5000
const MAX_BACKOFF_MS = 60000
const CHUNK_SIZE = 60 // must match the cap in /api/market/quotes-batch

const subscribers = new Map<number, string[]>()
let nextId = 0
let timer: ReturnType<typeof setTimeout> | null = null
let polling = false
let refreshRequested = false
let failures = 0
let listenersAttached = false

function allSymbols(): string[] {
  return [...new Set([...subscribers.values()].flat())]
}

function toQuote(q: RawQuote): Quote {
  return {
    symbol: q.symbol,
    price: q.c,
    change: q.d,
    changePercent: q.dp,
    high: q.h,
    low: q.l,
    open: q.o,
    previousClose: q.pc,
    timestamp: Date.now(),
    marketTime: q.t,
    marketState: q.ms,
    currency: q.cur,
  }
}

async function fetchChunk(symbols: string[]): Promise<Record<string, RawQuote>> {
  const r = await fetch(`/api/market/quotes-batch?symbols=${encodeURIComponent(symbols.join(','))}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`quotes-batch ${r.status}`)
  const d = await r.json()
  return d.quotes ?? {}
}

async function poll() {
  timer = null
  const store = usePortfolioStore.getState()
  const symbols = allSymbols()
  if (!symbols.length) return
  if (document.hidden) {
    store.setFeedStatus('paused')
    return
  }

  polling = true
  try {
    const chunks: string[][] = []
    for (let i = 0; i < symbols.length; i += CHUNK_SIZE) chunks.push(symbols.slice(i, i + CHUNK_SIZE))
    const results = await Promise.all(chunks.map(fetchChunk))

    const quotes: Record<string, Quote> = {}
    results.forEach(raw => Object.values(raw).forEach(q => { quotes[q.symbol] = toQuote(q) }))
    if (!Object.keys(quotes).length) throw new Error('no quotes returned')

    store.updateQuotes(quotes)
    store.setFeedStatus('live', Date.now())
    failures = 0
  } catch {
    failures++
    store.setFeedStatus('error')
  } finally {
    polling = false
    schedule(refreshRequested ? 0 : undefined)
    refreshRequested = false
  }
}

function schedule(delay?: number) {
  if (timer) clearTimeout(timer)
  timer = null
  if (!subscribers.size || document.hidden) return
  const wait = delay ?? (failures ? Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS) : POLL_MS)
  timer = setTimeout(poll, wait)
}

function refreshNow() {
  // A poll in progress will reschedule itself immediately when done
  if (polling) refreshRequested = true
  else schedule(0)
}

function attachListeners() {
  if (listenersAttached) return
  listenersAttached = true
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (timer) clearTimeout(timer)
      timer = null
      usePortfolioStore.getState().setFeedStatus('paused')
    } else {
      refreshNow()
    }
  })
  window.addEventListener('online', () => { failures = 0; refreshNow() })
  window.addEventListener('offline', () => usePortfolioStore.getState().setFeedStatus('error'))
}

/** Subscribe the calling component to live quotes for `symbols`. Read prices from usePortfolioStore(s => s.quotes). */
export function useLiveQuotes(symbols: string[]) {
  const key = [...new Set(symbols.filter(Boolean))].sort().join(',')

  useEffect(() => {
    if (!key) return
    const id = nextId++
    subscribers.set(id, key.split(','))
    attachListeners()
    refreshNow()
    return () => {
      subscribers.delete(id)
      if (!subscribers.size && timer) {
        clearTimeout(timer)
        timer = null
      }
    }
  }, [key])
}
