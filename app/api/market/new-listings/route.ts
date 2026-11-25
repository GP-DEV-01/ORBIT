import { NextResponse } from 'next/server'

// GET /api/market/new-listings — IPOs of the last 60 days and the next 30 (Finnhub calendar, mainly US venues).
// Listed ones ("priced" with a past date) can be added to the portfolio right away.

interface FinnhubIpo {
  symbol?: string | null
  name?: string
  date?: string
  exchange?: string
  price?: string | null
  status?: 'expected' | 'priced' | 'withdrawn' | 'filed'
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return NextResponse.json({ listings: [] })

  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
  const today = day(0)
  try {
    const r = await fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${day(-60)}&to=${day(30)}&token=${apiKey}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    })
    const d = await r.json()
    const listings = ((d?.ipoCalendar ?? []) as FinnhubIpo[])
      .filter(x => x.symbol && x.name && x.date && x.status !== 'withdrawn')
      .map(x => ({
        symbol: x.symbol!,
        name: x.name!,
        date: x.date!,
        exchange: x.exchange ?? '',
        price: x.price ?? null,
        listed: x.status === 'priced' && x.date! <= today,
      }))
      // Upcoming first (soonest on top), then the recent ones (newest on top)
      .sort((a, b) => Number(a.listed) - Number(b.listed) || (a.listed ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
    return NextResponse.json({ listings })
  } catch {
    return NextResponse.json({ listings: [] })
  }
}
