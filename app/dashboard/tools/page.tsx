'use client'

import { LotCalculator } from '@/components/tools/LotCalculator'
import { TradeJournal, Trade } from '@/components/tools/TradeJournal'
import { VoiceConsole } from '@/components/tools/VoiceConsole'
import { useState } from 'react'

export default function ToolsPage() {
  const [trades, setTrades] = useState<Trade[]>([])

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
          <TradeJournal trades={trades} />
        </div>

      </div>

    </div>
  )
}
