'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

interface ScoreOrbProps {
  score: number
  label: string
}

function bandColor(score: number): { text: string; ring: string; glow: string } {
  if (score >= 70) return { text: 'text-atlas',  ring: 'stroke-atlas',  glow: 'shadow-atlas'  }
  if (score >= 50) return { text: 'text-oracle', ring: 'stroke-oracle', glow: 'shadow-oracle' }
  if (score >= 30) return { text: 'text-pulse',  ring: 'stroke-pulse',  glow: 'shadow-pulse'  }
  return             { text: 'text-bear',   ring: 'stroke-bear',   glow: 'shadow-card'   }
}

/**
 * Live score gauge for the MANDO hero slot. Replaces the previous decorative
 * "quantum core" widget — every value shown here is real Oracle data, and the
 * only motion is a slow ambient ring rotation, not a fake "scanning" animation.
 */
export function ScoreOrb({ score, label }: ScoreOrbProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { text, ring, glow } = bandColor(score)
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference

  return (
    <div className={clsx('relative flex items-center justify-center w-56 h-56 rounded-full transition-shadow duration-700', glow)}>
      {/* Ambient outer ring — slow, subtle, decorative only */}
      <div className="absolute inset-0 rounded-full border border-bg-border animate-glow-pulse" style={{ animationDuration: '4s' }} />

      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-bg-border" />
        <circle
          cx="48" cy="48" r="42" fill="none" strokeWidth="2.5" strokeLinecap="round"
          className={clsx(ring, 'transition-all duration-1000 ease-out')}
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? offset : circumference}
        />
      </svg>

      <div className="relative flex flex-col items-center">
        <span className={clsx('text-5xl font-mono font-bold tabular-nums tracking-tight', text)}>
          {score}
        </span>
        <span className="text-[10px] font-mono text-ink-dim uppercase tracking-[0.25em] mt-1">
          {label}
        </span>
      </div>
    </div>
  )
}
