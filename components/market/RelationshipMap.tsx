'use client'

import Link from 'next/link'
import { clsx } from 'clsx'

export interface RelatedNode {
  symbol: string
  changePct: number | null
  volume: number | null
}

export function RelationshipMap({ center, centerPrice, nodes }: { center: string; centerPrice?: string; nodes: RelatedNode[] }) {
  if (nodes.length === 0) return null

  const maxVolume = Math.max(1, ...nodes.map((n) => n.volume ?? 0))
  const upCount = nodes.filter((n) => (n.changePct ?? 0) >= 0).length
  const against = nodes.filter((n) => n.changePct !== null && n.changePct < 0).map((n) => n.symbol)

  // Elliptical layout: container is wider than tall, so separate x/y radii keep nodes evenly spaced
  const RX = 36
  const RY = 38
  const points = nodes.map((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
    return { node, xPct: 50 + RX * Math.cos(angle), yPct: 50 + RY * Math.sin(angle) }
  })

  const headline =
    upCount === nodes.length
      ? `Los ${nodes.length} activos relacionados suben hoy.`
      : upCount === 0
        ? `Los ${nodes.length} activos relacionados bajan hoy.`
        : `${upCount} de ${nodes.length} activos relacionados suben hoy.`

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8 lg:gap-10 items-center">
      <div className="space-y-3.5">
        <p className="text-[11px] font-mono text-pulse uppercase tracking-[0.16em]">Mapa de relación</p>
        <p className="text-2xl font-sans font-medium leading-snug text-ink-primary text-pretty">{headline}</p>
        {against.length > 0 && upCount > 0 && (
          <p className="text-sm font-sans leading-relaxed text-ink-secondary text-pretty">
            {against.length === 1 ? `Solo ${against[0]} se mueve` : `${against.join(', ')} se mueven`} en contra de {center}.
          </p>
        )}
        <div className="flex flex-col gap-2 pt-2 text-[11px] font-mono text-ink-secondary">
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-atlas" />Sube</span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-bear" />Baja</span>
          <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full border border-ink-secondary" />Tamaño = volumen relativo</span>
        </div>
      </div>

      <div className="relative w-full aspect-[16/10] min-h-[320px]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <ellipse cx={50} cy={50} rx={RX * 0.62} ry={RY * 0.62} fill="none" stroke="#1A1F2E" vectorEffect="non-scaling-stroke" />
          <ellipse cx={50} cy={50} rx={RX} ry={RY} fill="none" stroke="#12161F" vectorEffect="non-scaling-stroke" />
          {points.map(({ node, xPct, yPct }) => (
            <line key={`line-${node.symbol}`} x1={50} y1={50} x2={xPct} y2={yPct} stroke="#2A303D" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        <div
          className="absolute flex flex-col items-center justify-center rounded-full bg-pulse text-bg-deep font-mono"
          style={{ left: '50%', top: '50%', width: 112, height: 112, transform: 'translate(-50%, -50%)' }}
        >
          <span className="text-sm font-bold leading-none">{center}</span>
          {centerPrice && <span className="text-[11px] leading-none mt-1.5 tabular-nums">{centerPrice}</span>}
        </div>

        {points.map(({ node, xPct, yPct }) => {
          const up = node.changePct !== null && node.changePct >= 0
          const size = 52 + Math.round(((node.volume ?? 0) / maxVolume) * 24)
          return (
            <Link
              key={node.symbol}
              href={`/dashboard/stock/${node.symbol}`}
              className={clsx(
                'absolute flex flex-col items-center justify-center rounded-full border font-mono transition-transform hover:scale-110',
                up ? 'border-atlas bg-atlas/10' : 'border-bear bg-bear/10',
              )}
              style={{ left: `${xPct}%`, top: `${yPct}%`, width: size, height: size, transform: 'translate(-50%, -50%)' }}
            >
              <span className="text-xs font-semibold leading-none text-ink-primary">{node.symbol}</span>
              <span className={clsx('text-[10px] leading-none mt-1 tabular-nums', up ? 'text-atlas' : 'text-bear')}>
                {node.changePct !== null ? `${up ? '+' : ''}${node.changePct.toFixed(2)}%` : '—'}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
