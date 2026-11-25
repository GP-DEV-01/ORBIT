import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ isin: null })

  try {
    // Try OpenFIGI (free, no key needed for basic usage)
    const r = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType: 'TICKER', idValue: symbol.toUpperCase() }]),
    })
    if (r.ok) {
      const d = await r.json()
      const isin = d?.[0]?.data?.[0]?.isin ?? null
      if (isin) return NextResponse.json({ isin })
    }
  } catch { /* fallthrough */ }

  try {
    // Fallback: Yahoo Finance v7
    const r = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&fields=isin`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const d = await r.json()
    const isin = d?.quoteResponse?.result?.[0]?.isin ?? null
    if (isin) return NextResponse.json({ isin })
  } catch { /* fallthrough */ }

  return NextResponse.json({ isin: null })
}
