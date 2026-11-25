import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  const fields = [
    'navPrice', 'previousClose', 'regularMarketPrice', 'regularMarketChange',
    'regularMarketChangePercent', 'annualReportExpenseRatio', 'categoryName',
    'fundFamily', 'totalAssets', 'fundInceptionDate', 'ytdReturn',
    'threeYearAverageReturn', 'fiveYearAverageReturn', 'morningStarOverallRating',
    'morningStarRiskRating', 'beta3Year', 'currency', 'exchange', 'quoteType',
    'longName', 'shortName',
  ].join(',')

  const [yahooRes, msRes, navHistoryRes] = await Promise.allSettled([
    // Yahoo Finance v7 — fund-specific fields
    fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&fields=${fields}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ).then(r => r.json()),

    // Morningstar global — rating, category, TER, ISIN
    fetch(
      `https://global.morningstar.com/api/v2/search/securities?term=${encodeURIComponent(symbol)}&limit=3&languageId=it&currencyId=EUR`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://global.morningstar.com/it',
          'Accept': 'application/json',
          'Accept-Language': 'it-IT,it;q=0.9',
        },
      }
    ).then(r => r.json()),

    // Yahoo Finance v8 chart — NAV history (36 months) for performance chart
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Math.floor(Date.now() / 1000) - 86400 * 365 * 3}&period2=${Math.floor(Date.now() / 1000)}&interval=1mo`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 } }
    ).then(r => r.json()),
  ])

  const yq = yahooRes.status === 'fulfilled'
    ? (yahooRes.value?.quoteResponse?.result?.[0] ?? {})
    : {}

  const msResults = msRes.status === 'fulfilled'
    ? (msRes.value?.results ?? msRes.value?.hits ?? [])
    : []

  // Best Morningstar match by ticker or ISIN
  const ms = msResults.find((r: { ticker?: string; isin?: string }) =>
    r.ticker?.toUpperCase() === symbol.toUpperCase() ||
    r.isin?.toUpperCase() === symbol.toUpperCase()
  ) ?? msResults[0] ?? {}

  // Monthly NAV history for mini chart
  let navHistory: { date: string; nav: number }[] = []
  if (navHistoryRes.status === 'fulfilled') {
    const chart = navHistoryRes.value?.chart?.result?.[0]
    const timestamps: number[] = chart?.timestamp ?? []
    const closes: number[] = chart?.indicators?.quote?.[0]?.close ?? []
    navHistory = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().split('T')[0], nav: closes[i] }))
      .filter(p => p.nav != null && p.nav > 0)
  }

  const nav = yq.navPrice ?? yq.regularMarketPrice ?? 0
  const prevClose = yq.previousClose ?? nav
  const change = nav - prevClose
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0

  return NextResponse.json({
    name: yq.longName ?? yq.shortName ?? ms.name ?? symbol,
    nav,
    change,
    changePct,
    currency: yq.currency ?? ms.currency ?? 'EUR',
    ter: yq.annualReportExpenseRatio != null
      ? yq.annualReportExpenseRatio * 100  // Yahoo returns as decimal (0.0004)
      : (ms.ongoingCharge ?? null),
    category: yq.categoryName ?? ms.category ?? ms.categoryName ?? null,
    fundFamily: yq.fundFamily ?? ms.brandingCompanyName ?? ms.companyName ?? null,
    totalAssets: yq.totalAssets ?? null,
    inceptionDate: yq.fundInceptionDate
      ? new Date(yq.fundInceptionDate * 1000).toISOString().split('T')[0]
      : (ms.inceptionDate ?? null),
    // Performance
    ytdReturn: yq.ytdReturn != null ? yq.ytdReturn * 100 : null,
    return1y: (() => {
      if (navHistory.length < 2) return null
      // Use the point closest to 12 months ago (at index -12 if available, else earliest)
      const refIdx = navHistory.length >= 12 ? navHistory.length - 12 : 0
      const ref = navHistory[refIdx].nav
      const last = navHistory.at(-1)!.nav
      return ref > 0 ? ((last - ref) / ref) * 100 : null
    })(),
    return3y: yq.threeYearAverageReturn != null ? yq.threeYearAverageReturn * 100 : null,
    return5y: yq.fiveYearAverageReturn != null ? yq.fiveYearAverageReturn * 100 : null,
    // Morningstar
    starRating: yq.morningStarOverallRating ?? ms.starRating ?? null,
    riskRating: yq.morningStarRiskRating ?? null,
    // ISIN from Morningstar
    isin: ms.isin ?? null,
    morningstarId: ms.id ?? ms.secId ?? null,
    // NAV history
    navHistory: navHistory.slice(-36), // last 36 months
  })
}
