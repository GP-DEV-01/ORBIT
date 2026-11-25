'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LanguageContext'
import { LANGUAGES } from '@/lib/i18n'
import Logo from './Logo'

interface SearchResult {
  symbol: string
  description: string
  type: string
  displaySymbol: string
  exchange: string
  source: string
}

const TYPE_COLORS: Record<string, string> = {
  Stock: '#4488ff', ETF: '#a78bfa', Crypto: '#f59e0b',
  Index: '#22c55e', Forex: '#f43f5e', Fund: '#60a5fa', Commodity: '#fb923c',
}

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const { userEmail } = useAuth()

  const email = userEmail
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U'

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Language selector state
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  const TABS = [
    { href: '/dashboard',           label: t('portfolio'), icon: '▣' },
    { href: '/dashboard/watchlist', label: t('watchlist'), icon: '◈' },
    { href: '/dashboard/news',      label: t('news'),      icon: '◉' },
  ]

  // Debounced global search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return }
    setSearchLoading(true)
    searchDebounce.current = setTimeout(async () => {
      const r = await fetch(`/api/market/search?q=${encodeURIComponent(searchQuery)}`)
      const d = await r.json()
      setSearchResults((d.results || []).slice(0, 8))
      setSearchLoading(false)
    }, 350)
  }, [searchQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false); setSearchQuery(''); setSearchResults([])
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleSelectResult(r: SearchResult) {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
    router.push(`/dashboard/watchlist?symbol=${encodeURIComponent(r.symbol)}`)
  }

  const currentLang = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-base)',
      flexShrink: 0,
      gap: '16px',
    }}>

      {/* LEFT: Logo + Nav Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px',
            background: '#fff', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Logo size={19} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.1em' }}>ORBIT</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '3px',
          background: 'var(--bg-card)', padding: '4px',
          borderRadius: '999px', border: '1px solid var(--border)',
        }}>
          {TABS.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '999px',
                  fontSize: '12px', fontWeight: active ? '600' : '400',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: active ? 'var(--bg-elevated)' : 'transparent',
                  transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{icon}</span>
                  {label}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* CENTER: Global Search */}
      <div ref={searchRef} style={{ flex: 1, maxWidth: '360px', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="input-dark"
            placeholder={t('search')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            style={{ paddingLeft: '36px', paddingRight: '12px', fontSize: '12px' }}
          />
          <span style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: '15px', pointerEvents: 'none',
          }}>⌕</span>
          {searchLoading && (
            <span style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontSize: '10px',
            }}>···</span>
          )}
        </div>

        {searchOpen && (searchResults.length > 0 || searchLoading) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300,
            background: 'var(--bg-card)', border: '1px solid var(--border-hover)',
            borderRadius: '16px', overflow: 'hidden', maxHeight: '340px', overflowY: 'auto',
            boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          }}>
            {searchLoading && searchResults.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                {t('searching')}
              </div>
            )}
            {searchResults.map((r, i) => (
              <div
                key={`${r.symbol}-${i}`}
                onClick={() => handleSelectResult(r)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '700', fontSize: '12px' }}>{r.displaySymbol || r.symbol}</span>
                    <span style={{
                      fontSize: '8px', padding: '1px 5px', borderRadius: '999px',
                      color: TYPE_COLORS[r.type] ?? 'var(--text-muted)',
                      background: `${TYPE_COLORS[r.type] ?? '#888'}18`, fontWeight: '600',
                    }}>{r.type?.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.description}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                  {r.exchange && <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{r.exchange}</div>}
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', opacity: 0.5 }}>{r.source}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: Language + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

        {/* Language Selector */}
        <div ref={langRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setLangOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: '999px', padding: '5px 10px', cursor: 'pointer',
              fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
            onMouseLeave={e => { if (!langOpen) e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <span style={{ fontSize: '13px' }}>{currentLang.flag}</span>
            <span>{currentLang.code}</span>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>▾</span>
          </button>

          {langOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
              background: 'var(--bg-card)', border: '1px solid var(--border-hover)',
              borderRadius: '14px', overflow: 'hidden', minWidth: '100px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}>
              {LANGUAGES.map(l => (
                <div
                  key={l.code}
                  onClick={() => { setLang(l.code); setLangOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', cursor: 'pointer',
                    background: l.code === lang ? 'var(--bg-elevated)' : 'transparent',
                    fontSize: '12px', fontWeight: l.code === lang ? '700' : '400',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (l.code !== lang) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (l.code !== lang) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '14px' }}>{l.flag}</span>
                  <span>{l.code}</span>
                  {l.code === lang && <span style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: '10px' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: '600' }}>
              {email ? email.split('@')[0] : 'User'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{email ?? ''}</div>
          </div>
          <div
            onClick={handleLogout}
            title={t('signOut')}
            style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: 'var(--bg-elevated)', border: '2px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: '700', cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {initials}
          </div>
        </div>
      </div>
    </div>
  )
}
