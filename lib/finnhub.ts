const API_KEY = process.env.FINNHUB_API_KEY
const BASE_URL = 'https://finnhub.io/api/v1'

export async function searchSymbol(query: string) {
  const res = await fetch(
    `${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${API_KEY}`
  )
  const data = await res.json()
  return data.result || []
}

export async function getQuote(symbol: string) {
  const res = await fetch(
    `${BASE_URL}/quote?symbol=${symbol}&token=${API_KEY}`
  )
  return res.json()
}

export async function getCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
) {
  const res = await fetch(
    `${BASE_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${API_KEY}`
  )
  return res.json()
}

export async function getCryptoCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
) {
  const res = await fetch(
    `${BASE_URL}/crypto/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${API_KEY}`
  )
  return res.json()
}

export async function getMarketNews(category: string = 'general') {
  const res = await fetch(
    `${BASE_URL}/news?category=${category}&token=${API_KEY}`
  )
  return res.json()
}

export async function getCompanyNews(symbol: string, from: string, to: string) {
  const res = await fetch(
    `${BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${API_KEY}`
  )
  return res.json()
}

export function getResolutionAndRange(timeRange: string): {
  resolution: string
  from: number
  to: number
} {
  const now = Math.floor(Date.now() / 1000)
  const ranges: Record<string, { resolution: string; seconds: number }> = {
    '1D': { resolution: '5', seconds: 86400 },
    '1W': { resolution: '30', seconds: 604800 },
    '1M': { resolution: 'D', seconds: 2592000 },
    '3M': { resolution: 'D', seconds: 7776000 },
    '6M': { resolution: 'W', seconds: 15552000 },
    '1Y': { resolution: 'W', seconds: 31536000 },
    '5Y': { resolution: 'M', seconds: 157680000 },
    ALL: { resolution: 'M', seconds: 315360000 },
  }
  const { resolution, seconds } = ranges[timeRange] || ranges['1M']
  return { resolution, from: now - seconds, to: now }
}
