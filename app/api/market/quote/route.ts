import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  try {
    // range=1d makes chartPreviousClose the previous session's close (a wider range shifts it back)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 5 },
    })
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta

    if (!meta) return NextResponse.json({ c: 0, d: 0, dp: 0 })

    const price = meta.regularMarketPrice ?? 0
    const prev = meta.chartPreviousClose ?? meta.previousClose ?? price
    const change = price - prev
    const changePct = prev > 0 ? (change / prev) * 100 : 0

    return NextResponse.json({
      c: price,
      d: change,
      dp: changePct,
      h: meta.regularMarketDayHigh ?? price,
      l: meta.regularMarketDayLow ?? price,
      o: meta.regularMarketOpen ?? price,
      pc: prev,
      name: meta.longName ?? meta.shortName ?? symbol,
    })
  } catch {
    return NextResponse.json({ c: 0, d: 0, dp: 0 })
  }
}
