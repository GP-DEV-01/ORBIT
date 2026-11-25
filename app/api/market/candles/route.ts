import { NextRequest, NextResponse } from 'next/server'
import { CandleData } from '@/types'

function getIntervalAndRange(range: string): { interval: string; from: number } {
  const now = Math.floor(Date.now() / 1000)
  const map: Record<string, { interval: string; seconds: number }> = {
    '1D':  { interval: '5m',  seconds: 86400 },
    '1W':  { interval: '30m', seconds: 604800 },
    '1M':  { interval: '1d',  seconds: 2592000 },
    '3M':  { interval: '1d',  seconds: 7776000 },
    '6M':  { interval: '1wk', seconds: 15552000 },
    '1Y':  { interval: '1wk', seconds: 31536000 },
    '5Y':  { interval: '1mo', seconds: 157680000 },
    'ALL': { interval: '1mo', seconds: 315360000 },
  }
  const { interval, seconds } = map[range] ?? map['1M']
  return { interval, from: now - seconds }
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const range = req.nextUrl.searchParams.get('range') || '1M'
  if (!symbol) return NextResponse.json({ candles: [] }, { status: 400 })

  const { interval, from } = getIntervalAndRange(range)
  const now = Math.floor(Date.now() / 1000)

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${from}&period2=${now}&interval=${interval}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    })
    const data = await res.json()

    const result = data?.chart?.result?.[0]
    if (!result) return NextResponse.json({ candles: [] })

    const timestamps: number[] = result.timestamp ?? []
    const ohlcv = result.indicators?.quote?.[0]
    if (!ohlcv || timestamps.length === 0) return NextResponse.json({ candles: [] })

    const candles: CandleData[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const o = ohlcv.open?.[i]
      const h = ohlcv.high?.[i]
      const l = ohlcv.low?.[i]
      const c = ohlcv.close?.[i]
      if (o == null || h == null || l == null || c == null) continue
      candles.push({ time: timestamps[i], open: o, high: h, low: l, close: c })
    }

    return NextResponse.json({ candles })
  } catch {
    return NextResponse.json({ candles: [] })
  }
}
