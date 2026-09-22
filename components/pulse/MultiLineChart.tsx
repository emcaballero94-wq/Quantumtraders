'use client'

export interface ChartSeries {
  symbol: string
  color: string
  points: { date: string; value: number }[]
}

export function MultiLineChart({ series, height = 180 }: { series: ChartSeries[]; height?: number }) {
  const allValues = series.flatMap((s) => s.points.map((p) => p.value))
  if (allValues.length < 2) {
    return <div className="h-40 flex items-center justify-center text-xs font-mono text-ink-dim">Sin datos suficientes</div>
  }

  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = max - min || 1
  const w = 100
  const h = 100

  const maxLen = Math.max(...series.map((s) => s.points.length))
  const longest = series.find((s) => s.points.length === maxLen)
  const dateLabels = longest
    ? [longest.points[0]?.date, longest.points[Math.floor(longest.points.length / 2)]?.date, longest.points[longest.points.length - 1]?.date]
    : []

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.symbol} className="flex items-center gap-1.5 text-[10px] font-mono text-ink-secondary">
            <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.symbol}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} className="w-full">
        {/* zero/baseline reference if range crosses 0 */}
        {min < 0 && max > 0 && (
          <line x1={0} y1={h - ((0 - min) / range) * h} x2={w} y2={h - ((0 - min) / range) * h} stroke="currentColor" className="text-bg-border" strokeWidth={0.4} strokeDasharray="1.5,1.5" />
        )}
        {series.map((s) => {
          if (s.points.length < 2) return null
          const points = s.points.map((p, i) => {
            const x = (i / (s.points.length - 1)) * w
            const y = h - ((p.value - min) / range) * h
            return `${x},${y}`
          })
          return (
            <polyline
              key={s.symbol}
              points={points.join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={0.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      {dateLabels.length === 3 && (
        <div className="flex justify-between text-[9px] font-mono text-ink-dim">
          {dateLabels.map((d, i) => (
            <span key={i}>{d ? new Date(d).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) : ''}</span>
          ))}
        </div>
      )}
    </div>
  )
}
