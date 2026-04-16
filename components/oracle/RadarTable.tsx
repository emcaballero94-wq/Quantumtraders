import { clsx } from 'clsx'
import Link from 'next/link'
import type { RadarAsset } from '@/lib/oracle/types'
import { RatingBadge, BiasBadge } from '@/components/ui/StatusBadge'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface RadarTableProps {
  assets: RadarAsset[]
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-atlas' : score >= 50 ? 'bg-oracle' : score >= 30 ? 'bg-pulse' : 'bg-bear'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 rounded-full bg-bg-border overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums text-ink-secondary w-6">{score}</span>
    </div>
  )
}

export function RadarTable({ assets }: RadarTableProps) {
  return (
    <div className="rounded-xl border border-bg-border bg-bg-card overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-bg-border">
        <SectionTitle
          label="Radar de Activos"
          sublabel={`${assets.length} activos analizados`}
          accent="oracle"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-bg-border">
              {['Activo', 'Macro', 'Técnico', 'Timing', 'Total', 'Bias', 'Estado', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-2xs font-mono font-semibold text-ink-muted uppercase tracking-[0.15em] bg-bg-elevated"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, idx) => {
              const isTop = idx === 0
              return (
                <tr
                  key={asset.symbol}
                  className={clsx(
                    'border-b border-bg-border transition-colors',
                    isTop ? 'bg-atlas/5' : 'hover:bg-bg-elevated',
                  )}
                >
                  {/* Symbol */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isTop && (
                        <span className="text-atlas text-2xs">★</span>
                      )}
                      <div>
                        <p className="text-sm font-mono font-semibold text-ink-primary">
                          {asset.symbol}
                        </p>
                        <p className="text-2xs font-mono text-ink-muted">{asset.category.toUpperCase()}</p>
                      </div>
                    </div>
                  </td>

                  {/* Macro */}
                  <td className="px-4 py-3">
                    <ScoreBar score={asset.macroScore} />
                  </td>

                  {/* Technical */}
                  <td className="px-4 py-3">
                    <ScoreBar score={asset.technicalScore} />
                  </td>

                  {/* Timing */}
                  <td className="px-4 py-3">
                    <ScoreBar score={asset.timingScore} />
                  </td>

                  {/* Total */}
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'text-sm font-mono font-bold tabular-nums',
                      asset.totalScore >= 70 ? 'text-atlas'
                      : asset.totalScore >= 50 ? 'text-oracle'
                      : asset.totalScore >= 30 ? 'text-pulse'
                      : 'text-bear',
                    )}>
                      {asset.totalScore}
                    </span>
                  </td>

                  {/* Bias */}
                  <td className="px-4 py-3">
                    <BiasBadge bias={asset.bias} size="sm" />
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-3">
                    <RatingBadge rating={asset.rating} />
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    {asset.rating !== 'avoid' && (
                      <Link
                        href={`/dashboard/atlas?symbol=${asset.symbol}`}
                        className="text-2xs font-mono text-atlas hover:text-atlas/80 transition-colors"
                      >
                        Analizar →
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
