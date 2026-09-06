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

const ACCENT_CLASSES: Record<string, { text: string; bg: string; border: string; ring: string }> = {
  oracle: { text: 'text-oracle', bg: 'bg-oracle/15', border: 'border-oracle', ring: 'ring-oracle/30' },
  atlas: { text: 'text-atlas', bg: 'bg-atlas/15', border: 'border-atlas', ring: 'ring-atlas/30' },
  nexus: { text: 'text-nexus', bg: 'bg-nexus/15', border: 'border-nexus', ring: 'ring-nexus/30' },
  pulse: { text: 'text-pulse', bg: 'bg-pulse/15', border: 'border-pulse', ring: 'ring-pulse/30' },
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
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
  const spacing = 92
  const amplitude = 24
  const topPad = 40
  const height = topPad + Math.max(0, nodes.length - 1) * spacing + 40

  const points = nodes.map((_, i) => ({ x: 50 + nodeOffset(i) * amplitude, y: topPad + i * spacing }))

  const lastDoneIndex = nodes.reduce((acc, n, i) => (n.state === 'done' ? i : acc), -1)
  const colors = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.oracle

  return (
    <div className="relative mx-auto w-full max-w-[340px]" style={{ height }}>
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        <path d={buildPathD(points)} fill="none" stroke="currentColor" className="text-bg-border" strokeWidth={3.5} strokeLinecap="round" />
        {lastDoneIndex > 0 && (
          <path d={buildPathD(points.slice(0, lastDoneIndex + 1))} fill="none" stroke="currentColor" className={colors.text} strokeWidth={3.5} strokeLinecap="round" opacity={0.55} />
        )}
      </svg>

      {points.map((p, i) => {
        const node = nodes[i]
        const isCheckpoint = node.kind === 'checkpoint'
        const size = isCheckpoint ? 60 : 52
        return (
          <div key={node.id} className="absolute flex flex-col items-center gap-1.5" style={{ left: `${p.x}%`, top: p.y, transform: 'translate(-50%, -50%)' }}>
            <button
              type="button"
              onClick={node.onClick}
              disabled={node.state === 'locked' || !node.onClick}
              aria-label={node.label}
              style={{ width: size, height: size }}
              className={clsx(
                'rounded-full border-2 flex items-center justify-center font-mono font-bold transition-all shrink-0',
                node.state === 'locked' && 'bg-bg-elevated/60 border-bg-border text-ink-dim cursor-not-allowed',
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
                <span className="text-sm">{i + 1}</span>
              )}
            </button>
            <span className={clsx('text-[9px] font-mono text-center max-w-[86px] leading-tight', node.state === 'locked' ? 'text-ink-dim' : 'text-ink-secondary')}>
              {node.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
