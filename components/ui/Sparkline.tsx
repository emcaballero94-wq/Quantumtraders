'use client'

export function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) {
    return <div className="h-10 w-full flex items-center justify-center text-[9px] font-mono text-ink-dim">Sin datos</div>
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 100
  const h = 32

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  })

  const color = up ? '#10B981' : '#EF4444'
  const areaPoints = `0,${h} ${points.join(' ')} ${w},${h}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-10">
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
