export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter bar skeleton */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {[90, 70, 80, 60].map((w, i) => (
          <div key={i} style={{
            width: `${w}px`,
            height: '30px',
            borderRadius: '999px',
            background: 'var(--bg-elevated)',
            opacity: 0.15,
          }} />
        ))}
      </div>

      {/* News cards skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              padding: '16px 20px',
              display: 'flex',
              gap: '16px',
              alignItems: 'flex-start',
            }}
          >
            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Meta: source + time */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <div style={{
                  width: '55px', height: '9px', borderRadius: '4px',
                  background: 'var(--bg-elevated)', opacity: 0.15,
                }} />
                <div style={{
                  width: '35px', height: '9px', borderRadius: '4px',
                  background: 'var(--bg-elevated)', opacity: 0.15,
                }} />
              </div>

              {/* Headline */}
              <div style={{
                width: '90%', height: '14px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '8px',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 60}ms`,
              }} />
              <div style={{
                width: '65%', height: '14px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '10px',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 60 + 30}ms`,
              }} />

              {/* Summary */}
              <div style={{
                width: '100%', height: '10px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15, marginBottom: '6px',
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 60 + 60}ms`,
              }} />
              <div style={{
                width: '80%', height: '10px', borderRadius: '4px',
                background: 'var(--bg-elevated)', opacity: 0.15,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 60 + 90}ms`,
              }} />
            </div>

            {/* Thumbnail placeholder */}
            <div style={{
              width: '80px', height: '64px', borderRadius: '10px',
              background: 'var(--bg-elevated)', opacity: 0.15, flexShrink: 0,
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 60}ms`,
            }} />
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
