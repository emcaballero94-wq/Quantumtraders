import { clsx } from 'clsx'

interface ScoreBadgeProps {
  score:     number
  size?:     'sm' | 'md' | 'lg'
  showBar?:  boolean
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-atlas'
  if (score >= 50) return 'text-oracle'
  if (score >= 30) return 'text-pulse'
  return 'text-bear'
}

function getBarColor(score: number): string {
  if (score >= 70) return 'bg-atlas'
  if (score >= 50) return 'bg-oracle'
  if (score >= 30) return 'bg-pulse'
  return 'bg-bear'
}

const SIZES = {
  sm: 'text-xs font-mono font-semibold',
  md: 'text-sm font-mono font-bold',
  lg: 'text-xl font-mono font-bold tracking-tight',
}

export function ScoreBadge({ score, size = 'md', showBar = false, className }: ScoreBadgeProps) {
  const color   = getScoreColor(score)
  const barColor = getBarColor(score)

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <span className={clsx(SIZES[size], color)}>
        {score}<span className="opacity-50 text-[0.7em]">/100</span>
      </span>
      {showBar && (
        <div className="h-1 w-full rounded-full bg-bg-border overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Mini score pill ─────────────────────────────────────────

interface ScorePillProps {
  score:     number
  label?:    string
  className?: string
}

export function ScorePill({ score, label, className }: ScorePillProps) {
  const color    = getScoreColor(score)
  const bgColor  = score >= 70 ? 'bg-atlas/10 border-atlas/30'
                 : score >= 50 ? 'bg-oracle/10 border-oracle/30'
                 : score >= 30 ? 'bg-pulse/10 border-pulse/30'
                 :                'bg-bear/10 border-bear/30'

  return (
    <div className={clsx(
      'inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono',
      bgColor, className,
    )}>
      {label && <span className="text-ink-muted uppercase tracking-wider text-2xs">{label}</span>}
      <span className={clsx('font-semibold', color)}>{score}</span>
    </div>
  )
}
