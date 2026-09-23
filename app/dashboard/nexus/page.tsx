'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import type { SectorStrength } from '@/lib/oracle/types'

interface CorrelationResponse {
  symbols: string[]
  matrix: number[][]
  sampleSize: number
  strongestPositive: { a: string; b: string; value: number } | null
  strongestNegative: { a: string; b: string; value: number } | null
}

interface OracleStateResponse {
  success: boolean
  data?: { sectorStrength: SectorStrength[] }
}

const HIGHLIGHT = 0.4

function fmtRho(v: number) {
  const s = Math.abs(v).toFixed(2)
  return v < 0 && s !== '0.00' ? `-${s}` : s
}

function cellStyle(v: number): React.CSSProperties {
  const a = Math.abs(v)
  if (a < HIGHLIGHT) return { background: '#161310', color: '#B8AD98' }
  const alpha = 0.15 + ((a - HIGHLIGHT) / (1 - HIGHLIGHT)) * 0.6
  return {
    background: v > 0 ? `rgba(16,185,129,${alpha.toFixed(2)})` : `rgba(239,68,68,${alpha.toFixed(2)})`,
    color: '#F3EFE7',
  }
}

function rhoColor(v: number) {
  if (v >= HIGHLIGHT) return 'text-atlas'
  if (v <= -HIGHLIGHT) return 'text-bear'
  if (v < 0) return 'text-bear/80'
  return 'text-ink-secondary'
}

function describePair(a: string, b: string, v: number) {
  const abs = Math.abs(v)
  const band =
    abs >= 0.8 ? (v > 0 ? 'Directa muy fuerte' : 'Inversa muy fuerte')
    : abs >= HIGHLIGHT ? (v > 0 ? 'Directa moderada' : 'Inversa moderada')
    : abs >= 0.15 ? (v > 0 ? 'Directa débil' : 'Inversa débil')
    : 'Sin relación'
  const meaning =
    abs >= 0.8 ? `${a} y ${b} se mueven casi al unísono. Uno explica la mayor parte del movimiento del otro.`
    : abs >= HIGHLIGHT ? `${a} y ${b} tienden a moverse ${v > 0 ? 'en la misma dirección' : 'en direcciones opuestas'}, pero con suficiente ruido para divergir intradía.`
    : abs >= 0.15 ? `Hay una ligera tendencia ${v > 0 ? 'a moverse juntos' : 'inversa'}, demasiado débil para apoyarse en ella sola.`
    : `En este marco, ${a} y ${b} se mueven de forma independiente.`
  const use =
    abs >= 0.8 ? 'Evita abrir ambos en la misma dirección: duplicas riesgo. Usa uno para confirmar la señal del otro.'
    : abs >= HIGHLIGHT ? (v > 0 ? 'Útil como confirmación. Si divergen, espera antes de entrar.' : 'Candidato a cobertura parcial.')
    : abs >= 0.15 ? 'Úsalo sólo como contexto secundario, nunca como disparador.'
    : 'Buen par para diversificar: combinarlos reduce la exposición a un mismo factor.'
  return { band, meaning, use }
}

export default function NexusPage() {
  const [correlations, setCorrelations] = useState<CorrelationResponse | null>(null)
  const [sectorStrength, setSectorStrength] = useState<SectorStrength[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [selected, setSelected] = useState<[number, number] | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [correlationResponse, stateResponse] = await Promise.all([
          fetch('/api/market/correlations').then((r) => r.json() as Promise<CorrelationResponse>),
          fetch('/api/oracle/state').then((r) => r.json() as Promise<OracleStateResponse>),
        ])
        if (!mounted) return
        setCorrelations(correlationResponse?.symbols?.length ? correlationResponse : null)
        setSectorStrength(stateResponse?.data?.sectorStrength ?? [])
        setUpdatedAt(new Date())
      } catch {
        if (!mounted) return
        setCorrelations(null)
        setSectorStrength([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const symbols = correlations?.symbols ?? []
  const matrix = correlations?.matrix ?? []

  // Default selection: strongest positive pair from the API
  const sel = useMemo<[number, number] | null>(() => {
    if (selected) return selected
    const top = correlations?.strongestPositive
    if (top) {
      const i = symbols.indexOf(top.a)
      const j = symbols.indexOf(top.b)
      if (i >= 0 && j >= 0) return [Math.min(i, j), Math.max(i, j)]
    }
    return symbols.length >= 2 ? [0, 1] : null
  }, [selected, correlations, symbols])

  const flows = useMemo(() => {
    const sorted = [...sectorStrength].sort((a, b) => b.change4h - a.change4h)
    return sorted.length > 4 ? [...sorted.slice(0, 2), ...sorted.slice(-2)] : sorted
  }, [sectorStrength])

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-[1280px]">
        <div className="h-14 bg-bg-elevated rounded-xl animate-pulse" />
        <div className="h-[520px] bg-bg-elevated rounded-xl animate-pulse" />
      </div>
    )
  }

  const selA = sel ? symbols[sel[0]] : null
  const selB = sel ? symbols[sel[1]] : null
  const selV = sel ? matrix[sel[0]]?.[sel[1]] ?? 0 : 0
  const info = selA && selB ? describePair(selA, selB, selV) : null

  return (
    <div className="animate-fade-in pb-20 max-w-[1280px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
        {/* Header */}
        <div className="flex items-baseline gap-3.5 flex-wrap px-7 py-[18px] border-b border-bg-border">
          <h1 className="text-[22px] font-sans font-medium text-ink-primary">Nexus</h1>
          <span className="text-xs font-mono text-ink-secondary">
            Correlación intermercado
            {correlations && ` · ${symbols.length} activos · ${correlations.sampleSize} muestras`}
          </span>
        </div>

        {!correlations && (
          <p className="px-7 py-10 text-sm font-sans text-ink-secondary">Esperando suficiente historial para calcular correlaciones.</p>
        )}

        {correlations && sel && info && selA && selB && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
            {/* Full matrix */}
            <section className="px-7 py-6 lg:border-r border-bg-border space-y-3 overflow-x-auto">
              <div
                className="grid gap-[3px] min-w-[560px]"
                style={{ gridTemplateColumns: `72px repeat(${symbols.length}, minmax(0, 1fr))` }}
              >
                <span />
                {symbols.map((s, k) => (
                  <span
                    key={s}
                    className={clsx('pb-1 text-center text-[10px] font-mono', k === sel[0] || k === sel[1] ? 'text-ink-primary' : 'text-ink-secondary')}
                  >
                    {s}
                  </span>
                ))}
                {symbols.map((rowSym, i) => (
                  <div key={rowSym} className="contents">
                    <span
                      className={clsx(
                        'h-[52px] flex items-center justify-end pr-2 text-[11px] font-mono',
                        i === sel[0] || i === sel[1] ? 'text-ink-primary' : 'text-ink-secondary',
                      )}
                    >
                      {rowSym}
                    </span>
                    {symbols.map((colSym, j) => {
                      if (i === j) {
                        return (
                          <span key={colSym} className="h-[52px] rounded bg-bg-elevated flex items-center justify-center text-xs font-mono text-ink-dim">
                            —
                          </span>
                        )
                      }
                      const v = matrix[i]?.[j] ?? 0
                      const isSel = (i === sel[0] && j === sel[1]) || (i === sel[1] && j === sel[0])
                      const inLine = i === sel[0] || i === sel[1] || j === sel[0] || j === sel[1]
                      return (
                        <button
                          key={colSym}
                          type="button"
                          onClick={() => setSelected([Math.min(i, j), Math.max(i, j)])}
                          aria-pressed={isSel}
                          aria-label={`${rowSym} / ${colSym}: ${fmtRho(v)}`}
                          className={clsx(
                            'h-[52px] rounded flex items-center justify-center text-xs font-mono tabular-nums transition-opacity',
                            isSel && 'ring-2 ring-inset ring-nexus',
                            inLine ? 'opacity-100' : 'opacity-50 hover:opacity-100',
                          )}
                          style={cellStyle(v)}
                        >
                          {fmtRho(v)}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2.5 pl-[75px] text-[10px] font-mono text-ink-secondary">
                <span>-1</span>
                <div className="w-[200px] h-1.5 rounded bg-gradient-to-r from-bear via-bg-elevated to-atlas" />
                <span>+1</span>
                {updatedAt && (
                  <span className="ml-auto">
                    Actualizado {updatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
                  </span>
                )}
              </div>
            </section>

            {/* Pair detail */}
            <aside className="bg-bg-card px-7 py-6 flex flex-col gap-[22px]">
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-nexus">Par seleccionado</p>
                <p className="text-[26px] font-mono font-semibold text-ink-primary">
                  {selA} <span className="text-ink-muted">/</span> {selB}
                </p>
              </div>
              <div className="flex items-baseline gap-3.5 pb-[18px] border-b border-bg-border">
                <span className={clsx('text-[56px] font-mono leading-none tabular-nums', rhoColor(selV))}>{fmtRho(selV)}</span>
                <span className={clsx('text-sm font-sans', rhoColor(selV))}>{info.band}</span>
              </div>
              <div className="space-y-2">
                <div className="relative h-2 rounded bg-gradient-to-r from-bear via-bg-border to-atlas">
                  <div
                    className="absolute -top-1 w-[3px] h-4 rounded-sm bg-ink-primary -translate-x-1/2 transition-all"
                    style={{ left: `${((selV + 1) / 2) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-ink-secondary">
                  <span>Inversa</span>
                  <span>Sin relación</span>
                  <span>Directa</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Qué significa</p>
                <p className="text-sm font-sans leading-relaxed text-ink-primary/85 text-pretty">{info.meaning}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Cómo usarlo</p>
                <p className="text-sm font-sans leading-relaxed text-ink-primary/85 text-pretty">{info.use}</p>
              </div>
              <div className="flex gap-2 mt-auto">
                <Link
                  href={`/dashboard/stock/${selA}`}
                  className="flex-1 text-center text-[13px] font-sans text-ink-primary border border-bg-border hover:border-ink-muted py-2.5 rounded-lg transition-colors"
                >
                  Ver {selA}
                </Link>
                <Link
                  href={`/dashboard/stock/${selB}`}
                  className="flex-1 text-center text-[13px] font-sans text-ink-primary border border-bg-border hover:border-ink-muted py-2.5 rounded-lg transition-colors"
                >
                  Ver {selB}
                </Link>
              </div>
            </aside>
          </div>
        )}

        {/* Sector flow strip */}
        {flows.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-bg-border">
            {flows.map((f) => {
              const up = f.change4h >= 0
              return (
                <div key={f.sector} className="px-7 py-[18px] border-r border-bg-border space-y-2">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-xs font-sans text-ink-secondary truncate capitalize">{f.sector.toLowerCase()}</span>
                    <span className={clsx('text-[15px] font-mono tabular-nums', up ? 'text-atlas' : 'text-bear')}>
                      {up ? '+' : ''}{f.change4h.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full bg-bg-elevated overflow-hidden">
                    <div className={clsx('h-full rounded-full', up ? 'bg-atlas' : 'bg-bear')} style={{ width: `${Math.min(100, Math.max(0, f.score))}%` }} />
                  </div>
                  <p className="text-[10px] font-mono text-ink-muted">Fuerza {f.score} · flujo 4H</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
