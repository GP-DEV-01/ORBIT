import { NextRequest, NextResponse } from 'next/server'
import { parseHoldings, reconstructHistory } from '@/lib/portfolioHistory'

// GET /api/market/portfolio-history?holdings=AAPL:10,MSFT:5&range=1Y
// Returns portfolio value history (daily / weekly / monthly depending on range)

export async function GET(req: NextRequest) {
  const holdings = parseHoldings(req.nextUrl.searchParams.get('holdings'))
  const range = req.nextUrl.searchParams.get('range') ?? '1Y'
  return NextResponse.json({ history: await reconstructHistory(holdings, range) })
}
