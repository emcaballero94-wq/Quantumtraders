'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { rankAssets } from '@/lib/oracle/score-engine'
import type { OracleState, RadarAsset } from '@/lib/oracle/types'
import { MarketContext } from '@/components/oracle/MarketContext'
import { DepthPanel } from '@/components/oracle/DepthPanel'
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton'
import { RatingBadge, BiasBadge } from '@/components/ui/StatusBadge'
import { MarketScanner } from '@/components/scanner/MarketScanner'
import { MarketHeatmap } from '@/components/scanner/MarketHeatmap'
import { SCANNER_ASSETS } from '@/lib/scanner/conditions'

interface OracleStateResponse {
  success: boolean
  data: OracleState | null
  error?: string
}

interface ScannerRow {
  asset: string
  setup: string
  detail: string
  timeframe: string
  signal: 'Detected' | 'Watching'
}

interface ScannerResponse {
  success: boolean
  rows: ScannerRow[]
}

type Tab = 'radar' | 'scanner' | 'heatmap'

const TABS: { id: Tab; label: string }[] = [
  { id: 'radar', label: 'Radar' },
  { id: 'scanner', label: 'Scanner' },
  { id: 'heatmap', label: 'Mapa de calor' },
]

const CATEGORY_LABEL: Record<string, string> = {
  forex: 'FX',
  metals: 'Metales',
  indices: 'Índices',
  crypto: 'Cripto',
  stocks: 'Acciones',
}

const scoreText = (v: number) => (v >= 70 ? 'text-atlas' : v >= 50 ? 'text-oracle' : v >= 30 ? 'text-pulse' : 'text-bear')

function fmtPrice(v: number) {
  return v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 2 : 5 })
}

function fmtChg(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

/** Stacked bar: each segment's share of the total, scaled so the whole bar length = totalScore%. */
function ScoreComposition({ asset }: { asset: RadarAsset }) {
  const sum = asset.macroScore + asset.technicalScore + asset.timingScore || 1
  const seg = (v: number) => `${(v / sum) * asset.totalScore}%`
  return (
    <div className="flex h-2 gap-0.5 rounded-sm overflow-hidden bg-bg-elevated" title={`Macro ${asset.macroScore} · Técnico ${asset.technicalScore} · Timing ${asset.timingScore}`}>
      <div className="bg-oracle" style={{ width: seg(asset.macroScore) }} />
      <div className="bg-atlas" style={{ width: seg(asset.technicalScore) }} />
      <div className="bg-pulse" style={{ width: seg(asset.timingScore) }} />
    </div>
  )
}

function DetailPanel({ asset, rank }: { asset: RadarAsset; rank: number }) {
  const [signals, setSignals] = useState<ScannerRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const scannable = (SCANNER_ASSETS as readonly string[]).includes(asset.symbol)

  useEffect(() => {
    if (!scannable) {
      setSignals(null)
      return
    }
    let mounted = true
    setLoading(true)
    fetch(`/api/scanner?assets=${encodeURIComponent(asset.symbol)}&timeframe=H1`)
      .then((r) => r.json() as Promise<ScannerResponse>)
      .then((p) => mounted && setSignals(p.success ? p.rows : []))
      .catch(() => mounted && setSignals([]))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [asset.symbol, scannable])

  const up = asset.change24h >= 0
  const parts = [
    { k: 'Macro', v: asset.macroScore, bar: 'bg-oracle' },
    { k: 'Técnico', v: asset.technicalScore, bar: 'bg-atlas' },
    { k: 'Timing', v: asset.timingScore, bar: 'bg-pulse' },
  ]

  return (
    <aside className="bg-bg-card px-7 py-6 flex flex-col gap-6 overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">#{rank} del radar</p>
          <h2 className="text-3xl font-mono font-semibold text-ink-primary truncate">{asset.symbol}</h2>
          <p className="text-[13px] font-sans text-ink-secondary truncate">
            {asset.name} · {CATEGORY_LABEL[asset.category] ?? asset.category}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={clsx('text-[44px] font-mono leading-none tabular-nums', scoreText(asset.totalScore))}>{asset.totalScore}</span>
          <span className="text-[11px] font-sans text-ink-secondary">score</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {parts.map((p) => (
          <div key={p.k} className="rounded-lg border border-bg-border p-3 space-y-1.5">
            <p className="text-[11px] font-sans text-ink-secondary">{p.k}</p>
            <p className="text-xl font-mono text-ink-primary tabular-nums">{p.v}</p>
            <div className="h-[3px] rounded-full bg-bg-border overflow-hidden">
              <div className={clsx('h-full rounded-full', p.bar)} style={{ width: `${p.v}%` }} />
            </div>
          </div>
        ))}
      </div>

      <dl className="text-[13px] font-sans">
        <div className="flex justify-between items-center py-2.5 border-b border-bg-border">
          <dt className="text-ink-secondary">Precio</dt>
          <dd className="font-mono tabular-nums text-ink-primary">
            {fmtPrice(asset.currentPrice)} <span className={up ? 'text-atlas' : 'text-bear'}>{fmtChg(asset.change24h)}</span>
          </dd>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-bg-border">
          <dt className="text-ink-secondary">Bias</dt>
          <dd><BiasBadge bias={asset.bias} size="sm" /></dd>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-bg-border">
          <dt className="text-ink-secondary">Estado</dt>
          <dd><RatingBadge rating={asset.rating} /></dd>
        </div>
        <div className="flex justify-between items-center py-2.5 border-b border-bg-border">
          <dt className="text-ink-secondary">Tendencia</dt>
          <dd className="text-ink-primary">
            {asset.trend === 'uptrend' ? 'Alcista' : asset.trend === 'downtrend' ? 'Bajista' : 'Lateral'}
          </dd>
        </div>
      </dl>

      <div className="space-y-2.5">
        <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Señales del scanner · H1</p>
        {!scannable && <p className="text-[13px] font-sans text-ink-secondary">Este activo no está en el universo del scanner.</p>}
        {scannable && loading && <p className="text-[13px] font-sans text-ink-secondary">Escaneando…</p>}
        {scannable && !loading && signals?.length === 0 && (
          <p className="text-[13px] font-sans text-ink-secondary">Sin condiciones activas en H1.</p>
        )}
        {scannable && !loading &&
          signals?.map((s) => (
            <div key={`${s.asset}-${s.setup}`} className="rounded-md bg-bg-elevated px-3 py-2.5 space-y-0.5">
              <p className="text-[13px] font-sans text-ink-primary">
                {s.setup}
                {s.signal === 'Watching' && <span className="ml-2 text-[11px] text-ink-secondary">vigilando</span>}
              </p>
              <p className="text-[11px] font-mono text-ink-secondary">{s.detail}</p>
            </div>
          ))}
      </div>

      <div className="flex gap-2 mt-auto pt-2">
        <Link
          href={`/dashboard/atlas?symbol=${asset.symbol}`}
          className="flex-1 text-center text-[13px] font-sans font-medium text-bg-deep bg-atlas hover:bg-atlas/90 py-2.5 rounded-lg transition-colors"
        >
          Analizar con ATLAS
        </Link>
        <Link
          href={`/dashboard/stock/${asset.symbol}`}
          className="text-center text-[13px] font-sans text-ink-primary border border-bg-border hover:border-ink-muted px-3.5 py-2.5 rounded-lg transition-colors"
        >
          Ver detalle
        </Link>
      </div>
    </aside>
  )
}

export default function OraclePage() {
  const [state, setState] = useState<OracleState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('radar')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchState = async () => {
      try {
        const response = await fetch('/api/oracle/state')
        const json = (await response.json()) as OracleStateResponse
        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error ?? 'No se pudo cargar el estado del Scanner')
        }
        if (!mounted) return
        setState(json.data)
        setError(null)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message ?? 'No se pudo cargar el estado del Scanner')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchState()
    const timer = setInterval(fetchState, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const rankedAssets = useMemo(() => (state ? rankAssets(state.radar) : []), [state])
  const selectedAsset = rankedAssets.find((a) => a.symbol === selected) ?? rankedAssets[0] ?? null
  const selectedRank = selectedAsset ? rankedAssets.indexOf(selectedAsset) + 1 : 0
  const operableCount = rankedAssets.filter((a) => a.rating !== 'avoid' && a.rating !== 'mixed').length

  if (loading) {
    return <div className="p-5"><DashboardSkeleton /></div>
  }

  if (error || !state) {
    return (
      <div className="p-5 text-bear font-mono text-sm">
        {error ?? 'No fue posible cargar el Scanner.'}
      </div>
    )
  }

  const updated = new Date(state.lastUpdated).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

  return (
    <div className="space-y-8 animate-slide-up max-w-[1400px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
        {/* Header + tabs */}
        <div className="flex items-center justify-between flex-wrap gap-4 px-7 py-[18px] border-b border-bg-border">
          <div className="flex items-baseline gap-3.5 flex-wrap">
            <h1 className="text-[22px] font-sans font-medium text-ink-primary">Scanner</h1>
            <span className="text-xs font-mono text-ink-secondary">
              {rankedAssets.length} activos · {operableCount} operables · {updated} UTC
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-atlas">
              <span className="w-1.5 h-1.5 bg-atlas rounded-full animate-pulse-slow" />
              Activo
            </span>
          </div>
          <div className="flex gap-1 p-[3px] border border-bg-border rounded-lg text-xs font-sans" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'px-3 py-1.5 rounded-md transition-colors',
                  tab === t.id ? 'bg-bg-border text-ink-primary' : 'text-ink-secondary hover:text-ink-primary',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'radar' && selectedAsset && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] lg:h-[720px]">
            <div className="flex flex-col min-h-0 lg:border-r border-bg-border">
              <div className="grid grid-cols-[130px_80px_minmax(0,1fr)_60px_96px] gap-4 px-7 py-3 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-muted border-b border-bg-border">
                <span>Activo</span>
                <span className="text-right">Precio</span>
                <span>Composición del score</span>
                <span className="text-right">Total</span>
                <span className="text-right">Estado</span>
              </div>
              <div className="overflow-y-auto min-h-0 flex-1" role="listbox" aria-label="Radar de activos">
                {rankedAssets.map((asset) => {
                  const isSel = asset.symbol === selectedAsset.symbol
                  const up = asset.change24h >= 0
                  return (
                    <button
                      key={asset.symbol}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      onClick={() => setSelected(asset.symbol)}
                      className={clsx(
                        'w-full text-left grid grid-cols-[130px_80px_minmax(0,1fr)_60px_96px] gap-4 items-center px-7 py-3 border-b border-bg-elevated transition-colors',
                        isSel ? 'bg-bg-card shadow-[inset_3px_0_0_#F97316]' : 'hover:bg-bg-card/60',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-mono font-semibold text-ink-primary truncate">{asset.symbol}</span>
                        <span className="block text-[11px] font-sans text-ink-secondary truncate">{asset.name}</span>
                      </span>
                      <span className="text-right font-mono tabular-nums">
                        <span className="block text-xs text-ink-primary">{fmtPrice(asset.currentPrice)}</span>
                        <span className={clsx('block text-[11px]', up ? 'text-atlas' : 'text-bear')}>{fmtChg(asset.change24h)}</span>
                      </span>
                      <ScoreComposition asset={asset} />
                      <span className={clsx('text-base font-mono text-right tabular-nums', scoreText(asset.totalScore))}>{asset.totalScore}</span>
                      <span className="flex justify-end"><RatingBadge rating={asset.rating} /></span>
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-[18px] px-7 py-3 border-t border-bg-border text-[11px] font-mono text-ink-secondary">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 bg-oracle" />Macro</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 bg-atlas" />Técnico</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 bg-pulse" />Timing</span>
              </div>
            </div>
            <DetailPanel key={selectedAsset.symbol} asset={selectedAsset} rank={selectedRank} />
          </div>
        )}

        {tab === 'radar' && !selectedAsset && (
          <p className="px-7 py-10 text-sm font-sans text-ink-secondary">El radar aún no tiene activos analizados.</p>
        )}

        {tab === 'scanner' && (
          <div className="p-5">
            <MarketScanner />
          </div>
        )}

        {tab === 'heatmap' && (
          <div className="p-5">
            <MarketHeatmap />
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">Contexto operativo</p>
          <p className="text-[13px] font-sans text-ink-secondary">Sesiones · Alertas · Calendario</p>
        </div>
        <MarketContext
          sessions={state.sessions}
          killZones={state.killZones}
          alerts={state.alerts}
          calendar={state.calendar}
        />
      </section>

      <DepthPanel
        centralBanks={state.centralBanks}
        sectorStrength={state.sectorStrength}
        calendar={state.calendar}
      />
    </div>
  )
}
