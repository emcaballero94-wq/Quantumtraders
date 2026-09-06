'use client'

import { useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { SectionTitle } from '@/components/ui/SectionTitle'
import {
  SCANNER_ASSETS,
  SCANNER_CONDITIONS,
  SCANNER_TIMEFRAMES,
  CONDITION_LABEL,
  type ScannerAsset,
  type ScannerCondition,
  type ScannerTimeframe,
} from '@/lib/scanner/conditions'

interface ScannerRow {
  asset: string
  setup: string
  detail: string
  timeframe: string
  volatility: 'high' | 'medium' | 'low'
  trend: 'uptrend' | 'downtrend' | 'sideways'
  lastClose: number | null
  signal: 'Detected' | 'Watching'
  matchedConditions: ScannerCondition[]
}

interface ScannerResponse {
  success: boolean
  rows: ScannerRow[]
  failures: { asset: string; error: string }[]
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

const VOLATILITY_STYLE: Record<ScannerRow['volatility'], string> = {
  high: 'text-bear border-bear/25 bg-bear/8',
  medium: 'text-pulse border-pulse/25 bg-pulse/8',
  low: 'text-ink-muted border-bg-border bg-bg-elevated',
}

export function MarketScanner() {
  const [assets, setAssets] = useState<ScannerAsset[]>([...SCANNER_ASSETS])
  const [conditions, setConditions] = useState<ScannerCondition[]>([])
  const [timeframe, setTimeframe] = useState<ScannerTimeframe>('H1')
  const [rows, setRows] = useState<ScannerRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runScan = async () => {
    if (assets.length === 0) {
      setError('Select at least one asset.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        assets: assets.join(','),
        timeframe,
      })
      if (conditions.length > 0) params.set('conditions', conditions.join(','))

      const res = await fetch(`/api/scanner?${params.toString()}`)
      const payload = (await res.json()) as ScannerResponse
      if (!res.ok || !payload.success) throw new Error('Scan failed')
      setRows(payload.rows)
    } catch {
      setError('Could not run the scan — market data may be temporarily unavailable.')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card glass-card p-5 space-y-5">
      <SectionTitle
        label="Market Scanner"
        sublabel="Real price data, evaluated against the same indicators as the rest of the terminal"
        accent="oracle"
      />

      {/* ── Filters ── */}
      <div className="space-y-3">
        <FilterGroup title="Asset">
          {SCANNER_ASSETS.map((asset) => (
            <Chip key={asset} active={assets.includes(asset)} onClick={() => setAssets((prev) => toggle(prev, asset))}>
              {asset}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup title="Condition">
          {SCANNER_CONDITIONS.map((condition) => (
            <Chip key={condition} active={conditions.includes(condition)} onClick={() => setConditions((prev) => toggle(prev, condition))}>
              {CONDITION_LABEL[condition]}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup title="Timeframe">
          {SCANNER_TIMEFRAMES.map((tf) => (
            <Chip key={tf} active={timeframe === tf} onClick={() => setTimeframe(tf)}>
              {tf}
            </Chip>
          ))}
        </FilterGroup>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={runScan}
            disabled={loading}
            className="px-5 py-2 bg-oracle/10 text-oracle border border-oracle/30 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-oracle/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Scan'}
          </button>
          {error && <span className="text-[10px] font-mono text-bear">{error}</span>}
        </div>
      </div>

      {/* ── Results ── */}
      {rows && (
        rows.length === 0 ? (
          <div className="text-[10px] font-mono text-ink-dim px-3 py-4 rounded border border-bg-border bg-bg-elevated/20 text-center">
            No assets matched the selected conditions on {timeframe}.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-bg-border">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-bg-elevated/40 text-[9px] text-ink-dim uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Asset</th>
                  <th className="text-left px-3 py-2">Setup</th>
                  <th className="text-left px-3 py-2">TF</th>
                  <th className="text-left px-3 py-2">Volatility</th>
                  <th className="text-left px-3 py-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.asset}
                    title={row.detail}
                    className="border-t border-bg-border hover:bg-bg-elevated/30 transition-colors animate-slide-up"
                    style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'backwards' }}
                  >
                    <td className="px-3 py-2 font-bold">
                      <Link href={`/dashboard/stock/${row.asset}`} className="text-ink-primary hover:text-oracle transition-colors">
                        {row.asset}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">{row.setup}</td>
                    <td className="px-3 py-2 text-ink-dim">{row.timeframe}</td>
                    <td className="px-3 py-2">
                      <span className={clsx('px-1.5 py-0.5 rounded border text-[9px] uppercase', VOLATILITY_STYLE[row.volatility])}>
                        {row.volatility}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded border text-[9px] uppercase font-bold',
                        row.signal === 'Detected' ? 'text-atlas border-atlas/25 bg-atlas/8' : 'text-ink-dim border-bg-border'
                      )}>
                        {row.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wide transition-all',
        active
          ? 'bg-oracle/15 text-oracle border-oracle/35'
          : 'bg-bg-elevated/30 text-ink-muted border-bg-border hover:border-oracle/25 hover:text-ink-secondary'
      )}
    >
      {children}
    </button>
  )
}
