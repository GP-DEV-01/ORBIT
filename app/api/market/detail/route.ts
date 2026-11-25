import { NextRequest, NextResponse } from 'next/server'

const FINNHUB = process.env.FINNHUB_API_KEY

async function fh(path: string) {
  const r = await fetch(`https://finnhub.io/api/v1${path}&token=${FINNHUB}`)
  return r.json()
}

async function yf(symbol: string) {
  const now = Math.floor(Date.now() / 1000)
  const r = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${now - 86400 * 2}&period2=${now}&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 30 } }
  )
  const d = await r.json()
  return d?.chart?.result?.[0]?.meta ?? {}
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })

  try {
    // Start peers fetch immediately so peer quotes can be kicked off earlier
    const peersPromise = fh(`/stock/peers?symbol=${symbol}`)

    const [profile, metricsRaw, newsRaw, earnings, quote, peersRaw] = await Promise.allSettled([
      fh(`/stock/profile2?symbol=${symbol}`),
      fh(`/stock/metric?symbol=${symbol}&metric=all`),
      fh(`/company-news?symbol=${symbol}&from=${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}`),
      fh(`/stock/earnings?symbol=${symbol}`),
      yf(symbol),
      peersPromise,
    ])

    const p = profile.status === 'fulfilled' ? profile.value : {}
    const m = metricsRaw.status === 'fulfilled' ? (metricsRaw.value?.metric ?? {}) : {}
    const peerList = peersRaw.status === 'fulfilled' ? (Array.isArray(peersRaw.value) ? peersRaw.value.filter((s: string) => s !== symbol).slice(0, 8) : []) : []
    const news = newsRaw.status === 'fulfilled' ? (Array.isArray(newsRaw.value) ? newsRaw.value.slice(0, 6) : []) : []
    const earningsList = earnings.status === 'fulfilled' ? (Array.isArray(earnings.value) ? earnings.value.slice(0, 4) : []) : []
    const meta = quote.status === 'fulfilled' ? quote.value : {}

    const price = meta.regularMarketPrice ?? 0
    const prev = meta.chartPreviousClose ?? price
    const change = price - prev
    const changePct = prev > 0 ? (change / prev) * 100 : 0

    // Fetch peer quotes in parallel — single timestamp for consistent cache URLs
    const peerNow = Math.floor(Date.now() / 1000)
    const peerQuotes = await Promise.allSettled(
      peerList.map(async (s: string) => {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s}?period1=${peerNow - 86400 * 2}&period2=${peerNow}&interval=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 30 } })
        const d = await r.json()
        const mm = d?.chart?.result?.[0]?.meta ?? {}
        const pp = mm.regularMarketPrice ?? 0
        const ppc = mm.chartPreviousClose ?? pp
        return { symbol: s, price: pp, changePct: ppc > 0 ? ((pp - ppc) / ppc) * 100 : 0 }
      })
    )

    return NextResponse.json({
      profile: {
        name: p.name ?? symbol,
        logo: p.logo ?? '',
        exchange: p.exchange ?? meta.exchangeName ?? '',
        industry: p.finnhubIndustry ?? '',
        country: p.country ?? '',
        currency: p.currency ?? 'USD',
        ipo: p.ipo ?? '',
        website: p.weburl ?? '',
        description: p.description ?? '',
        marketCap: p.marketCapitalization ?? 0,
        shareOutstanding: p.shareOutstanding ?? 0,
      },
      quote: { price, change, changePct },
      metrics: {
        pe: m.peBasicExclExtraTTM ?? m.peNormalizedAnnual ?? null,
        pb: m.pbAnnual ?? m.pbQuarterly ?? null,
        ps: m.psAnnual ?? null,
        eps: m.epsBasicExclExtraItemsTTM ?? m.epsNormalizedAnnual ?? null,
        roe: m.roeRfy ?? m.roeTTM ?? null,
        roa: m.roaRfy ?? m.roaTTM ?? null,
        debtEquity: m.totalDebt_totalEquityAnnual ?? null,
        grossMargin: m.grossMarginTTM ?? m.grossMarginAnnual ?? null,
        operatingMargin: m.operatingMarginTTM ?? m.operatingMarginAnnual ?? null,
        netMargin: m.netProfitMarginTTM ?? m.netProfitMarginAnnual ?? null,
        revenueGrowth: m.revenueGrowthTTMYoy ?? null,
        earningsGrowth: m.epsGrowthTTMYoy ?? null,
        beta: m.beta ?? null,
        high52: m['52WeekHigh'] ?? null,
        low52: m['52WeekLow'] ?? null,
        avgVolume10d: m['10DayAverageTradingVolume'] ?? null,
        avgVolume3m: m['3MonthAverageTradingVolume'] ?? null,
        dividendYield: m.currentDividendYieldTTM ?? null,
        payoutRatio: m.payoutRatioAnnual ?? null,
        bookValuePerShare: m.bookValuePerShareAnnual ?? null,
        cashPerShare: m.cashPerSharePerShareAnnual ?? null,
        fcfPerShare: m.cashFlowPerShareAnnual ?? null,
        priceReturn52w: m['52WeekPriceReturnDaily'] ?? null,
        priceReturn13w: m['13WeekPriceReturnDaily'] ?? null,
      },
      peers: peerQuotes
        .filter((r): r is PromiseFulfilledResult<{ symbol: string; price: number; changePct: number }> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(p => p.price > 0),
      news,
      earnings: earningsList,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch detail' }, { status: 500 })
  }
}
