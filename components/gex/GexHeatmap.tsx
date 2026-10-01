'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'

interface GexProfilePoint {
  strike: number
  callGex: number
  putGex: number
  netGex: number
}

interface GexMatrixExpiryResult {
  expiration: string
  result: { profile: GexProfilePoint[]; netGex: number }
}

interface GexMatrixResponse {
  success: boolean
  error?: string
  underlyingPrice?: number
  expirations?: GexMatrixExpiryResult[]
  aggregate?: {
    netGex: number
    callWallStrike: number | null
    putWallStrike: number | null
    gammaFlip: number | null
  }
}

interface GexHeatmapProps {
  assetClass: 'equity' | 'crypto'
  symbolOrCurrency: string
  priceUnit: string
}

const MAX_EXPIRIES = 12
const MAX_STRIKES_EACH_SIDE = 20

function fmtGex(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtStrike(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Which strikes to show as heatmap rows: the union of every strike listed in
// any of the fetched expirations, narrowed to the N closest to spot on each
// side — same windowing idea as GammaGrid's "strikes each side of the money"
// control, done client-side so moving the slider doesn't refetch.
function windowedStrikes(expirations: GexMatrixExpiryResult[], spot: number, eachSide: number): number[] {
  const allStrikes = new Set<number>()
  for (const e of expirations) for (const p of e.result.profile) allStrikes.add(p.strike)
  const sorted = Array.from(allStrikes).sort((a, b) => a - b)
  if (sorted.length === 0) return []

  let nearestIdx = 0
  let nearestDiff = Infinity
  sorted.forEach((s, i) => {
    const diff = Math.abs(s - spot)
    if (diff < nearestDiff) {
      nearestDiff = diff
      nearestIdx = i
    }
  })

  const start = Math.max(0, nearestIdx - eachSide)
  const end = Math.min(sorted.length, nearestIdx + eachSide + 1)
  return sorted.slice(start, end).reverse()
}

export function GexHeatmap({ assetClass, symbolOrCurrency, priceUnit }: GexHeatmapProps) {
  const [expiriesWanted, setExpiriesWanted] = useState(6)
  const [strikesEachSide, setStrikesEachSide] = useState(10)
  const [data, setData] = useState<GexMatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params =
      assetClass === 'equity'
        ? `assetClass=equity&symbol=${encodeURIComponent(symbolOrCurrency)}&expirations=${expiriesWanted}`
        : `assetClass=crypto&currency=${encodeURIComponent(symbolOrCurrency)}&expirations=${expiriesWanted}`

    fetch(`/api/market/gex-matrix?${params}`)
      .then((r) => r.json() as Promise<GexMatrixResponse>)
      .then((payload) => {
        if (cancelled) return
        if (!payload.success) {
          setError(payload.error ?? 'No se pudo calcular el mapa de calor.')
          setData(null)
          return
        }
        setData(payload)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo calcular el mapa de calor.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, symbolOrCurrency, expiriesWanted])

  const expirations = data?.expirations ?? []
  const spot = data?.underlyingPrice ?? 0
  const rows = useMemo(() => windowedStrikes(expirations, spot, strikesEachSide), [expirations, spot, strikesEachSide])

  const maxAbsCell = useMemo(() => {
    let max = 0
    for (const e of expirations) {
      for (const p of e.result.profile) {
        if (rows.includes(p.strike)) max = Math.max(max, Math.abs(p.netGex))
      }
    }
    return max || 1
  }, [expirations, rows])

  const atmStrike = useMemo(() => {
    if (rows.length === 0) return null
    return rows.reduce((closest, s) => (Math.abs(s - spot) < Math.abs(closest - spot) ? s : closest), rows[0])
  }, [rows, spot])

  const netGex = data?.aggregate?.netGex ?? null
  const regimeLabel = netGex === null ? '—' : netGex >= 0 ? 'Positivo' : 'Negativo'
  const regimeColor = netGex === null ? 'text-ink-dim' : netGex >= 0 ? 'text-atlas' : 'text-bear'

  if (loading && !data) {
    return <div className="h-[420px] bg-bg-elevated rounded-xl animate-pulse" />
  }

  if (error) {
    return (
      <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
        <p className="text-sm font-sans text-ink-secondary">{error}</p>
      </div>
    )
  }

  if (!data || expirations.length === 0) {
    return (
      <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
        <p className="text-sm font-sans text-ink-secondary">Sin datos suficientes para el mapa de calor.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Subyacente</p>
            <p className="text-lg font-mono tabular-nums text-ink-primary">
              {spot ? `${spot.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${priceUnit}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Call Wall</p>
            <p className="text-lg font-mono tabular-nums text-atlas">{fmtStrike(data.aggregate?.callWallStrike)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Put Wall</p>
            <p className="text-lg font-mono tabular-nums text-bear">{fmtStrike(data.aggregate?.putWallStrike)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Gamma Flip</p>
            <p className="text-lg font-mono tabular-nums text-oracle">{fmtStrike(data.aggregate?.gammaFlip)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Régimen</p>
            <p className={clsx('text-lg font-mono tabular-nums', regimeColor)}>{regimeLabel}</p>
          </div>
        </div>
        <p className="px-5 pb-3 text-[10px] font-mono text-ink-dim">
          Call Wall / Put Wall / Gamma Flip / Régimen agregan los {expirations.length} vencimientos que se muestran abajo — no son los de un solo vencimiento.
        </p>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-base px-5 py-4 flex flex-wrap gap-6 items-center">
        <label className="flex items-center gap-3 text-xs font-mono text-ink-secondary">
          Vencimientos: <span className="text-ink-primary w-5 text-right">{expiriesWanted}</span>
          <input
            type="range"
            min={1}
            max={MAX_EXPIRIES}
            value={expiriesWanted}
            onChange={(e) => setExpiriesWanted(Number(e.target.value))}
            className="w-32 accent-oracle"
          />
        </label>
        <label className="flex items-center gap-3 text-xs font-mono text-ink-secondary">
          Strikes por lado: <span className="text-ink-primary w-5 text-right">{strikesEachSide}</span>
          <input
            type="range"
            min={3}
            max={MAX_STRIKES_EACH_SIDE}
            value={strikesEachSide}
            onChange={(e) => setStrikesEachSide(Number(e.target.value))}
            className="w-32 accent-oracle"
          />
        </label>
        {loading && <span className="text-[10px] font-mono text-ink-dim">Actualizando…</span>}
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
        <p className="px-5 pt-4 text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
          Net GEX por vencimiento
        </p>
        <div className="overflow-x-auto px-5 pb-4 pt-2">
          <table className="text-[11px] font-mono tabular-nums">
            <thead>
              <tr>
                {expirations.map((e) => (
                  <th key={e.expiration} className="px-3 py-1 text-right font-normal text-ink-secondary whitespace-nowrap">
                    {e.expiration}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {expirations.map((e) => (
                  <td
                    key={e.expiration}
                    className={clsx('px-3 py-1 text-right', e.result.netGex >= 0 ? 'text-atlas' : 'text-bear')}
                  >
                    {fmtGex(e.result.netGex)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
        <p className="px-5 pt-4 text-[11px] font-mono uppercase tracking-wider text-ink-secondary">
          {rows.length} strikes alrededor de {fmtStrike(atmStrike)} ({spot.toLocaleString('en-US', { maximumFractionDigits: 2 })}) · hasta {strikesEachSide} por lado
        </p>
        <div className="overflow-x-auto px-2 py-3">
          <table className="text-[11px] font-mono tabular-nums w-full">
            <thead>
              <tr className="border-b border-bg-border text-ink-secondary">
                <th className="px-3 py-2 text-right font-normal">Strike</th>
                {expirations.map((e) => (
                  <th key={e.expiration} className="px-3 py-2 text-right font-normal whitespace-nowrap">
                    {e.expiration}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((strike) => (
                <tr key={strike} className={clsx('border-b border-bg-border/40', strike === atmStrike && 'bg-oracle/10')}>
                  <td className={clsx('px-3 py-1.5 text-right font-bold', strike === atmStrike ? 'text-oracle' : 'text-ink-primary')}>
                    {fmtStrike(strike)}
                  </td>
                  {expirations.map((e) => {
                    const point = e.result.profile.find((p) => p.strike === strike)
                    const value = point?.netGex ?? 0
                    const intensity = value === 0 ? 0 : 0.12 + 0.68 * (Math.abs(value) / maxAbsCell)
                    return (
                      <td
                        key={e.expiration}
                        className="px-3 py-1.5 text-right"
                        style={value !== 0 ? { backgroundColor: `rgb(var(--c-${value >= 0 ? 'atlas' : 'bear'}) / ${intensity})` } : undefined}
                      >
                        <span className={value === 0 ? 'text-ink-dim' : 'text-ink-primary'}>{point ? fmtGex(value) : '—'}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
