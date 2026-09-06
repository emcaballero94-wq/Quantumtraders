'use client'

import { clsx } from 'clsx'

export type PathNodeState = 'locked' | 'current' | 'done'

export interface PathNodeData {
  id: string
  kind: 'lesson' | 'checkpoint'
  label: string
  state: PathNodeState
  onClick?: () => void
}

const ACCENT_CLASSES: Record<string, { text: string; bg: string; border: string; ring: string; solid: string }> = {
  oracle: { text: 'text-oracle', bg: 'bg-oracle/20', border: 'border-oracle', ring: 'ring-oracle/40', solid: 'bg-oracle' },
  atlas: { text: 'text-atlas', bg: 'bg-atlas/20', border: 'border-atlas', ring: 'ring-atlas/40', solid: 'bg-atlas' },
  nexus: { text: 'text-nexus', bg: 'bg-nexus/20', border: 'border-nexus', ring: 'ring-nexus/40', solid: 'bg-nexus' },
  pulse: { text: 'text-pulse', bg: 'bg-pulse/20', border: 'border-pulse', ring: 'ring-pulse/40', solid: 'bg-pulse' },
}

function LockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />
    </svg>
  )
}

function nodeOffset(i: number): number {
  return Math.sin(i * 0.85)
}

function buildPathD(points: { x: number; y: number }[]): string {
  return points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = points[i - 1]
    const midY = (prev.y + p.y) / 2
    return `${acc} C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`
  }, '')
}

export function LearningPath({ nodes, accent = 'oracle' }: { nodes: PathNodeData[]; accent?: keyof typeof ACCENT_CLASSES }) {
  const spacing = 150
  const amplitude = 22
  const topPad = 44
  const bottomPad = 96
  const height = topPad + Math.max(0, nodes.length - 1) * spacing + bottomPad

  const points = nodes.map((_, i) => ({ x: 50 + nodeOffset(i) * amplitude, y: topPad + i * spacing }))

  const lastDoneIndex = nodes.reduce((acc, n, i) => (n.state === 'done' ? i : acc), -1)
  const colors = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.oracle

  return (
    <div className="relative mx-auto w-full max-w-[380px]" style={{ height }}>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <path d={buildPathD(points)} fill="none" stroke="currentColor" className="text-bg-border" strokeWidth={3} strokeLinecap="round" />
        {lastDoneIndex > 0 && (
          <path d={buildPathD(points.slice(0, lastDoneIndex + 1))} fill="none" stroke="currentColor" className={colors.text} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        )}
      </svg>

      {points.map((p, i) => {
        const node = nodes[i]
        const isCheckpoint = node.kind === 'checkpoint'
        const size = isCheckpoint ? 72 : 60

        return (
          <div key={node.id} className="absolute" style={{ left: `${p.x}%`, top: p.y }}>
            <button
              type="button"
              onClick={node.onClick}
              disabled={node.state === 'locked' || !node.onClick}
              aria-label={node.label}
              style={{ width: size, height: size, transform: 'translate(-50%, -50%)' }}
              className={clsx(
                'absolute left-0 top-0 rounded-full border-[3px] flex items-center justify-center font-mono font-extrabold transition-all shrink-0 shadow-lg',
                node.state === 'locked' && 'bg-bg-elevated border-bg-border text-ink-dim cursor-not-allowed shadow-none',
                node.state === 'done' && clsx(colors.bg, colors.border, colors.text, 'hover:scale-105'),
                node.state === 'current' && clsx(colors.bg, colors.border, colors.text, 'animate-pulse-slow ring-4', colors.ring, 'hover:scale-105'),
              )}
            >
              {node.state === 'locked' ? (
                <LockIcon />
              ) : isCheckpoint ? (
                <StarIcon />
              ) : node.state === 'done' ? (
                <CheckIcon />
              ) : (
                <span className="text-lg">{i + 1}</span>
              )}
            </button>

            <span
              className={clsx(
                'absolute left-0 -translate-x-1/2 text-center text-[11px] font-mono font-bold leading-snug max-w-[140px] px-2.5 py-1.5 rounded-lg border',
                node.state === 'locked'
                  ? 'text-ink-dim border-bg-border/60 bg-bg-deep/60'
                  : 'text-ink-primary border-bg-border bg-bg-deep/90',
              )}
              style={{ top: size / 2 + 10 }}
            >
              {node.kind === 'checkpoint' ? 'EXAMEN · ' : ''}
              {node.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
