'use client'

import { useEffect, useMemo, useState } from 'react'
import { LotCalculator } from '@/components/tools/LotCalculator'
import { TradeJournal, Trade, TradeChecklist } from '@/components/tools/TradeJournal'
import { AddTradeModal } from '@/components/tools/AddTradeModal'
import { VoiceConsole } from '@/components/tools/VoiceConsole'
import { TradeAuditPanel } from '@/components/journal/TradeAuditPanel'
import { computeTradeAudit } from '@/lib/journal/audit-engine'
import type { TradeJournalEntry, TradeChecklist as PersistedChecklist } from '@/lib/oracle/persistence'

type ApiTrade = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  createdAt: string
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  exitPrice: number | null
  lotSize: number | null
  commission: number
  swap: number
  checklist?: TradeChecklist | null
}

export default function ToolsPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadTrades = async () => {
      try {
        const response = await fetch('/api/journal/trades')
        const payload = await response.json()
        if (!mounted) return
        const items = (payload?.data ?? []) as ApiTrade[]
        setTrades(
          items.map((item) => ({
            id: item.id,
            symbol: item.symbol,
            type: item.side,
            result: item.result,
            profit: item.profit,
            date: new Date(item.createdAt).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }),
            createdAt: item.createdAt,
            entryPrice: item.entryPrice,
            stopLoss: item.stopLoss,
            takeProfit: item.takeProfit,
            exitPrice: item.exitPrice,
            lotSize: item.lotSize,
            commission: item.commission,
            swap: item.swap,
            checklist: item.checklist ?? null,
          })),
        )
      } catch {
        if (!mounted) return
        setTrades([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadTrades()
    return () => {
      mounted = false
    }
  }, [])

  const handleTradeParsed = (trade: Trade) => {
    setTrades((prev) => [trade, ...prev])
  }

  const auditStats = useMemo(() => {
    const entries: TradeJournalEntry[] = trades.map((t) => ({
      id: String(t.id),
      symbol: t.symbol,
      side: (t.type === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
      result: t.result,
      profit: t.profit,
      entryPrice: t.entryPrice ?? null,
      stopLoss: t.stopLoss ?? null,
      takeProfit: t.takeProfit ?? null,
      exitPrice: t.exitPrice ?? null,
      lotSize: t.lotSize ?? null,
      commission: t.commission ?? 0,
      swap: t.swap ?? 0,
      closedAt: null,
      source: 'manual',
      notes: null,
      createdAt: t.createdAt ?? new Date().toISOString(),
    }))
    const checklists: Record<string, PersistedChecklist> = {}
    for (const t of trades) {
      if (!t.checklist) continue
      checklists[String(t.id)] = {
        tradeId: String(t.id),
        preStructure: t.checklist.preStructure,
        preZone: t.checklist.preZone,
        preTiming: t.checklist.preTiming,
        preRisk: t.checklist.preRisk,
        postPlanFollowed: t.checklist.postPlanFollowed,
        postExecutionQuality: t.checklist.postExecutionQuality,
        postEmotionStable: t.checklist.postEmotionStable,
        postLessonLogged: t.checklist.postLessonLogged,
        setupScore: t.checklist.setupScore,
        setupBias: t.checklist.setupBias,
        confluenceCount: t.checklist.confluenceCount,
        setupRules: t.checklist.setupRules,
        emotionTag: t.checklist.emotionTag ?? null,
        mistakeTag: t.checklist.mistakeTag ?? null,
        notes: t.checklist.notes,
        updatedAt: t.checklist.updatedAt,
      }
    }
    return computeTradeAudit(entries, checklists)
  }, [trades])

  return (
    <div className="space-y-6 animate-fade-in pb-20">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-border pb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">Trade Audit</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5 tracking-wider uppercase">Your trading history, turned into information — plus calculators &amp; voice command</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-mono text-oracle uppercase tracking-widest px-3 py-1 bg-oracle/5 border border-oracle/20 rounded-lg">Toolbox v1.3</span>
        </div>
      </div>

      <TradeAuditPanel stats={auditStats} />

      <div className="grid grid-cols-12 gap-6">

        {/* Left: Voice & Calc */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <VoiceConsole onTradeParsed={handleTradeParsed} />
          <LotCalculator />
        </div>

        {/* Right: Journal */}
        <div className="col-span-12 lg:col-span-8">
          <TradeJournal trades={trades} loading={loading} onAddTrade={() => setShowAddModal(true)} />
        </div>

      </div>

      {showAddModal && (
        <AddTradeModal
          onClose={() => setShowAddModal(false)}
          onCreated={(trade) => setTrades((prev) => [trade, ...prev])}
        />
      )}

    </div>
  )
}
