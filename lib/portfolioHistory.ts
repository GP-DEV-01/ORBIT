// Server-only: reconstructed portfolio value history = today's quantities × historical closes (Yahoo v8).
// It ignores past buys/sells, so it is an estimate; recorded snapshots are the real growth.

export type HistoryRange = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y'

const RANGES: Record<HistoryRange, { days: number; interval: '1d' | '1wk' | '1mo' }> = {
  '1M': { days: 31, interval: '1d' },
  '3M': { days: 92, interval: '1d' },
  '6M': { days: 183, interval: '1d' },
  '1Y': { days: 366, interval: '1wk' },
  '2Y': { days: 731, interval: '1wk' },
  '5Y': { days: 1827, interval: '1mo' },
}

export function parseHoldings(param: string | null) {
  if (!param) return []
  return param.split(',').map(h => {
    const [symbol, qty] = h.split(':')
    return { symbol: symbol.trim(), quantity: parseFloat(qty) || 0 }
  }).filter(h => h.symbol && h.quantity > 0)
}

export async function reconstructHistory(
  holdings: { symbol: string; quantity: number }[],
  range: string = '1Y',
): Promise<{ date: string; value: number }[]> {
  if (!holdings.length) return []

  const { days, interval } = RANGES[range as HistoryRange] ?? RANGES['1Y']
  const now = Math.floor(Date.now() / 1000)
  const from = now - days * 86400

  // symbol → { 'YYYY-MM-DD' → close }
  const priceMap: Record<string, Record<string, number>> = {}

  await Promise.allSettled(
    holdings.map(async ({ symbol }) => {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${from}&period2=${now}&interval=${interval}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 900 } }
      )
      const d = await r.json()
      const result = d?.chart?.result?.[0]
      if (!result) return
      const timestamps: number[] = result.timestamp ?? []
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
      // Bars are stamped at local midnight/open of each exchange (e.g. Milan = 22:00 UTC the day before).
      // Shift by the exchange offset so the same trading day gets the same key on every exchange.
      const offset: number = result.meta?.gmtoffset ?? 0
      const series: Record<string, number> = {}
      timestamps.forEach((ts, i) => {
        const price = closes[i]
        if (price != null && price > 0) {
          series[new Date((ts + offset) * 1000).toISOString().slice(0, 10)] = price
        }
      })
      priceMap[symbol] = series
    })
  )

  const symbols = holdings.filter(h => priceMap[h.symbol] && Object.keys(priceMap[h.symbol]).length)
  if (!symbols.length) return []

  const dates = Array.from(new Set(symbols.flatMap(h => Object.keys(priceMap[h.symbol])))).sort()

  // Forward-fill each symbol's last known price (holidays differ across exchanges),
  // and start only once every symbol has a price — otherwise the line jumps when one appears.
  const last: Record<string, number> = {}
  const history: { date: string; value: number }[] = []
  for (const date of dates) {
    for (const { symbol } of symbols) {
      const p = priceMap[symbol][date]
      if (p) last[symbol] = p
    }
    if (symbols.some(h => last[h.symbol] === undefined)) continue
    const value = symbols.reduce((s, h) => s + last[h.symbol] * h.quantity, 0)
    history.push({ date, value: Math.round(value * 100) / 100 })
  }
  return history
}
