'use client'

import { useEffect, useState } from 'react'
import { usePortfolioStore } from '@/lib/store'
import { useLang } from '@/lib/LanguageContext'

const STALE_MS = 20000

// Honest live indicator: green only when the last successful update is recent.
export default function LiveStatus() {
  const { t } = useLang()
  const feedStatus = usePortfolioStore(s => s.feedStatus)
  const lastUpdate = usePortfolioStore(s => s.lastUpdate)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  const age = lastUpdate ? Math.max(0, Math.round((now - lastUpdate) / 1000)) : null
  const stale = lastUpdate !== null && now - lastUpdate > STALE_MS

  let label = t('feedConnecting')
  let color = 'var(--text-muted)'
  let blinking = false
  if (feedStatus === 'paused') {
    label = t('feedPaused')
  } else if (feedStatus === 'error' || stale) {
    label = t('feedOffline')
    color = 'var(--red)'
  } else if (feedStatus === 'live') {
    label = t('feedLive')
    color = 'var(--green)'
    blinking = true
  }

  return (
    <div
      title={age !== null ? t('updatedAgo').replace('{s}', String(age)) : undefined}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color }}
    >
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%', background: color, display: 'inline-block',
        animation: blinking ? 'blink 1.5s infinite' : 'none',
      }} />
      {label}
      {age !== null && feedStatus === 'live' && !stale && (
        <span style={{ color: 'var(--text-muted)', fontWeight: '600', letterSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
          {age}s
        </span>
      )}
    </div>
  )
}
