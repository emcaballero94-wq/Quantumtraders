'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'

export interface TradeChecklist {
  tradeId: string
  preStructure: boolean
  preZone: boolean
  preTiming: boolean
  preRisk: boolean
  postPlanFollowed: boolean
  postExecutionQuality: boolean
  postEmotionStable: boolean
  postLessonLogged: boolean
  setupScore: number | null
  setupBias: string | null
  confluenceCount: number | null
  setupRules: unknown
  notes: string | null
  updatedAt: string
}

type ChecklistBooleanKey =
  | 'preStructure'
  | 'preZone'
  | 'preTiming'
  | 'preRisk'
  | 'postPlanFollowed'
  | 'postExecutionQuality'
  | 'postEmotionStable'
  | 'postLessonLogged'

export interface Trade {
  id: string | number
  symbol: string
  type: string
  result: string
  profit: number
  date: string
  checklist?: TradeChecklist | null
}

interface TradeJournalProps {
  trades: Trade[]
  loading?: boolean
}

function checklistCompletion(checklist: TradeChecklist | null | undefined): number {
  if (!checklist) return 0
  const items = [
    checklist.preStructure,
    checklist.preZone,
    checklist.preTiming,
    checklist.preRisk,
    checklist.postPlanFollowed,
    checklist.postExecutionQuality,
    checklist.postEmotionStable,
    checklist.postLessonLogged,
  ]
  const checked = items.filter(Boolean).length
  return Math.round((checked / items.length) * 100)
}

function setupBiasLabel(setupBias: string | null | undefined): string {
  if (setupBias === 'long') return 'alcista'
  if (setupBias === 'short') return 'bajista'
  return 'neutral'
}

export function TradeJournal({ trades, loading = false }: TradeJournalProps) {
  const totalProfit = trades.reduce((acc, trade) => acc + trade.profit, 0)
  const closedTrades = trades.filter((trade) => trade.result !== 'OPEN')
  const winTrades = closedTrades.filter((trade) => trade.profit > 0)
  const winRate = closedTrades.length > 0 ? Math.round((winTrades.length / closedTrades.length) * 100) : 0

  const [expandedId, setExpandedId] = useState<string | number | null>(null)
  const [savingId, setSavingId] = useState<string | number | null>(null)
  const [drafts, setDrafts] = useState<Record<string, TradeChecklist>>({})

  useEffect(() => {
    const seed: Record<string, TradeChecklist> = {}
    for (const trade of trades) {
      if (!trade.checklist) continue
      seed[String(trade.id)] = trade.checklist
    }
    setDrafts(seed)
  }, [trades])

  const avgSetupScore = useMemo(() => {
    const scores = trades
      .map((trade) => trade.checklist?.setupScore)
      .filter((score): score is number => typeof score === 'number')
    if (scores.length === 0) return null
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }, [trades])

  const updateDraft = (tradeId: string | number, patch: Partial<TradeChecklist>) => {
    const key = String(tradeId)
    const existing = drafts[key] ?? trades.find((trade) => String(trade.id) === key)?.checklist
    if (!existing) return
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...existing,
        ...patch,
      },
    }))
  }

  const persistChecklist = async (tradeId: string | number) => {
    const key = String(tradeId)
    const checklist = drafts[key]
    if (!checklist) return

    setSavingId(tradeId)
    try {
      await fetch('/api/journal/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: key,
          preStructure: checklist.preStructure,
          preZone: checklist.preZone,
          preTiming: checklist.preTiming,
          preRisk: checklist.preRisk,
          postPlanFollowed: checklist.postPlanFollowed,
          postExecutionQuality: checklist.postExecutionQuality,
          postEmotionStable: checklist.postEmotionStable,
          postLessonLogged: checklist.postLessonLogged,
          notes: checklist.notes,
        }),
      })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-bg-border bg-bg-deep overflow-hidden flex flex-col glass h-full">
      <div className="px-5 py-4 border-b border-bg-border bg-bg-card/50 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Registro de Operaciones</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-ink-dim uppercase">
            Setup promedio: {avgSetupScore ?? '--'}
          </span>
          <button className="text-[10px] font-mono text-oracle hover:underline uppercase">Nuevo Registro</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-bg-border text-[9px] text-ink-dim uppercase">
              <th className="px-5 py-2 font-semibold">Par</th>
              <th className="px-5 py-2 font-semibold">Tipo</th>
              <th className="px-5 py-2 font-semibold">Resultado</th>
              <th className="px-5 py-2 font-semibold">Setup</th>
              <th className="px-5 py-2 font-semibold text-right">P/L</th>
              <th className="px-5 py-2 font-semibold text-right">Checklist</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bg-border/50">
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-dim text-xs">Cargando journal...</td>
              </tr>
            )}

            {!loading && trades.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink-dim text-xs">Sin operaciones registradas.</td>
              </tr>
            )}

            {!loading && trades.map((trade) => {
              const checklist = drafts[String(trade.id)] ?? trade.checklist ?? null
              const completion = checklistCompletion(checklist)
              const setupScore = checklist?.setupScore ?? null
              const expanded = expandedId === trade.id

              return (
                <Fragment key={String(trade.id)}>
                  <tr className="hover:bg-bg-elevated/40 transition-colors">
                    <td className="px-5 py-3 font-bold text-ink-primary">{trade.symbol}</td>
                    <td className="px-5 py-3">
                      <span className={trade.type === 'BUY' ? 'text-atlas' : 'text-bear'}>{trade.type}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-secondary">{trade.result}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-1 rounded border ${setupScore !== null && setupScore >= 70 ? 'text-atlas border-atlas/30 bg-atlas/10' : setupScore !== null && setupScore >= 50 ? 'text-oracle border-oracle/30 bg-oracle/10' : 'text-ink-muted border-bg-border bg-bg-elevated'}`}>
                          {setupScore ?? '--'}
                        </span>
                        <span className="text-[10px] text-ink-dim">{setupBiasLabel(checklist?.setupBias)}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-right font-bold ${trade.profit >= 0 ? 'text-atlas' : 'text-bear'}`}>
                      {trade.profit >= 0 ? '+' : ''}{trade.profit}$
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="text-[10px] font-mono text-oracle hover:text-oracle/80 uppercase"
                        onClick={() => setExpandedId(expanded ? null : trade.id)}
                      >
                        {expanded ? 'Ocultar' : `Ver (${completion}%)`}
                      </button>
                    </td>
                  </tr>

                  {expanded && checklist && (
                    <tr>
                      <td colSpan={6} className="px-5 pb-4">
                        <div className="rounded-lg border border-bg-border bg-bg-card p-4 space-y-4">
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <ChecklistGroup
                              title="Pre-Trade"
                              items={[
                                { label: 'Estructura validada', key: 'preStructure' },
                                { label: 'Zona confirmada', key: 'preZone' },
                                { label: 'Timing de sesión', key: 'preTiming' },
                                { label: 'Riesgo definido', key: 'preRisk' },
                              ]}
                              checklist={checklist}
                              onToggle={(key, value) => updateDraft(trade.id, { [key]: value })}
                            />
                            <ChecklistGroup
                              title="Post-Trade"
                              items={[
                                { label: 'Seguí el plan', key: 'postPlanFollowed' },
                                { label: 'Ejecución limpia', key: 'postExecutionQuality' },
                                { label: 'Gestión emocional', key: 'postEmotionStable' },
                                { label: 'Lección documentada', key: 'postLessonLogged' },
                              ]}
                              checklist={checklist}
                              onToggle={(key, value) => updateDraft(trade.id, { [key]: value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <p className="text-[10px] font-mono text-ink-muted uppercase">Notas de checklist</p>
                            <textarea
                              value={checklist.notes ?? ''}
                              onChange={(event) => updateDraft(trade.id, { notes: event.target.value })}
                              rows={2}
                              className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
                            />
                          </div>

                          {Array.isArray(checklist.setupRules) && checklist.setupRules.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-mono text-ink-muted uppercase">Reglas explícitas del setup</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {checklist.setupRules.map((rule: any) => (
                                  <div key={rule.id} className="text-[10px] font-mono px-3 py-2 border border-bg-border rounded bg-bg-elevated/30">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-ink-secondary">{rule.label}</span>
                                      <span className={rule.passed ? 'text-atlas' : 'text-bear'}>
                                        {rule.score}
                                      </span>
                                    </div>
                                    <p className="text-ink-dim mt-1">{rule.evidence}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              onClick={() => persistChecklist(trade.id)}
                              disabled={savingId === trade.id}
                              className="px-4 py-2 border border-oracle/30 bg-oracle/10 rounded-lg text-[10px] font-mono text-oracle uppercase tracking-wider hover:bg-oracle/20 disabled:opacity-60"
                            >
                              {savingId === trade.id ? 'Guardando...' : 'Guardar checklist'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-bg-border bg-bg-card/30 flex justify-between items-center">
        <span className="text-[10px] text-ink-dim uppercase">Win Rate: {winRate}%</span>
        <span className="text-[10px] text-ink-dim uppercase tracking-widest">Operaciones Totales: {trades.length} · P/L {totalProfit >= 0 ? '+' : ''}{totalProfit}$</span>
      </div>
    </div>
  )
}

function ChecklistGroup({
  title,
  items,
  checklist,
  onToggle,
}: {
  title: string
  items: Array<{ label: string; key: ChecklistBooleanKey }>
  checklist: TradeChecklist
  onToggle: (key: ChecklistBooleanKey, value: boolean) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-bg-border bg-bg-elevated/20 p-3">
      <p className="text-[10px] font-mono text-ink-muted uppercase">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-xs font-mono text-ink-secondary">
            <input
              type="checkbox"
              checked={Boolean(checklist[item.key])}
              onChange={(event) => onToggle(item.key, event.target.checked)}
              className="w-3.5 h-3.5 rounded border-bg-border bg-bg-card"
            />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  )
}
