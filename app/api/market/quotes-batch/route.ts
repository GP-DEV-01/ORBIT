import { NextRequest, NextResponse } from 'next/server'
import { getQuotes } from '@/lib/yahooQuote'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const symbolsParam = req.nextUrl.searchParams.get('symbols')
  if (!symbolsParam) return NextResponse.json({ quotes: {} })

  const symbols = [...new Set(symbolsParam.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 60)
  const quotes = await getQuotes(symbols)

  return NextResponse.json(
    { quotes, serverTime: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
