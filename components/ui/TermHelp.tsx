'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { getGlossaryTerm } from '@/lib/glossary/content'

interface TermHelpProps {
  /** Key into lib/glossary/content.ts, e.g. "open_interest". */
  term: string
  className?: string
}

// A small "?" badge next to a live metric label that pops a short, honest
// explainer in place — "Open Interest" → what it is + why it matters —
// instead of sending the trader away to a separate Academy page. Renders
// nothing if the term isn't in the glossary yet, so it's safe to drop next
// to any label speculatively.
export function TermHelp({ term, className }: TermHelpProps) {
  const entry = getGlossaryTerm(term)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!entry) return null

  return (
    <span ref={containerRef} className={clsx('relative inline-flex align-middle', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Ayuda: ${entry.term}`}
        aria-expanded={open}
        className={clsx(
          'inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[9px] font-mono leading-none transition-colors',
          open
            ? 'border-oracle/60 bg-oracle/10 text-oracle'
            : 'border-bg-border text-ink-dim hover:border-oracle/40 hover:text-oracle',
        )}
      >
        ?
      </button>

      {open && (
        <div className="absolute z-50 top-5 left-0 w-64 rounded-lg border border-bg-border bg-bg-elevated shadow-lg px-4 py-3 text-left normal-case tracking-normal">
          <p className="text-xs font-sans font-semibold text-ink-primary mb-1">{entry.term}</p>
          <p className="text-[11px] font-sans leading-relaxed text-ink-secondary mb-2">{entry.definition}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-dim mb-1">Por qué importa</p>
          <p className="text-[11px] font-sans leading-relaxed text-ink-secondary">{entry.whyItMatters}</p>
          {entry.learnMoreHref && (
            <a
              href={entry.learnMoreHref}
              className="mt-2 inline-block text-[10px] font-mono uppercase tracking-wider text-oracle hover:underline"
            >
              Learn 2 min →
            </a>
          )}
        </div>
      )}
    </span>
  )
}
