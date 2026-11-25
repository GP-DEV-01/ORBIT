export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Summary cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            background: 'var(--bg-card)',
            borderRadius: '20px',
            padding: '20px 24px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ width: '60px', height: '10px', borderRadius: '6px', background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '10px' }} />
            <div style={{ width: '120px', height: '28px', borderRadius: '8px', background: 'var(--bg-elevated)', opacity: 0.15 }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        padding: '24px',
        border: '1px solid var(--border)',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '100%',
          height: '120px',
          borderRadius: '12px',
          background: 'var(--bg-elevated)',
          opacity: 0.15,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* Table skeleton */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 90px 90px 120px 120px 90px 64px',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          {[80, 50, 40, 60, 60, 50, 30].map((w, i) => (
            <div key={i} style={{
              height: '10px',
              width: `${w}px`,
              borderRadius: '4px',
              background: 'var(--bg-elevated)',
              opacity: 0.15,
              marginLeft: i > 0 ? 'auto' : undefined,
            }} />
          ))}
        </div>

        {/* Data rows */}
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 90px 90px 120px 120px 90px 64px',
              padding: '14px 20px',
              borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ width: '60px', height: '13px', borderRadius: '4px', background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '6px' }} />
              <div style={{ width: '100px', height: '10px', borderRadius: '4px', background: 'var(--bg-elevated)', opacity: 0.15 }} />
            </div>
            {[50, 40, 70, 60, 40, 20].map((w, j) => (
              <div key={j} style={{
                height: '13px',
                width: `${w}px`,
                borderRadius: '4px',
                background: 'var(--bg-elevated)',
                opacity: 0.15,
                marginLeft: 'auto',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 80}ms`,
              }} />
            ))}
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
