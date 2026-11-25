'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { usePortfolioStore } from '@/lib/store'
import { useLiveQuotes } from '@/lib/liveQuotes'
import { useSnapshotRecorder } from '@/lib/useSnapshotRecorder'
import { usePacSync } from '@/lib/usePacSync'
import { PortfolioItem } from '@/types'

const NetWorthChart = dynamic(() => import('@/components/portfolio/NetWorthChart'), {
  ssr: false,
  loading: () => <div style={{ height: '320px', background: 'var(--bg-card)', borderRadius: '20px', opacity: 0.3 }} />,
})

const PortfolioTable = dynamic(() => import('@/components/portfolio/PortfolioTable'), {
  ssr: false,
  loading: () => <div style={{ height: '200px', background: 'var(--bg-card)', borderRadius: '20px', opacity: 0.3 }} />,
})

const ExportMenu = dynamic(() => import('@/components/portfolio/ExportMenu'), { ssr: false })

const AddInstrumentModal = dynamic(() => import('@/components/portfolio/AddInstrumentModal'), {
  ssr: false,
})

export default function DashboardPage() {
  const { userId, ready } = useAuth()
  const [dataLoading, setDataLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const items = usePortfolioStore(s => s.items)
  const quotes = usePortfolioStore(s => s.quotes)
  const setItems = usePortfolioStore(s => s.setItems)

  useLiveQuotes(items.map(i => i.symbol))
  usePacSync(items)
  useSnapshotRecorder(userId, items, quotes)

  // Load portfolio once auth is ready; quotes start flowing as soon as items are set
  useEffect(() => {
    if (!ready || !userId) return
    let cancelled = false

    supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setItems((data || []) as PortfolioItem[])
        setDataLoading(false)
      })

    return () => { cancelled = true }
  }, [ready, userId])

  if (!ready || dataLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', fontSize: '13px' }}>
        Loading portfolio...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Portfolio</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>
            {items.length} instrument{items.length !== 1 ? 's' : ''} · live prices
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ExportMenu userId={userId} />
          <button
            className="btn-primary"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Add Instrument
          </button>
        </div>
      </div>

      {items.length > 0 && <NetWorthChart items={items} quotes={quotes} />}

      <PortfolioTable items={items} quotes={quotes} onAddClick={() => setShowModal(true)} />

      {showModal && userId && (
        <AddInstrumentModal userId={userId} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
