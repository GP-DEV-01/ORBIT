'use client'

import { useState, type ReactNode } from 'react'

// Flashes green/red when `value` changes. Uses the "adjust state during render" pattern
// (react.dev: storing information from previous renders) — no effect needed.
export default function FlashPrice({ value, children }: { value: number; children: ReactNode }) {
  const [prev, setPrev] = useState(value)
  const [flash, setFlash] = useState<{ dir: 'up' | 'down'; n: number } | null>(null)

  if (value !== prev) {
    setPrev(value)
    setFlash({ dir: value > prev ? 'up' : 'down', n: (flash?.n ?? 0) + 1 })
  }

  // Changing key remounts the span so the CSS animation restarts on every tick
  return (
    <span key={flash?.n ?? 0} className={flash ? `flash-${flash.dir}` : undefined}>
      {children}
    </span>
  )
}
