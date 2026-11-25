export interface Instrument {
  symbol: string
  name: string
  type: 'stock' | 'crypto' | 'forex' | 'etf' | 'index'
  exchange?: string
}

export interface PortfolioItem {
  id: string
  user_id: string
  symbol: string
  name: string
  type: string
  quantity: number
  avg_price: number
  isin?: string
  position?: 'long' | 'short'
  currency?: string
  created_at: string
  // PAC (piano di accumulo) — when is_pac, quantity/avg_price are derived from the plan (lib/pac.ts)
  is_pac?: boolean
  pac_amount?: number | null
  pac_frequency?: PacFrequency | null
  pac_start?: string | null
  pac_end?: string | null
  pac_initial?: number | null
}

export type PacFrequency = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual'

export interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  previousClose: number
  timestamp: number
  marketTime?: number                                   // exchange timestamp of the price (ms)
  marketState?: 'pre' | 'regular' | 'post' | 'closed'
  currency?: string
}

export interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface NewsItem {
  id: string
  headline: string
  summary: string
  source: string
  url: string
  datetime: number
  image?: string
  category?: string
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'ALL'
