// Server-only RSS/Atom reader for the news feed.
import { XMLParser } from 'fast-xml-parser'
import type { NewsSource } from '@/lib/newsSources'

export interface FeedItem {
  headline: string
  summary: string
  url: string
  datetime: number // unix seconds
  image: string
  source: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: true,
  htmlEntities: true,
})

const MAX_PER_FEED = 25

type Node = string | number | { '#text'?: string; [k: string]: unknown } | undefined

function text(n: Node | Node[]): string {
  if (Array.isArray(n)) return text(n[0])
  if (n == null) return ''
  if (typeof n === 'object') return String(n['#text'] ?? '')
  return String(n)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&(amp|quot|apos|lt|gt);/g, (_, e) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[e as string] ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function findImage(item: Record<string, unknown>, rawDescription: string): string {
  const candidates = [item['media:content'], item['media:thumbnail'], item.enclosure, item['media:group']]
  for (const c of candidates) {
    const list = Array.isArray(c) ? c : [c]
    for (const el of list) {
      if (el && typeof el === 'object') {
        const obj = el as Record<string, unknown>
        const url = obj['@_url'] ?? (obj['media:content'] as Record<string, unknown> | undefined)?.['@_url']
        const type = String(obj['@_type'] ?? obj['@_medium'] ?? 'image')
        if (typeof url === 'string' && /image|jpe?g|png|webp/i.test(type + url)) return url
      }
    }
  }
  return rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? ''
}

// Some feeds (e.g. ISO-8859-1) are not UTF-8: honour the XML declaration's encoding
async function decode(res: Response): Promise<string> {
  const buf = await res.arrayBuffer()
  const head = new TextDecoder('ascii').decode(buf.slice(0, 200))
  const enc = head.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(enc).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

export async function fetchFeed(source: NewsSource): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ORBIT/1.0)' },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`${source.name}: HTTP ${res.status}`)
  const xml = parser.parse(await decode(res))

  const rssItems = xml?.rss?.channel?.item ?? xml?.['rdf:RDF']?.item
  const atomItems = xml?.feed?.entry
  const raw: Record<string, unknown>[] = [].concat(rssItems ?? atomItems ?? [])

  return raw.slice(0, MAX_PER_FEED).map(item => {
    const rawDesc = text((item.description ?? item.summary ?? item['content:encoded'] ?? item.content) as Node)
    const link = item.link
    const url = typeof link === 'object' && link && !Array.isArray(link)
      ? String((link as Record<string, unknown>)['@_href'] ?? text(link as Node))
      : Array.isArray(link)
        ? String((link[0] as Record<string, unknown>)?.['@_href'] ?? text(link[0] as Node))
        : text(link as Node)
    const date = text((item.pubDate ?? item.published ?? item.updated ?? item['dc:date']) as Node)
    const ts = Date.parse(date)

    return {
      headline: stripHtml(text(item.title as Node)),
      summary: stripHtml(rawDesc).slice(0, 400),
      url: url.trim(),
      datetime: Number.isFinite(ts) ? Math.floor(ts / 1000) : 0,
      image: findImage(item, rawDesc),
      source: source.name,
    }
  }).filter(i => i.headline && i.url.startsWith('http'))
}
