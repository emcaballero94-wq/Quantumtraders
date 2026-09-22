import { clsx } from 'clsx'

const ACCENT_COLORS = {
  atlas: 'bg-atlas/15 border-atlas/40 text-atlas',
  nexus: 'bg-nexus/15 border-nexus/40 text-nexus',
  pulse: 'bg-pulse/15 border-pulse/40 text-pulse',
  oracle: 'bg-oracle/15 border-oracle/40 text-oracle',
}

export function NumberedSection({
  number,
  title,
  subtitle,
  right,
  accent = 'pulse',
  className,
}: {
  number: string
  title: string
  subtitle?: string
  right?: React.ReactNode
  accent?: keyof typeof ACCENT_COLORS
  className?: string
}) {
  return (
    <div className={clsx('flex items-center justify-between gap-3 flex-wrap', className)}>
      <div className="flex items-center gap-3">
        <span className={clsx('w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-mono font-bold shrink-0', ACCENT_COLORS[accent])}>
          {number}
        </span>
        <div>
          <h2 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-[0.12em]">{title}</h2>
          {subtitle && <p className="text-[10px] font-mono text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}
