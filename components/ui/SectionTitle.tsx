import { clsx } from 'clsx'

interface SectionTitleProps {
  label:      string
  sublabel?:  string
  accent?:    'atlas' | 'nexus' | 'pulse' | 'oracle'
  right?:     React.ReactNode
  className?: string
}

const ACCENT_COLORS = {
  atlas:  'border-atlas text-atlas',
  nexus:  'border-nexus text-nexus',
  pulse:  'border-pulse text-pulse',
  oracle: 'border-oracle text-oracle',
}

export function SectionTitle({
  label, sublabel, accent = 'oracle', right, className,
}: SectionTitleProps) {
  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <div className="flex items-center gap-3">
        <div className={clsx(
          'w-0.5 h-5 rounded-full',
          `bg-${accent}`,
        )} />
        <div>
          <h2 className="text-xs font-mono font-semibold text-ink-secondary uppercase tracking-[0.15em]">
            {label}
          </h2>
          {sublabel && (
            <p className="text-2xs text-ink-muted mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}
