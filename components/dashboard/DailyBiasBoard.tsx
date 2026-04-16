import { scoreSetupFromAsset } from '@/lib/oracle/setup-rules'
import type { RadarAsset } from '@/lib/oracle/types'

interface DailyBiasBoardProps {
  assets: RadarAsset[]
}

function biasLabel(bias: RadarAsset['bias']): string {
  if (bias === 'long') return 'Alcista'
  if (bias === 'short') return 'Bajista'
  return 'Neutral'
}

export function DailyBiasBoard({ assets }: DailyBiasBoardProps) {
  const topAssets = [...assets].sort((a, b) => b.totalScore - a.totalScore).slice(0, 8)

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-bold text-ink-primary uppercase tracking-widest">Sesgo del día por activo</h3>
        <span className="text-[10px] font-mono text-ink-dim uppercase">Score 0-100</span>
      </div>
      <div className="space-y-2">
        {topAssets.map((asset) => {
          const setup = scoreSetupFromAsset({ asset })
          return (
            <div key={asset.symbol} className="flex items-center justify-between px-3 py-2 rounded-lg border border-bg-border bg-bg-elevated/30">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-ink-primary">{asset.symbol}</span>
                <span className={`text-[10px] font-mono uppercase ${asset.bias === 'long' ? 'text-atlas' : asset.bias === 'short' ? 'text-bear' : 'text-ink-muted'}`}>
                  {biasLabel(asset.bias)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-ink-dim">{setup.confluence.count}/4 confluencias</span>
                <span className={`text-xs font-mono font-bold ${setup.score >= 70 ? 'text-atlas' : setup.score >= 50 ? 'text-oracle' : 'text-bear'}`}>
                  {setup.score}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
