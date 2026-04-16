import { clsx } from 'clsx'
import type { Bias, Rating } from '@/lib/oracle/types'

// ─── Rating Badge ────────────────────────────────────────────

interface RatingBadgeProps {
  rating:    Rating
  className?: string
}

const RATING_STYLES: Record<Rating, string> = {
  strong:   'bg-atlas/10 text-atlas border-atlas/30',
  operable: 'bg-oracle/10 text-oracle border-oracle/30',
  mixed:    'bg-pulse/10 text-pulse border-pulse/30',
  avoid:    'bg-bear/10 text-bear border-bear/30',
}

const RATING_LABELS: Record<Rating, string> = {
  strong:   'STRONG',
  operable: 'OPERABLE',
  mixed:    'MIXED',
  avoid:    'AVOID',
}

const RATING_DOTS: Record<Rating, string> = {
  strong:   'bg-atlas animate-pulse-slow',
  operable: 'bg-oracle',
  mixed:    'bg-pulse',
  avoid:    'bg-bear',
}

export function RatingBadge({ rating, className }: RatingBadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-2xs font-mono font-semibold tracking-widest uppercase',
      RATING_STYLES[rating], className,
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', RATING_DOTS[rating])} />
      {RATING_LABELS[rating]}
    </span>
  )
}

// ─── Bias Badge ──────────────────────────────────────────────

interface BiasBadgeProps {
  bias:      Bias
  size?:     'sm' | 'md'
  className?: string
}

const BIAS_STYLES: Record<Bias, string> = {
  long:    'bg-atlas/10 text-atlas border-atlas/30',
  short:   'bg-bear/10 text-bear border-bear/30',
  neutral: 'bg-ink-muted/10 text-ink-secondary border-ink-muted/20',
}

const BIAS_ARROWS: Record<Bias, string> = {
  long:    '↑',
  short:   '↓',
  neutral: '→',
}

const BIAS_LABELS: Record<Bias, string> = {
  long:    'ALCISTA',
  short:   'BAJISTA',
  neutral: 'NEUTRAL',
}

export function BiasBadge({ bias, size = 'md', className }: BiasBadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded border font-mono font-bold tracking-wider uppercase',
      size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs',
      BIAS_STYLES[bias], className,
    )}>
      <span>{BIAS_ARROWS[bias]}</span>
      {BIAS_LABELS[bias]}
    </span>
  )
}

// ─── Session Badge ───────────────────────────────────────────

interface SessionBadgeProps {
  name:      string
  isActive:  boolean
  killZone?: boolean
  className?: string
}

export function SessionBadge({ name, isActive, killZone, className }: SessionBadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-2xs font-mono',
      isActive
        ? killZone
          ? 'bg-pulse/10 text-pulse border-pulse/30'
          : 'bg-atlas/10 text-atlas border-atlas/30'
        : 'bg-bg-card text-ink-muted border-bg-border',
      className,
    )}>
      <span className={clsx(
        'w-1.5 h-1.5 rounded-full',
        isActive ? killZone ? 'bg-pulse animate-pulse-slow' : 'bg-atlas animate-pulse-slow' : 'bg-ink-dim',
      )} />
      {name}
      {killZone && isActive && <span className="text-pulse">KZ</span>}
    </span>
  )
}

// ─── Alert Severity Badge ────────────────────────────────────

interface AlertBadgeProps {
  severity: 'info' | 'warning' | 'critical'
  className?: string
}

export function AlertBadge({ severity, className }: AlertBadgeProps) {
  const styles = {
    info:     'bg-oracle/10 text-oracle border-oracle/30',
    warning:  'bg-pulse/10 text-pulse border-pulse/30',
    critical: 'bg-bear/10 text-bear border-bear/30',
  }

  return (
    <span className={clsx(
      'inline-flex px-1.5 py-0.5 rounded border text-2xs font-mono font-semibold uppercase tracking-wider',
      styles[severity], className,
    )}>
      {severity}
    </span>
  )
}
