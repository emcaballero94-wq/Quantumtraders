'use client'

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// Semicircle gauge, 180° (left) to 0° (right), value in [0, 100]
export function GaugeMeter({
  value,
  leftLabel = 'DÉBIL',
  rightLabel = 'FUERTE',
  centerLabel = 'MODERADO',
}: {
  value: number
  leftLabel?: string
  rightLabel?: string
  centerLabel?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  const cx = 100
  const cy = 92
  const r = 78

  const startAngle = 180
  const endAngle = 0
  const needleAngle = startAngle + (clamped / 100) * (endAngle - startAngle)

  const arcStart = polarToCartesian(cx, cy, r, startAngle)
  const arcEnd = polarToCartesian(cx, cy, r, endAngle)
  const needleTip = polarToCartesian(cx, cy, r - 14, needleAngle)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#00C9A7" />
          </linearGradient>
        </defs>
        <path
          d={`M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 0 1 ${arcEnd.x} ${arcEnd.y}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#F5F7FA" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill="#F5F7FA" />
      </svg>
      <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest -mt-2">{centerLabel}</p>
      <p className="text-xl font-mono font-bold text-ink-primary">{clamped.toFixed(1)}</p>
      <div className="flex items-center justify-between w-full max-w-[220px] mt-0.5">
        <span className="text-[9px] font-mono text-ink-dim uppercase">{leftLabel}</span>
        <span className="text-[9px] font-mono text-ink-dim uppercase">{rightLabel}</span>
      </div>
    </div>
  )
}
