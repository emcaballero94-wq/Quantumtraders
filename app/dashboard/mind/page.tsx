'use client'

import { useEffect, useState } from 'react'
import { Trade, TradeChecklist, TradeJournal } from '@/components/tools/TradeJournal'

type ApiTrade = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  entryPrice: number | null
  stopLoss: number | null
  takeProfit: number | null
  notes: string | null
  createdAt: string
  checklist?: TradeChecklist | null
}

function mapApiTrade(item: ApiTrade): Trade {
  return {
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
    entryPrice: item.entryPrice,
    stopLoss: item.stopLoss,
    takeProfit: item.takeProfit,
    notes: item.notes,
    checklist: item.checklist ?? null,
  }
}

export default function MindPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadTrades = async () => {
      try {
        const response = await fetch('/api/journal/trades')
        const payload = await response.json()
        if (!mounted) return
        const items = (payload?.data ?? []) as ApiTrade[]
        setTrades(items.map(mapApiTrade))
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

  const handleTradeCreated = (trade: Trade) => {
    setTrades((prev) => [trade, ...prev.filter((item) => String(item.id) !== String(trade.id))])
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between border-b border-bg-border pb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">MIND · Diario de Trading</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5 tracking-wider uppercase">Bitácora profesional · Proceso · Disciplina</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-oracle uppercase tracking-widest px-3 py-1 bg-oracle/5 border border-oracle/20 rounded-lg">Mind v2</span>
        </div>
      </div>

      <TradeJournal
        trades={trades}
        loading={loading}
        onTradeCreated={handleTradeCreated}
      />
    </div>
  )
}
