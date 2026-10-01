'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

export interface TourStep {
  /** CSS selector for the element to spotlight — must already be in the DOM when this step is shown. */
  target: string
  title: string
  description: string
}

interface TourProps {
  steps: TourStep[]
  active: boolean
  onClose: () => void
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const SPOTLIGHT_PADDING = 8
const TOOLTIP_WIDTH = 320
const VIEWPORT_MARGIN = 16

// A generic step-by-step coachmark overlay: dims the page, cuts a spotlight
// around the current step's target element, and shows a small card with
// title/description, a progress bar and Atrás/Siguiente/Cerrar controls.
// Deliberately framework-free beyond React/Tailwind (same philosophy as
// TermHelp) so it can be dropped onto any page without new dependencies.
export function Tour({ steps, active, onClose }: TourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const step = steps[stepIndex]

  useEffect(() => {
    if (active) setStepIndex(0)
  }, [active])

  useEffect(() => {
    if (!active || !step) return

    let cancelled = false
    function measure() {
      const el = document.querySelector(step.target)
      if (!el) {
        if (!cancelled) setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (!cancelled) {
        setRect({
          top: r.top - SPOTLIGHT_PADDING,
          left: r.left - SPOTLIGHT_PADDING,
          width: r.width + SPOTLIGHT_PADDING * 2,
          height: r.height + SPOTLIGHT_PADDING * 2,
        })
      }
    }

    document.querySelector(step.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const settleTimer = setTimeout(measure, 300)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelled = true
      clearTimeout(settleTimer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, step])

  useEffect(() => {
    if (!active) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, onClose])

  if (!active || !step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex === steps.length - 1

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768

  let tooltipTop: number
  let tooltipLeft: number
  if (rect) {
    const spaceBelow = viewportH - (rect.top + rect.height)
    tooltipTop = spaceBelow > 240 ? rect.top + rect.height + 12 : Math.max(VIEWPORT_MARGIN, rect.top - 240)
    tooltipLeft = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), viewportW - TOOLTIP_WIDTH - VIEWPORT_MARGIN)
  } else {
    tooltipTop = viewportH / 2 - 110
    tooltipLeft = viewportW / 2 - TOOLTIP_WIDTH / 2
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="fixed rounded-lg border-2 border-oracle pointer-events-none transition-all duration-300 ease-out"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px rgba(4, 7, 13, 0.78)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-bg-deep/80" />
      )}

      <div
        className="fixed rounded-xl border border-oracle/40 bg-bg-elevated shadow-xl px-5 py-4 space-y-3 transition-all duration-300 ease-out"
        style={{ top: tooltipTop, left: tooltipLeft, width: TOOLTIP_WIDTH }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-sans font-semibold text-ink-primary">{step.title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tutorial"
            className="text-ink-dim hover:text-ink-primary transition-colors shrink-0 leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-xs font-sans leading-relaxed text-ink-secondary">{step.description}</p>
        <div className="space-y-2">
          <div className="h-1 rounded-full bg-bg-border overflow-hidden">
            <div className="h-full bg-oracle rounded-full transition-all duration-300" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-ink-dim whitespace-nowrap">
              Paso {stepIndex + 1} de {steps.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded-md text-[11px] font-mono text-ink-dim hover:text-ink-secondary transition-colors"
              >
                Saltar
              </button>
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i - 1)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-bg-border text-ink-secondary hover:border-ink-muted transition-colors"
                >
                  Atrás
                </button>
              )}
              <button
                type="button"
                onClick={() => (isLast ? onClose() : setStepIndex((i) => i + 1))}
                className={clsx('px-3 py-1 rounded-md text-[11px] font-mono font-semibold bg-oracle text-bg-deep hover:opacity-90 transition-opacity')}
              >
                {isLast ? 'Listo' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
