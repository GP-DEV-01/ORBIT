// Server-only: live quotes from Yahoo Finance v8 chart meta.
// Yahoo updates regularMarketPrice within seconds, so the freshness bottleneck is our cache.
// A short in-memory cache + in-flight dedupe lets many clients poll fast without hammering Yahoo.

export type MarketState = 'pre' | 'regular' | 'post' | 'closed'

export interface RawQuote {
  symbol: string
  c: number        // price
  d: number        // change vs previous close
  dp: number       // change %
  h: number
  l: number
  o: number
  pc: number       // previous close
  t: number        // exchange timestamp of the price (ms)
  ms: MarketState
  cur?: string     // currency
}

const TTL_MS = 4000
const cache = new Map<string, { at: number; quote: RawQuote | null }>()
const inFlight = new Map<string, Promise<RawQuote | null>>()

interface TradingPeriod { start: number; end: number }

function marketState(periods: Record<string, TradingPeriod> | undefined, nowSec: number): MarketState {
  if (!periods) return 'closed'
  const within = (p?: TradingPeriod) => !!p && nowSec >= p.start && nowSec < p.end
  if (within(periods.regular)) return 'regular'
  if (within(periods.pre)) return 'pre'
  if (within(periods.post)) return 'post'
  return 'closed'
}

async function fetchFromYahoo(symbol: string): Promise<RawQuote | null> {
  // range=1d makes chartPreviousClose the previous session's close (a wider range shifts it back)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  })
  if (!r.ok) throw new Error(`Yahoo ${r.status} for ${symbol}`)
  const d = await r.json()
  const meta = d?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) return null

  const price: number = meta.regularMarketPrice
  const prev: number = meta.chartPreviousClose ?? meta.previousClose ?? price
  const change = price - prev

  return {
    symbol,
    c: price,
    d: change,
    dp: prev > 0 ? (change / prev) * 100 : 0,
    h: meta.regularMarketDayHigh ?? price,
    l: meta.regularMarketDayLow ?? price,
    o: meta.regularMarketOpen ?? price,
    pc: prev,
    t: (meta.regularMarketTime ?? 0) * 1000,
    ms: marketState(meta.currentTradingPeriod, Math.floor(Date.now() / 1000)),
    cur: meta.currency,
  }
}

export async function getQuote(symbol: string): Promise<RawQuote | null> {
  const hit = cache.get(symbol)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.quote

  const pending = inFlight.get(symbol)
  if (pending) return pending

  const p = fetchFromYahoo(symbol)
    .then(quote => {
      cache.set(symbol, { at: Date.now(), quote })
      return quote
    })
    .catch(() => hit?.quote ?? null) // on error, serve the last known value rather than nothing
    .finally(() => inFlight.delete(symbol))

  inFlight.set(symbol, p)
  return p
}

export async function getQuotes(symbols: string[]): Promise<Record<string, RawQuote>> {
  const results = await Promise.all(symbols.map(getQuote))
  const out: Record<string, RawQuote> = {}
  results.forEach(q => { if (q && q.c > 0) out[q.symbol] = q })
  return out
}
