import { NextRequest, NextResponse } from 'next/server'
import { RSS_SOURCES, type NewsCountry } from '@/lib/newsSources'
import { classifyNews, type NewsCategory } from '@/lib/newsCategories'
import { fetchFeed, type FeedItem } from '@/lib/rss'

// GET /api/news?country=IT   (country omitted or "ALL" = every country)

const API_KEY = process.env.FINNHUB_API_KEY
const FINNHUB_CATEGORIES = ['general', 'forex', 'crypto', 'merger']
const MAX_ITEMS = 150
const MAX_ITEMS_ALL = 400

export interface NewsItem extends FeedItem {
  id: string
  country: NewsCountry
  category: NewsCategory
}

async function fetchFinnhub(): Promise<FeedItem[]> {
  if (!API_KEY) return []
  const results = await Promise.allSettled(
    FINNHUB_CATEGORIES.map(async cat => {
      const res = await fetch(`https://finnhub.io/api/v1/news?category=${cat}&minId=0&token=${API_KEY}`, {
        next: { revalidate: 180 },
      })
      const data = await res.json()
      return (Array.isArray(data) ? data : []).map((item: {
        headline?: string; summary?: string; source?: string; url?: string; datetime?: number; image?: string
      }) => ({
        headline: item.headline || '',
        summary: item.summary || '',
        source: item.source || 'Finnhub',
        url: item.url || '',
        datetime: item.datetime || 0,
        image: item.image || '',
      }))
    })
  )
  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
}

export async function GET(req: NextRequest) {
  const param = (req.nextUrl.searchParams.get('country') ?? 'ALL').toUpperCase()
  const country = param === 'ALL' ? null : (param as NewsCountry)

  const sources = RSS_SOURCES.filter(s => !country || s.country === country)
  const tasks: Promise<{ country: NewsCountry; items: FeedItem[] }>[] = sources.map(s =>
    fetchFeed(s).then(items => ({ country: s.country, items }))
  )
  if (!country || country === 'GLOBAL') {
    tasks.push(fetchFinnhub().then(items => ({ country: 'GLOBAL' as const, items })))
  }

  const settled = await Promise.allSettled(tasks)
  const failed = settled.filter(r => r.status === 'rejected').length

  // Deduplicate by URL and by headline (the same story often appears in two feeds of one outlet)
  const seen = new Set<string>()
  const news: NewsItem[] = []
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue
    for (const item of r.value.items) {
      if (/^PDF:/i.test(item.headline)) continue // Handelsblatt e-paper entries
      const key = item.headline.toLowerCase()
      if (seen.has(item.url) || seen.has(key)) continue
      seen.add(item.url)
      seen.add(key)
      news.push({
        ...item,
        id: item.url,
        country: r.value.country,
        category: classifyNews(item.headline, item.summary),
      })
    }
  }

  news.sort((a, b) => b.datetime - a.datetime)

  return NextResponse.json({ news: news.slice(0, country ? MAX_ITEMS : MAX_ITEMS_ALL), failedSources: failed })
}
