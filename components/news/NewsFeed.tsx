'use client'

import { useEffect, useMemo, useState } from 'react'
import ArticleModal from './ArticleModal'
import { useLang } from '@/lib/LanguageContext'
import { NEWS_COUNTRIES, type NewsCountry } from '@/lib/newsSources'
import { NEWS_CATEGORIES, type NewsCategory } from '@/lib/newsCategories'

interface NewsItem {
  id: string
  headline: string
  summary: string
  source: string
  url: string
  datetime: number
  image: string
  category: NewsCategory
  country: NewsCountry
}

type CountryFilter = NewsCountry | 'ALL'

const REFRESH_MS = 3 * 60 * 1000

const CATEGORY_COLORS: Record<NewsCategory, string> = {
  markets: '#22c55e', macro: '#60a5fa', centralBanks: '#a78bfa', companies: '#f59e0b', mergers: '#f472b6',
  policy: '#38bdf8', labor: '#fb923c', energy: '#facc15', banking: '#2dd4bf', tech: '#818cf8',
  crypto: '#f97316', realEstate: '#a3e635', geopolitics: '#f87171', other: '#71717a',
}

const FLAGS = Object.fromEntries(NEWS_COUNTRIES.map(c => [c.code, c.flag])) as Record<NewsCountry, string>

function pill(active: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: '999px', border: '1px solid',
    borderColor: active ? 'var(--border-light)' : 'var(--border)',
    background: active ? 'var(--bg-card)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
    fontSize: '11px', fontWeight: active ? 600 : 400,
    cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: '5px',
  }
}

export default function NewsFeed() {
  const { t } = useLang()
  const [country, setCountry] = useState<CountryFilter>('ALL')
  const [source, setSource] = useState<string | null>(null)
  const [category, setCategory] = useState<NewsCategory | null>(null)
  const [cache, setCache] = useState<Partial<Record<CountryFilter, { news: NewsItem[]; failed: number }>>>({})
  const [selected, setSelected] = useState<NewsItem | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Clock for the "x minutes ago" labels
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(iv)
  }, [])

  // Fetch the selected country (cached per country) and refresh periodically
  useEffect(() => {
    let cancelled = false
    function load() {
      fetch(`/api/news?country=${country}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled) setCache(c => ({ ...c, [country]: { news: d.news ?? [], failed: d.failedSources ?? 0 } }))
        })
        .catch(() => {
          if (!cancelled) setCache(c => ({ ...c, [country]: c[country] ?? { news: [], failed: 0 } }))
        })
    }
    load()
    const iv = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(iv) }
  }, [country])

  const entry = cache[country]
  const loading = !entry
  const news = useMemo(() => entry?.news ?? [], [entry])

  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    news.forEach(n => counts.set(n.source, (counts.get(n.source) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [news])

  const bySource = useMemo(() => (source ? news.filter(n => n.source === source) : news), [news, source])

  const categoryCounts = useMemo(() => {
    const counts = {} as Record<NewsCategory, number>
    bySource.forEach(n => { counts[n.category] = (counts[n.category] ?? 0) + 1 })
    return counts
  }, [bySource])

  const filtered = category ? bySource.filter(n => n.category === category) : bySource

  function selectCountry(c: CountryFilter) {
    setCountry(c)
    setSource(null)
    setCategory(null)
  }

  function timeAgo(ts: number) {
    const diff = now - ts * 1000
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    if (m < 2) return 'Just now'
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '17px', fontWeight: '700', letterSpacing: '-0.2px' }}>{t('marketNews')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '3px' }}>
              {t('clickToRead')}
              {entry && entry.failed > 0 && (
                <span style={{ color: 'var(--orange)', marginLeft: '8px' }}>
                  · {t('newsSourcesFailed').replace('{n}', String(entry.failed))}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9px', color: 'var(--green)', fontWeight: '700', letterSpacing: '0.1em' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
            LIVE
          </div>
        </div>

        {/* Country selector */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          <button onClick={() => selectCountry('ALL')} style={pill(country === 'ALL')}>🗺️ {t('allCountries')}</button>
          {NEWS_COUNTRIES.map(c => (
            <button key={c.code} onClick={() => selectCountry(c.code)} style={pill(country === c.code)}>
              {c.flag} {t(`country${c.code}`)}
            </button>
          ))}
        </div>

        {/* Source selector — the outlets behind the current country */}
        {sources.length > 1 && (
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', alignItems: 'center' }}>
            <button onClick={() => { setSource(null); setCategory(null) }} style={{ ...pill(source === null), fontSize: '10px', padding: '3px 10px' }}>
              {t('allSources')}
            </button>
            {sources.map(([name, count]) => (
              <button
                key={name}
                onClick={() => { setSource(source === name ? null : name); setCategory(null) }}
                style={{ ...pill(source === name), fontSize: '10px', padding: '3px 10px' }}
              >
                {name} <span style={{ opacity: 0.5 }}>{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Economic category tabs, with counts for the current selection */}
        <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
          {[null, ...NEWS_CATEGORIES.filter(c => categoryCounts[c])].map(c => {
            const active = category === c
            const count = c ? categoryCounts[c] : bySource.length
            return (
              <button
                key={c ?? 'all'}
                onClick={() => setCategory(c)}
                style={{
                  padding: '8px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: `2px solid ${active ? (c ? CATEGORY_COLORS[c] : 'var(--green)') : 'transparent'}`,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: '11px', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                {c && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CATEGORY_COLORS[c] }} />}
                {c ? t(`cat_${c}`) : t('allCategories')}
                <span style={{ fontSize: '9px', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: '14px', opacity: 0.25, height: '150px' }}>
                <div style={{ height: '10px', background: 'var(--bg-hover)', borderRadius: '3px', marginBottom: '8px' }} />
                <div style={{ height: '10px', background: 'var(--bg-hover)', borderRadius: '3px', width: '75%' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('noNewsAvailable')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                className="card-hover animate-fadeIn"
                onClick={() => setSelected(item)}
                style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                {item.image && (
                  <img
                    src={item.image} alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '4px', background: 'var(--bg-secondary)' }}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {country === 'ALL' && `${FLAGS[item.country]} `}{item.source}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{item.datetime ? timeAgo(item.datetime) : ''}</span>
                </div>
                <h3 style={{ fontSize: '12px', fontWeight: '600', lineHeight: '1.45', color: 'var(--text-primary)' }}>
                  {item.headline}
                </h3>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="tag" style={{ color: CATEGORY_COLORS[item.category], borderColor: `${CATEGORY_COLORS[item.category]}55` }}>
                    {t(`cat_${item.category}`)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('readAndDiscuss')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ArticleModal
          article={{ ...selected, category: t(`cat_${selected.category}`) }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
