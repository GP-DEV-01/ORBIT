import TopNav from '@/components/ui/TopNav'
import MarketTicker from '@/components/ui/MarketTicker'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* Top navigation */}
      <TopNav />

      {/* Market ticker — only this scrolls horizontally */}
      <MarketTicker />

      {/* Page content */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '24px 28px',
      }}>
        {children}
      </main>
    </div>
  )
}
