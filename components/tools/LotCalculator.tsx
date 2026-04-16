'use client'

import { useState, useEffect } from 'react'

export function LotCalculator() {
  const [balance, setBalance] = useState(10000)
  const [riskPercent, setRiskPercent] = useState(1)
  const [stopLossPips, setStopLossPips] = useState(20)
  const [pipValue, setPipValue] = useState(10) // Standard for EURUSD
  const [result, setResult] = useState(0)

  useEffect(() => {
    const riskAmount = balance * (riskPercent / 100)
    const lotSize = riskAmount / (stopLossPips * pipValue)
    setResult(Number(lotSize.toFixed(2)))
  }, [balance, riskPercent, stopLossPips, pipValue])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-5 glass-card space-y-4">
      <div className="flex items-center justify-between border-b border-bg-border pb-3">
        <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Calculadora de Riesgo</h3>
        <span className="text-[10px] font-mono text-oracle uppercase">Forex / Gold</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-ink-muted uppercase">Balance ($)</label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-ink-muted uppercase">Riesgo (%)</label>
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-ink-muted uppercase">Stop Loss (Pips)</label>
          <input
            type="number"
            value={stopLossPips}
            onChange={(e) => setStopLossPips(Number(e.target.value))}
            className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono text-ink-muted uppercase">Lotes Sugeridos</label>
          <div className="w-full bg-oracle/10 border border-oracle/30 rounded-lg px-3 py-2 text-sm font-mono font-bold text-oracle text-center">
            {result}
          </div>
        </div>
      </div>

      <div className="p-3 bg-bg-deep rounded-lg border border-bg-border">
        <div className="flex justify-between text-[10px] font-mono uppercase">
          <span className="text-ink-muted">Riesgo en $:</span>
          <span className="text-bear font-bold">${(balance * (riskPercent / 100)).toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
