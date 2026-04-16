'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'

interface CorrelationResponse {
  symbols: string[]
  matrix: number[][]
  sampleSize: number
  interval: string
  range: string
  updatedAt: string
  strongestPositive: { a: string; b: string; value: number } | null
  strongestNegative: { a: string; b: string; value: number } | null
  error?: string
}

const DEFAULT_SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'DXY', 'SP500']

function getCellColor(value: number): string {
  if (value === 1) return 'bg-bg-elevated text-ink-dim'
  if (value > 0.7) return 'bg-atlas/20 text-atlas'
  if (value > 0.4) return 'bg-atlas/10 text-atlas/80'
  if (value < -0.7) return 'bg-bear/20 text-bear'
  if (value < -0.4) return 'bg-bear/10 text-bear/80'
  return 'bg-bg-deep text-ink-muted'
}

export function CorrelationMatrix() {
  const [data, setData] = useState<CorrelationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const response = await fetch('/api/market/correlations')
        const json = await response.json()
        if (!response.ok) {
          throw new Error(json?.error ?? 'Failed to load correlations')
        }
        if (!mounted) return
        setData(json)
        setError(null)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'Failed to load correlations')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()
    const timer = setInterval(fetchData, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const symbols = useMemo(() => (data?.symbols?.length ? data.symbols : DEFAULT_SYMBOLS), [data?.symbols])
  const matrix = useMemo(
    () => (data?.matrix?.length ? data.matrix : symbols.map((row) => symbols.map((col) => (row === col ? 1 : 0)))),
    [data?.matrix, symbols],
  )

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card overflow-hidden glass-card">
      <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Matriz de Correlacion</h3>
        <span className="text-[10px] font-mono text-ink-dim uppercase">
          Marco: {data?.interval?.toUpperCase() ?? '1H'} | Muestras: {data?.sampleSize ?? 0}
        </span>
      </div>

      <div className="overflow-x-auto p-4">
        {loading ? (
          <div className="h-44 flex items-center justify-center text-[11px] font-mono text-ink-muted">Cargando correlaciones en vivo...</div>
        ) : error ? (
          <div className="h-44 flex items-center justify-center text-[11px] font-mono text-bear">{error}</div>
        ) : (
          <table className="w-full border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-16" />
                {symbols.map((asset) => (
                  <th key={asset} className="px-2 py-1 text-[9px] font-mono text-ink-dim uppercase bg-bg-deep rounded">
                    {asset}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symbols.map((assetRow, rowIndex) => (
                <tr key={assetRow}>
                  <td className="px-2 py-1 text-[9px] font-mono text-ink-dim uppercase bg-bg-deep rounded text-right">
                    {assetRow}
                  </td>
                  {matrix[rowIndex]?.map((value, colIndex) => (
                    <td
                      key={`${assetRow}-${symbols[colIndex] ?? colIndex}`}
                      className={clsx(
                        'w-12 h-12 text-center text-xs font-mono font-bold rounded transition-all hover:scale-105 cursor-default',
                        getCellColor(value),
                      )}
                      title={`${assetRow} vs ${symbols[colIndex] ?? ''}: ${value.toFixed(4)}`}
                    >
                      {rowIndex === colIndex ? '-' : value.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-4 bg-bg-deep border-t border-bg-border flex justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-atlas/20 rounded-sm" />
          <span className="text-[9px] font-mono text-ink-dim uppercase">Corr. positiva</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-bear/20 rounded-sm" />
          <span className="text-[9px] font-mono text-ink-dim uppercase">Corr. negativa</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-bg-deep rounded-sm" />
          <span className="text-[9px] font-mono text-ink-dim uppercase">
            Act. {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </span>
        </div>
      </div>
    </div>
  )
}
