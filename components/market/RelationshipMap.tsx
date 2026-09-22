'use client'

import Link from 'next/link'
import { clsx } from 'clsx'

export interface RelatedNode {
  symbol: string
  changePct: number | null
  volume: number | null
}

export function RelationshipMap({ center, nodes }: { center: string; nodes: RelatedNode[] }) {
  if (nodes.length === 0) return null

  const radiusPct = 34
  const maxVolume = Math.max(1, ...nodes.map((n) => n.volume ?? 0))

  const points = nodes.map((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
    return {
      node,
      xPct: 50 + radiusPct * Math.cos(angle),
      yPct: 50 + radiusPct * Math.sin(angle),
    }
  })

  return (
    <div className="rounded-xl border border-bg-border bg-black/40 p-5 space-y-3">
      <p className="text-[10px] font-mono text-pulse uppercase tracking-widest font-bold">Mapa de relación · Activos correlacionados por sector</p>
      {/* Square, percentage-positioned so nodes never clip regardless of viewport width */}
      <div className="relative mx-auto w-full max-w-[380px] aspect-square">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.map(({ node, xPct, yPct }) => (
            <line
              key={`line-${node.symbol}`}
              x1={50}
              y1={50}
              x2={xPct}
              y2={yPct}
              stroke={node.changePct !== null && node.changePct >= 0 ? '#10B981' : '#EF4444'}
              strokeOpacity={0.35}
              strokeWidth={0.6}
            />
          ))}
        </svg>

        {/* Center node */}
        <div
          className="absolute flex items-center justify-center rounded-full border-2 border-pulse bg-pulse/15 text-pulse font-mono font-extrabold shadow-lg"
          style={{ left: '50%', top: '50%', width: 76, height: 76, transform: 'translate(-50%, -50%)' }}
        >
          <span className="text-xs">{center}</span>
        </div>

        {points.map(({ node, xPct, yPct }) => {
          const up = node.changePct !== null && node.changePct >= 0
          const volumeRatio = (node.volume ?? 0) / maxVolume
          const nodeSize = 44 + Math.round(volumeRatio * 20)
          return (
            <Link
              key={node.symbol}
              href={`/dashboard/stock/${node.symbol}`}
              className={clsx(
                'absolute flex flex-col items-center justify-center rounded-full border-2 font-mono font-bold transition-transform hover:scale-110',
                up ? 'border-atlas bg-atlas/10 text-atlas' : 'border-bear bg-bear/10 text-bear',
              )}
              style={{ left: `${xPct}%`, top: `${yPct}%`, width: nodeSize, height: nodeSize, transform: 'translate(-50%, -50%)' }}
            >
              <span className="text-[10px] leading-none">{node.symbol}</span>
              <span className="text-[8px] leading-none mt-0.5">
                {node.changePct !== null ? `${up ? '+' : ''}${node.changePct.toFixed(1)}%` : '—'}
              </span>
            </Link>
          )
        })}
      </div>
      <p className="text-[9px] font-mono text-ink-dim text-center">Tamaño del nodo ≈ volumen relativo · Color = variación del día en vivo</p>
    </div>
  )
}
