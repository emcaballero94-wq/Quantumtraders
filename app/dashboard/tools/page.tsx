'use client'

import { LotCalculator } from '@/components/tools/LotCalculator'
import { TradeJournal, Trade } from '@/components/tools/TradeJournal'
import { VoiceConsole } from '@/components/tools/VoiceConsole'
import { useEffect, useState } from 'react'

type ApiTrade = {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  result: string
  profit: number
  createdAt: string
}

export default function ToolsPage() {
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
      setTrades(prev => [trade, ...prev])
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bg-border pb-6">
        <div>
          <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">HERRAMIENTAS OPERATIVAS</h1>
          <p className="text-xs font-mono text-ink-muted mt-0.5 tracking-wider uppercase">Calculadoras · Registros · Mando de Voz</p>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-mono text-oracle uppercase tracking-widest px-3 py-1 bg-oracle/5 border border-oracle/20 rounded-lg">Toolbox v1.2</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        
        {/* Left: Voice & Calc */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <VoiceConsole onTradeParsed={handleTradeParsed} />
          <LotCalculator />
        </div>

        {/* Right: Journal */}
        <div className="col-span-12 lg:col-span-8">
          <TradeJournal trades={trades} loading={loading} />
        </div>

      </div>

    </div>
  )
}
