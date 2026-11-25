export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tab bar skeleton */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {[80, 70].map((w, i) => (
          <div key={i} style={{
            width: `${w}px`,
            height: '32px',
            borderRadius: '999px',
            background: 'var(--bg-elevated)',
            opacity: 0.15,
          }} />
        ))}
      </div>

      {/* Watchlist cards skeleton */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
            }}
          >
            {/* Left: symbol + name */}
            <div>
              <div style={{
                width: '55px', height: '13px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '6px',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 80}ms`,
              }} />
              <div style={{
                width: '120px', height: '10px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 80 + 40}ms`,
              }} />
            </div>

            {/* Right: price + change */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                width: '70px', height: '13px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '6px', marginLeft: 'auto',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 80}ms`,
              }} />
              <div style={{
                width: '50px', height: '10px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15, marginLeft: 'auto',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 80 + 40}ms`,
              }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.08; }
        }
      `}</style>
    </div>
  )
}
