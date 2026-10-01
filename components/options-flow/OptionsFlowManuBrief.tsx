'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

type OptionsFlowLean = 'BULLISH' | 'BEARISH' | 'NEUTRAL'

interface OptionsFlowBriefFactsSummary {
  score: number
  scoreConfidence: 'LOW' | 'MEDIUM' | 'HIGH'
  dataQuality: 'GOOD' | 'DEGRADED'
  tradeCount: number
  largeTradeCount: number
}

interface OptionsFlowAnalyzeResponse {
  success: boolean
  error?: string
  data?: {
    lean: OptionsFlowLean
    keyChange: string
    narrative: string
    narrativeSource: 'ai' | 'deterministic'
    facts: OptionsFlowBriefFactsSummary
    lastUpdated: string
  }
}

interface OptionsFlowBriefHistoryItem {
  id: string
  lean: OptionsFlowLean
  keyChange: string
  narrative: string
  narrativeSource: 'ai' | 'deterministic'
  createdAt: string
}

interface OptionsFlowHistoryResponse {
  success: boolean
  error?: string
  data?: { briefs: OptionsFlowBriefHistoryItem[] }
}

interface OptionsFlowManuBriefProps {
  currency: 'BTC' | 'ETH'
}

const FIRST_RUN_DELAY_MS = 1_500
const HISTORY_LIMIT = 8

const LEAN_LABEL: Record<OptionsFlowLean, string> = {
  BULLISH: 'ALCISTA',
  BEARISH: 'BAJISTA',
  NEUTRAL: 'NEUTRAL',
}

function leanColor(lean: OptionsFlowLean | null): string {
  if (lean === 'BULLISH') return 'text-bull'
  if (lean === 'BEARISH') return 'text-bear'
  return 'text-ink-secondary'
}

// Same architecture as components/gex/GexManuBrief.tsx — on-demand (debounced
// settle + manual button) rather than a polling loop, since
// /api/market/crypto-options/flow recomputes from scratch per request
// instead of streaming continuously like Order Flow.
export function OptionsFlowManuBrief({ currency }: OptionsFlowManuBriefProps) {
  const [lean, setLean] = useState<OptionsFlowLean | null>(null)
  const [keyChange, setKeyChange] = useState<string | null>(null)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [facts, setFacts] = useState<OptionsFlowBriefFactsSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAt, setLastAt] = useState<Date | null>(null)
  const [history, setHistory] = useState<OptionsFlowBriefHistoryItem[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const latestRef = useRef(currency)
  useEffect(() => {
    latestRef.current = currency
  }, [currency])

  const loadHistory = useCallback(async () => {
    const current = latestRef.current
    try {
      const response = await fetch(`/api/manu/options-flow-analyze?currency=${current}&limit=${HISTORY_LIMIT}`)
      const result = (await response.json()) as OptionsFlowHistoryResponse
      if (result.success && result.data) setHistory(result.data.briefs)
    } catch {
      // History is a nice-to-have — a failed fetch just leaves the list empty.
    }
  }, [])

  const generate = useCallback(async () => {
    const current = latestRef.current
    setLoading(true)
    try {
      const response = await fetch('/api/manu/options-flow-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: current }),
      })
      const result = (await response.json()) as OptionsFlowAnalyzeResponse
      if (result.success && result.data) {
        setLean(result.data.lean)
        setKeyChange(result.data.keyChange)
        setNarrative(result.data.narrative)
        setFacts(result.data.facts)
        setError(null)
        loadHistory()
      } else {
        setError(result.error ?? 'No se pudo generar el resumen.')
      }
    } catch {
      setError('Error de conexión al generar el resumen.')
    } finally {
      setLoading(false)
      setLastAt(new Date())
    }
  }, [loadHistory])

  useEffect(() => {
    setLean(null)
    setKeyChange(null)
    setNarrative(null)
    setFacts(null)
    setError(null)
    setHistory([])
    setExpandedId(null)
    loadHistory()
    const timer = setTimeout(generate, FIRST_RUN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [currency, generate, loadHistory])

  return (
    <div data-tour="options-manu-brief" className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono uppercase tracking-[0.12em] text-oracle">M.A.N.U. · Options Flow</span>
          {lean && <span className={clsx('text-[10px] font-mono uppercase tracking-wider', leanColor(lean))}>{LEAN_LABEL[lean]}</span>}
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
        {loading && !narrative && <p className="text-xs font-sans text-ink-secondary">Analizando el flujo de opciones…</p>}

        {keyChange && (
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Key change</p>
            <p className="text-sm font-sans text-ink-primary">{keyChange}</p>
          </div>
        )}

        {narrative && <p className="text-sm font-sans leading-relaxed text-ink-primary whitespace-pre-wrap">{narrative}</p>}

        {!loading && !narrative && <p className="text-xs font-sans text-ink-dim">{error ?? 'Esperando datos para el primer resumen…'}</p>}

        {facts && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-bg-border">
            <span className="text-[10px] font-mono text-ink-dim">Trades: {facts.tradeCount}</span>
            <span className="text-[10px] font-mono text-ink-dim">Grandes: {facts.largeTradeCount}</span>
            <span className={clsx('text-[10px] font-mono', facts.dataQuality === 'GOOD' ? 'text-ink-dim' : 'text-oracle')}>
              Calidad: {facts.dataQuality === 'GOOD' ? 'OK' : 'limitada'}
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
                        <span className={clsx('text-[9px] font-mono uppercase tracking-wider shrink-0', leanColor(item.lean))}>
                          {LEAN_LABEL[item.lean]}
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
