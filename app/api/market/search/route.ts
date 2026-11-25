import { NextRequest, NextResponse } from 'next/server'
import { getQuotes } from '@/lib/yahooQuote'

// GET /api/market/search?q=vwce&type=all|stock|etf|fund|crypto|index|forex|commodity&region=IT
//
// Sources, merged and de-duplicated by symbol:
//  1. Yahoo search  — relevance-ranked, region-aware (region=IT puts Borsa Italiana listings first)
//  2. Yahoo lookup  — every listing on every exchange (up to 50), filterable by instrument type
//  3. ISIN          — OpenFIGI maps the ISIN to all its listings → Yahoo symbols, checked against Yahoo quotes
//  4. Finnhub       — fallback, mostly US
// Everything is queried live, so newly listed instruments show up as soon as Yahoo lists them.

export interface SearchResult {
  symbol: string
  description: string
  type: string
  displaySymbol: string
  exchange: string
  source: string
  isin?: string
  price?: number
  currency?: string
}

type Category = 'all' | 'stock' | 'etf' | 'fund' | 'crypto' | 'index' | 'forex' | 'commodity'

const CATEGORY_TYPE: Record<Exclude<Category, 'all'>, string> = {
  stock: 'Stock', etf: 'ETF', fund: 'Fund', crypto: 'Crypto', index: 'Index', forex: 'Forex', commodity: 'Commodity',
}
const LOOKUP_TYPE: Record<Category, string> = {
  all: 'all', stock: 'equity', etf: 'etf', fund: 'mutualfund', crypto: 'cryptocurrency', index: 'index', forex: 'currency', commodity: 'future',
}

const YAHOO_TYPE: Record<string, string> = {
  EQUITY: 'Stock', ETF: 'ETF', MUTUALFUND: 'Fund', CRYPTOCURRENCY: 'Crypto', CURRENCY: 'Forex', INDEX: 'Index', FUTURE: 'Commodity',
}

// Yahoo lookup exchange codes → readable names
const EXCHANGES: Record<string, string> = {
  MIL: 'Milano', GER: 'XETRA', FRA: 'Frankfurt', STU: 'Stuttgart', MUN: 'München', DUS: 'Düsseldorf', HAM: 'Hamburg',
  BER: 'Berlin', HAN: 'Hannover', AMS: 'Amsterdam', PAR: 'Paris', BRU: 'Brussels', LIS: 'Lisbon', MCE: 'Madrid',
  LSE: 'London', IOB: 'London IOB', EBS: 'SIX Swiss', VIE: 'Wien', CPH: 'Copenhagen', STO: 'Stockholm', OSL: 'Oslo',
  HEL: 'Helsinki', ISE: 'Dublin', NYQ: 'NYSE', NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', PCX: 'NYSE Arca',
  ASE: 'NYSE American', BTS: 'Cboe BZX', TOR: 'Toronto', JPX: 'Tokyo', HKG: 'Hong Kong', CCC: 'Crypto', CCY: 'FX',
}

// Preferred listing suffix per region, used to rank the lookup results
const HOME_SUFFIX: Record<string, string> = { IT: '.MI', DE: '.DE', FR: '.PA', ES: '.MC', GB: '.L', US: '' }

// OpenFIGI exchange codes → Yahoo suffixes (only venues Yahoo quotes)
const FIGI_SUFFIX: Record<string, string> = {
  US: '', UN: '', UW: '', UQ: '', UA: '', UR: '', UP: '', UF: '', UV: '',
  IM: '.MI', GY: '.DE', GF: '.F', GD: '.DU', GS: '.SG', GM: '.MU', GH: '.HM', GB: '.BE', GI: '.HA',
  LN: '.L', NA: '.AS', FP: '.PA', SM: '.MC', SW: '.SW', SE: '.SW', BB: '.BR', ID: '.IR', PL: '.LS',
  AV: '.VI', DC: '.CO', SS: '.ST', NO: '.OL', FH: '.HE', CN: '.TO', JT: '.T', HK: '.HK',
}
const FIGI_TYPE: Record<string, string> = {
  'Common Stock': 'Stock', 'ETP': 'ETF', 'Open-End Fund': 'Fund', 'Mutual Fund': 'Fund', 'ADR': 'Stock',
  'Depositary Receipt': 'Stock', 'REIT': 'Stock', 'Preference': 'Stock',
}

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/

async function getJson(url: string, init?: RequestInit & { next?: { revalidate: number } }) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000), ...init })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

async function searchYahoo(q: string, region: string): Promise<SearchResult[]> {
  const lang = { IT: 'it-IT', DE: 'de-DE', FR: 'fr-FR', ES: 'es-ES', GB: 'en-GB' }[region] ?? 'en-US'
  const d = await getJson(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&lang=${lang}&region=${region}`,
    { next: { revalidate: 300 } },
  )
  return (d?.quotes ?? [])
    .filter((r: { quoteType?: string; symbol?: string }) => r.symbol && r.quoteType !== 'OPTION')
    .map((r: { symbol: string; longname?: string; shortname?: string; quoteType?: string; exchDisp?: string }) => ({
      symbol: r.symbol,
      description: r.longname ?? r.shortname ?? r.symbol,
      type: YAHOO_TYPE[r.quoteType ?? ''] ?? r.quoteType ?? '',
      displaySymbol: r.symbol,
      exchange: r.exchDisp ?? '',
      source: 'Yahoo',
    }))
}

interface LookupDoc { symbol?: string; shortName?: string; quoteType?: string; exchange?: string; regularMarketPrice?: { raw?: number } }

async function lookupYahoo(q: string, category: Category, region: string): Promise<SearchResult[]> {
  const d = await getJson(
    `https://query1.finance.yahoo.com/v1/finance/lookup?query=${encodeURIComponent(q)}&type=${LOOKUP_TYPE[category]}&start=0&count=50`,
    { next: { revalidate: 300 } },
  )
  const docs: LookupDoc[] = d?.finance?.result?.[0]?.documents ?? []
  const home = HOME_SUFFIX[region]
  const isHome = (s: string) => (home ? s.endsWith(home) : !s.includes('.'))
  return docs
    .filter(x => x.symbol)
    .map((x, i) => ({ x, i }))
    .sort((a, b) => Number(isHome(b.x.symbol!)) - Number(isHome(a.x.symbol!)) || a.i - b.i)
    .map(({ x }) => ({
      symbol: x.symbol!,
      description: (x.shortName ?? x.symbol!).trim(),
      type: YAHOO_TYPE[(x.quoteType ?? '').toUpperCase()] ?? x.quoteType ?? '',
      displaySymbol: x.symbol!,
      exchange: EXCHANGES[x.exchange ?? ''] ?? x.exchange ?? '',
      source: 'Yahoo',
      price: x.regularMarketPrice?.raw,
    }))
}

interface FigiItem { ticker?: string; exchCode?: string; name?: string; securityType?: string; securityType2?: string }

// Main venues first, the user's home market on top; secondary German venues last
const FIGI_PRIORITY = ['US', 'UN', 'UW', 'UQ', 'UA', 'UR', 'UP', 'IM', 'GY', 'LN', 'NA', 'FP', 'SM', 'SW', 'SE', 'BB', 'ID', 'PL', 'AV', 'DC', 'SS', 'NO', 'FH', 'CN', 'JT', 'HK']
const FIGI_EXCHANGE: Record<string, string> = {
  US: 'US', UN: 'NYSE', UW: 'NASDAQ', UQ: 'NASDAQ', UA: 'NYSE American', UP: 'NYSE Arca', IM: 'Milano', GY: 'XETRA',
  GF: 'Frankfurt', GD: 'Düsseldorf', GS: 'Stuttgart', GM: 'München', GH: 'Hamburg', GB: 'Berlin', GI: 'Hannover',
  LN: 'London', NA: 'Amsterdam', FP: 'Paris', SM: 'Madrid', SW: 'SIX Swiss', SE: 'SIX Swiss', BB: 'Brussels',
  ID: 'Dublin', PL: 'Lisbon', AV: 'Wien', DC: 'Copenhagen', SS: 'Stockholm', NO: 'Oslo', FH: 'Helsinki',
  CN: 'Toronto', JT: 'Tokyo', HK: 'Hong Kong',
}
const HOME_FIGI: Record<string, string> = { IT: 'IM', DE: 'GY', FR: 'FP', ES: 'SM', GB: 'LN', US: 'US' }

async function searchIsin(isin: string, region: string): Promise<SearchResult[]> {
  const r = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
    signal: AbortSignal.timeout(6000),
  })
  if (!r.ok) return []
  const data: FigiItem[] = (await r.json())?.[0]?.data ?? []

  const rank = (code: string) => {
    if (code === HOME_FIGI[region]) return -1
    const i = FIGI_PRIORITY.indexOf(code)
    return i < 0 ? FIGI_PRIORITY.length : i
  }
  const candidates = new Map<string, FigiItem>()
  data
    .filter(f => f.ticker && f.exchCode && f.exchCode in FIGI_SUFFIX)
    .sort((a, b) => rank(a.exchCode!) - rank(b.exchCode!))
    .forEach(f => {
      const symbol = f.ticker!.replace(/\//g, '-').replace(/\s+/g, '') + FIGI_SUFFIX[f.exchCode!]
      if (!candidates.has(symbol) && candidates.size < 20) candidates.set(symbol, f)
    })
  // Keep only the symbols Yahoo actually quotes
  const quotes = await getQuotes([...candidates.keys()])
  return [...candidates.entries()]
    .filter(([s]) => quotes[s])
    .map(([symbol, f]) => ({
      symbol,
      description: f.name ?? symbol,
      type: FIGI_TYPE[f.securityType ?? ''] ?? FIGI_TYPE[f.securityType2 ?? ''] ?? '',
      displaySymbol: symbol,
      exchange: FIGI_EXCHANGE[f.exchCode ?? ''] ?? f.exchCode ?? '',
      source: 'OpenFIGI',
      isin,
      price: quotes[symbol].c,
      currency: quotes[symbol].cur,
    }))
}

async function searchFinnhub(q: string): Promise<SearchResult[]> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return []
  const d = await getJson(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`, { next: { revalidate: 300 } })
  return (d?.result ?? [])
    .slice(0, 10)
    .filter((r: { symbol?: string }) => r.symbol)
    .map((r: { symbol: string; description?: string; type?: string; displaySymbol?: string }) => ({
      symbol: r.symbol,
      description: r.description ?? r.symbol,
      type: r.type === 'Common Stock' ? 'Stock' : r.type ?? '',
      displaySymbol: r.displaySymbol ?? r.symbol,
      exchange: '',
      source: 'Finnhub',
    }))
}

const settled = <T,>(r: PromiseSettledResult<T[]>) => (r.status === 'fulfilled' ? r.value : [])

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const category = (req.nextUrl.searchParams.get('type') ?? 'all') as Category
  const region = (req.nextUrl.searchParams.get('region') ?? 'US').toUpperCase()
  if (!q || !(category in LOOKUP_TYPE)) return NextResponse.json({ results: [] })

  const isin = ISIN_RE.test(q.toUpperCase()) ? q.toUpperCase() : null

  const [search, lookup, byIsin, finnhub] = await Promise.allSettled([
    searchYahoo(q, region),
    isin ? Promise.resolve([]) : lookupYahoo(q, category, region),
    isin ? searchIsin(isin, region) : Promise.resolve([]),
    searchFinnhub(q),
  ])

  const wanted = category === 'all' ? null : CATEGORY_TYPE[category]
  const seen = new Map<string, SearchResult>()
  for (const item of [...settled(byIsin), ...settled(search), ...settled(lookup), ...settled(finnhub)]) {
    if (wanted && item.type && item.type !== wanted) continue
    const key = item.symbol.toUpperCase()
    const prev = seen.get(key)
    if (!prev) seen.set(key, { ...item, ...(isin ? { isin } : {}) })
    else seen.set(key, { ...prev, price: prev.price ?? item.price, currency: prev.currency ?? item.currency })
  }

  return NextResponse.json({ results: [...seen.values()].slice(0, 50) })
}
