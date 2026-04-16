'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

interface CollapsePanelProps {
  title:        string
  defaultOpen?: boolean
  children:     React.ReactNode
  className?:   string
  badge?:       React.ReactNode
}

export function CollapsePanel({
  title, defaultOpen = false, children, className, badge,
}: CollapsePanelProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={clsx('border border-bg-border rounded-lg overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-card hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-ink-secondary uppercase tracking-[0.12em]">
            {title}
          </span>
          {badge}
        </div>
        <svg
          className={clsx(
            'w-4 h-4 text-ink-muted transition-transform duration-200',
            open ? 'rotate-180' : 'rotate-0',
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="animate-fade-in bg-bg-base">
          {children}
        </div>
      )}
    </div>
  )
}
