'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Logo from './Logo'

const NAV = [
  { href: '/dashboard', label: 'Portfolio', icon: '▣' },
  { href: '/dashboard/watchlist', label: 'Watchlist', icon: '◈' },
  { href: '/dashboard/news', label: 'News', icon: '◉' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside style={{
      width: '200px',
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '22px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Logo size={28} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '0.08em', color: '#fff' }}>
            ORBIT
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: '1px' }}>
            MARKETS
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '8px 10px 6px', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 10px',
                borderRadius: '6px',
                marginBottom: '2px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: active ? '600' : '400',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: active ? 'var(--bg-hover)' : 'transparent',
                transition: 'all 0.12s',
                borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: '13px', opacity: 0.7 }}>{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Market status */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--green)',
            display: 'inline-block',
            animation: 'blink 2s infinite',
          }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            MARKETS LIVE
          </span>
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: '12px 10px' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '9px 10px',
            borderRadius: '6px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'color 0.12s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ⊗ Sign Out
        </button>
      </div>
    </aside>
  )
}
