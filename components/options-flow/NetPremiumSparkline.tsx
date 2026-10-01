'use client'

export interface NetPremiumSeriesPoint {
  bucketEnd: number
  netPremium: number
  cumulativeNetPremium: number
}

interface NetPremiumSparklineProps {
  points: NetPremiumSeriesPoint[]
  height?: number
}

const WIDTH = 600
const PADDING_X = 8
const PADDING_Y = 12

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
}

// Deliberately framework-free (same philosophy as components/tour/Tour.tsx) —
// a small inline SVG line chart needs no charting library.
export function NetPremiumSparkline({ points, height = 140 }: NetPremiumSparklineProps) {
  if (points.length === 0) {
    return <div className="flex items-center justify-center h-[140px] text-xs font-mono text-ink-dim">Sin datos suficientes</div>
  }

  const values = points.map((p) => p.cumulativeNetPremium)
  const minValue = Math.min(0, ...values)
  const maxValue = Math.max(0, ...values)
  const range = maxValue - minValue || 1

  const plotWidth = WIDTH - PADDING_X * 2
  const plotHeight = height - PADDING_Y * 2

  const xFor = (index: number) => PADDING_X + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
  const yFor = (value: number) => PADDING_Y + plotHeight - ((value - minValue) / range) * plotHeight

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.cumulativeNetPremium).toFixed(1)}`).join(' ')
  const zeroY = yFor(0)
  const last = points[points.length - 1]
  const isBearish = last.cumulativeNetPremium < 0
  const lineColor = isBearish ? 'rgb(var(--c-bear))' : 'rgb(var(--c-atlas))'

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <line x1={PADDING_X} y1={zeroY} x2={WIDTH - PADDING_X} y2={zeroY} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="4 4" />
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.bucketEnd} cx={xFor(i)} cy={yFor(p.cumulativeNetPremium)} r={2} fill={lineColor} />
      ))}
      <text x={PADDING_X} y={height - 2} fontSize={9} fontFamily="monospace" fill="currentColor" opacity={0.5}>
        {fmtTime(points[0].bucketEnd)}
      </text>
      <text x={WIDTH - PADDING_X} y={height - 2} fontSize={9} fontFamily="monospace" fill="currentColor" opacity={0.5} textAnchor="end">
        {fmtTime(last.bucketEnd)}
      </text>
    </svg>
  )
}
