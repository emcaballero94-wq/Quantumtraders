'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { TermHelp } from '@/components/ui/TermHelp'

type GexStatus = 'STABLE' | 'REGIME_SHIFT' | 'NO_HISTORY'

interface OptionsChainSummary {
  putCallVolumeRatio: number | null
  putCallOpenInterestRatio: number | null
  ivSkew: number | null
}

interface GexBriefFacts {
  underlyingPrice: number
  netGex: number
  regime: 'POSITIVE' | 'NEGATIVE'
  contractsWithGamma: number
  totalContracts: number
  dataQuality: 'GOOD' | 'DEGRADED'
  chain: OptionsChainSummary
  dayOverDay: { priorDate: string; regimeShift: string } | null
}

interface GexAnalyzeResponse {
  success: boolean
  error?: string
  data?: {
    status: GexStatus
    keyChange: string
    narrative: string
    narrativeSource: 'ai' | 'deterministic'
    facts: GexBriefFacts
    lastUpdated: string
  }
}

interface GexBriefHistoryItem {
  id: string
  status: GexStatus
  keyChange: string
  narrative: string
  narrativeSource: 'ai' | 'deterministic'
  createdAt: string
}

interface GexHistoryResponse {
  success: boolean
  error?: string
  data?: { briefs: GexBriefHistoryItem[] }
}

interface GexManuBriefProps {
  assetClass: 'equity' | 'crypto'
  symbolOrCurrency: string
}

const FIRST_RUN_DELAY_MS = 1_500
const HISTORY_LIMIT = 8

const STATUS_LABEL: Record<GexStatus, string> = {
  STABLE: 'ESTABLE',
  REGIME_SHIFT: 'CAMBIO DE RÉGIMEN',
  NO_HISTORY: 'SIN HISTORIAL',
}

function statusColor(status: GexStatus | null): string {
  if (status === 'REGIME_SHIFT') return 'text-bear'
  if (status === 'NO_HISTORY') return 'text-ink-secondary'
  return 'text-atlas'
}

export function GexManuBrief({ assetClass, symbolOrCurrency }: GexManuBriefProps) {
  const [status, setStatus] = useState<GexStatus | null>(null)
  const [keyChange, setKeyChange] = useState<string | null>(null)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [facts, setFacts] = useState<GexBriefFacts | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAt, setLastAt] = useState<Date | null>(null)
  const [history, setHistory] = useState<GexBriefHistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Reads the latest assetClass/symbol through a ref so the fetch function's
  // identity stays stable — only the effect below decides when to call it
  // (on symbol/asset-class change, debounced), not every render.
  const latestRef = useRef({ assetClass, symbolOrCurrency })
  useEffect(() => {
    latestRef.current = { assetClass, symbolOrCurrency }
  }, [assetClass, symbolOrCurrency])

  const loadHistory = useCallback(async () => {
    const current = latestRef.current
    try {
      const response = await fetch(
        `/api/manu/gex-analyze?assetClass=${current.assetClass}&symbol=${encodeURIComponent(current.symbolOrCurrency)}&limit=${HISTORY_LIMIT}`,
      )
      const result = (await response.json()) as GexHistoryResponse
      if (result.success && result.data) setHistory(result.data.briefs)
    } catch {
      // History is a nice-to-have — a failed fetch just leaves the list empty.
    }
  }, [])

  const generate = useCallback(async () => {
    const current = latestRef.current
    setLoading(true)
    try {
      const response = await fetch('/api/manu/gex-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetClass: current.assetClass, symbol: current.symbolOrCurrency }),
      })
      const result = (await response.json()) as GexAnalyzeResponse
      if (result.success && result.data) {
        setStatus(result.data.status)
        setKeyChange(result.data.keyChange)
        setNarrative(result.data.narrative)
        setFacts(result.data.facts)
        setError(null)
        loadHistory()
      } else {
        setError(result.error ?? 'No se pudo generar el análisis.')
      }
    } catch {
      setError('Error de conexión al generar el análisis.')
    } finally {
      setLoading(false)
      setLastAt(new Date())
    }
  }, [loadHistory])

  // Options chains don't move tick-by-tick the way order flow does, so this
  // is on-demand (one run shortly after the symbol/asset class settles, plus
  // a manual "Actualizar" button) instead of a 60s auto-refresh loop.
  useEffect(() => {
    setStatus(null)
    setKeyChange(null)
    setNarrative(null)
    setFacts(null)
    setError(null)
    setHistory([])
    setExpandedId(null)
    loadHistory()
    const timer = setTimeout(generate, FIRST_RUN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [assetClass, symbolOrCurrency, generate, loadHistory])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-[0.12em] text-oracle">M.A.N.U. · GEX &amp; Options</span>
          {status && <span className={clsx('text-[10px] font-mono uppercase tracking-wider', statusColor(status))}>{STATUS_LABEL[status]}</span>}
        </div>
        <div className="flex items-center gap-3">
          {lastAt && (
            <span className="text-[10px] font-mono text-ink-dim">
              Actualizado {lastAt.toLocaleTimeString('es-ES', { hour12: false, timeZone: 'UTC' })} UTC
            </span>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border border-bg-border text-ink-secondary hover:border-ink-muted transition-colors disabled:opacity-50"
          >
            {loading ? 'Analizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        {loading && !narrative && <p className="text-xs font-sans text-ink-secondary">Analizando GEX y flujo de opciones…</p>}

        {keyChange && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Key change</p>
            <p className="text-sm font-sans text-ink-primary">{keyChange}</p>
          </div>
        )}

        {narrative && <p className="text-sm font-sans leading-relaxed text-ink-primary whitespace-pre-wrap">{narrative}</p>}

        {!loading && !narrative && <p className="text-xs font-sans text-ink-dim">{error ?? 'Esperando datos para el primer análisis…'}</p>}

        {facts && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-bg-border">
            <span className="text-[10px] font-mono text-ink-dim">
              Put/Call vol <TermHelp term="put_call_ratio" />: {facts.chain.putCallVolumeRatio !== null ? facts.chain.putCallVolumeRatio.toFixed(2) : '—'}
            </span>
            <span className="text-[10px] font-mono text-ink-dim">
              Put/Call OI: {facts.chain.putCallOpenInterestRatio !== null ? facts.chain.putCallOpenInterestRatio.toFixed(2) : '—'}
            </span>
            <span className="text-[10px] font-mono text-ink-dim">
              Skew IV <TermHelp term="iv_skew" />: {facts.chain.ivSkew !== null ? `${(facts.chain.ivSkew * 100).toFixed(2)}pp` : '—'}
            </span>
            <span className={clsx('text-[10px] font-mono', facts.dataQuality === 'GOOD' ? 'text-ink-dim' : 'text-oracle')}>
              Calidad: {facts.contractsWithGamma}/{facts.totalContracts} contratos
            </span>
          </div>
        )}

        {history.length > 0 && (
          <div className="pt-2 border-t border-bg-border">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary hover:text-ink-primary transition-colors"
            >
              {historyOpen ? '▾' : '▸'} Briefs anteriores ({history.length})
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-1.5">
                {history.map((item) => {
                  const expanded = expandedId === item.id
                  return (
                    <div key={item.id} className="rounded-lg border border-bg-border bg-bg-elevated/40">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-[9px] font-mono text-ink-dim whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleString('es-ES', { hour12: false, timeZone: 'UTC' })} UTC
                          </span>
                          <span className="text-[11px] font-sans text-ink-secondary truncate">{item.keyChange}</span>
                        </span>
                        <span className={clsx('text-[9px] font-mono uppercase tracking-wider shrink-0', statusColor(item.status))}>
                          {STATUS_LABEL[item.status]}
                        </span>
                      </button>
                      {expanded && (
                        <p className="px-3 pb-3 text-xs font-sans leading-relaxed text-ink-primary whitespace-pre-wrap border-t border-bg-border pt-2">
                          {item.narrative}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
