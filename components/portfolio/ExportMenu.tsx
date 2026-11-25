'use client'

import { useEffect, useRef, useState } from 'react'
import { usePortfolioStore } from '@/lib/store'
import { useLang } from '@/lib/LanguageContext'
import {
  exportExcel, copyForGoogleSheets, exportCsv,
  liveLinks, getLiveToken, createLiveToken, revokeLiveToken, type LiveLinks,
} from '@/lib/exportPortfolio'

type Format = 'excel' | 'sheets' | 'csv' | 'live'

const OPTIONS: { key: Format; icon: string; label: string; desc: string }[] = [
  { key: 'excel', icon: '▦', label: 'exportExcel', desc: 'exportExcelDesc' },
  { key: 'live', icon: '◉', label: 'exportLive', desc: 'exportLiveDesc' },
  { key: 'sheets', icon: '◫', label: 'exportSheets', desc: 'exportSheetsDesc' },
  { key: 'csv', icon: '≡', label: 'exportCsv', desc: 'exportCsvDesc' },
]

// Sheets uses ";" between arguments in locales where "," is the decimal separator
function importFormula(url: string) {
  const dec = new Intl.NumberFormat().formatToParts(1.5).find(p => p.type === 'decimal')?.value ?? '.'
  const sep = dec === ',' ? ';' : ','
  return `=IMPORTDATA("${url}"${sep} ","${sep} "en_US")`
}

const pillBtn = {
  padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-primary)', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
} as const

export default function ExportMenu({ userId }: { userId: string | null }) {
  const { t, lang } = useLang()
  const items = usePortfolioStore(s => s.items)
  const quotes = usePortfolioStore(s => s.quotes)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'live'>('menu')
  const [busy, setBusy] = useState<Format | null>(null)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  // undefined = loading, null = no link yet, 'setup' = migration not run
  const [token, setToken] = useState<string | null | undefined | 'setup'>(undefined)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(id)
  }, [notice])

  useEffect(() => {
    if (!open || !userId || token !== undefined) return
    getLiveToken(userId).then(setToken, () => setToken('setup'))
  }, [open, userId, token])

  const links: LiveLinks | null = typeof token === 'string' && token !== 'setup' ? liveLinks(token, lang) : null

  async function run(format: Format) {
    if (format === 'live') { setView('live'); return }
    setBusy(format)
    try {
      if (format === 'excel') await exportExcel(items, quotes, t, { userId, liveLinks: links })
      if (format === 'csv') exportCsv(items, quotes, t)
      if (format === 'sheets') {
        // Open the tab synchronously inside the click so the popup blocker allows it
        window.open('https://sheets.new', '_blank', 'noopener')
        await copyForGoogleSheets(items, quotes, t)
        setNotice({ text: t('exportSheetsCopied') })
      }
      setOpen(false)
    } catch {
      setNotice({ text: t('exportFailed'), error: true })
    } finally {
      setBusy(null)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice({ text: t('live_copied') })
    } catch {
      setNotice({ text: t('exportFailed'), error: true })
    }
  }

  async function changeToken(action: 'create' | 'revoke') {
    if (!userId) return
    if (action === 'revoke' && !window.confirm(t('live_revokeConfirm'))) return
    if (action === 'create' && links && !window.confirm(t('live_regenerateConfirm'))) return
    setBusy('live')
    try {
      if (action === 'create') setToken(await createLiveToken(userId))
      else { await revokeLiveToken(userId); setToken(null) }
    } catch {
      setNotice({ text: t('exportFailed'), error: true })
    } finally {
      setBusy(null)
    }
  }

  if (!items.length) return null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); setView('menu') }}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '999px',
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        ↓ {t('exportTitle')}
      </button>

      {open && (
        <div className="animate-fadeIn" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: view === 'live' ? '380px' : '280px',
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '14px',
          padding: '6px', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          {view === 'menu' && OPTIONS.map(o => (
            <button
              key={o.key}
              disabled={busy !== null}
              onClick={() => run(o.key)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent',
                color: 'var(--text-primary)', cursor: busy ? 'wait' : 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1.2, width: '18px', color: 'var(--green)' }}>{o.icon}</span>
              <span>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 700 }}>
                  {busy === o.key ? t('exportWorking') : t(o.label)}
                </span>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{t(o.desc)}</span>
              </span>
            </button>
          ))}

          {view === 'live' && (
            <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => setView('menu')} aria-label={t('live_back')}
                  style={{ ...pillBtn, padding: '2px 10px', fontSize: '13px' }}>←</button>
                <span style={{ fontSize: '13px', fontWeight: 700 }}>{t('exportLive')}</span>
              </div>

              {token === undefined && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('exportWorking')}</p>}

              {token === 'setup' && <p style={{ fontSize: '11px', color: 'var(--red)' }}>{t('live_setupNeeded')}</p>}

              {token === null && (
                <>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t('live_intro')}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('live_privacy')}</p>
                  <button className="btn-primary" disabled={busy !== null} onClick={() => changeToken('create')}>
                    {busy === 'live' ? t('exportWorking') : t('live_create')}
                  </button>
                </>
              )}

              {links && (
                <>
                  {([['live_positions', links.positions], ['live_history', links.history]] as const).map(([key, url]) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>{t(key)}</span>
                      <input readOnly value={url} onFocus={e => e.currentTarget.select()} style={{
                        width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--border)',
                        background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '10px', fontFamily: 'monospace',
                      }} />
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button style={pillBtn} onClick={() => copy(importFormula(url))}>{t('live_copyFormula')}</button>
                        <button style={pillBtn} onClick={() => copy(url)}>{t('live_copyLink')}</button>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {t('live_sheetsHint')}<br />{t('live_excelHint')}
                  </p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('live_privacy')}</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={pillBtn} disabled={busy !== null} onClick={() => changeToken('create')}>{t('live_regenerate')}</button>
                    <button style={{ ...pillBtn, color: 'var(--red)' }} disabled={busy !== null} onClick={() => changeToken('revoke')}>{t('live_revoke')}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {notice && (
        <div role="status" className="animate-fadeIn" style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 100, maxWidth: '360px',
          padding: '12px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
          background: 'var(--bg-elevated)', border: `1px solid ${notice.error ? 'var(--red)' : 'var(--green)'}`,
          color: 'var(--text-primary)', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          {notice.text}
        </div>
      )}
    </div>
  )
}
