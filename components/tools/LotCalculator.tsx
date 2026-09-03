'use client'

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'

type InstrumentType = 'stocks' | 'futures' | 'forex' | 'crypto'

const TYPE_LABEL: Record<InstrumentType, string> = {
  stocks: 'Stocks',
  futures: 'Futures / Indices',
  forex: 'Forex',
  crypto: 'Crypto',
}

// Common point values ($ per point per contract) for well-known futures/index
// CFDs — starting defaults only, always editable, since exact specs vary by
// broker/exchange and change over time.
const FUTURES_PRESETS: Record<string, number> = {
  'ES (S&P 500)': 50,
  'NQ (Nasdaq 100)': 20,
  'YM (Dow 30)': 5,
  'Custom': 0,
}

export function LotCalculator() {
  const [type, setType] = useState<InstrumentType>('stocks')
  const [balance, setBalance] = useState(10000)
  const [riskPercent, setRiskPercent] = useState(1)

  // Stocks / Crypto — price-based
  const [entryPrice, setEntryPrice] = useState(100)
  const [stopPrice, setStopPrice] = useState(98)

  // Futures / Indices — point-based
  const [futuresPreset, setFuturesPreset] = useState<keyof typeof FUTURES_PRESETS>('ES (S&P 500)')
  const [pointValue, setPointValue] = useState(FUTURES_PRESETS['ES (S&P 500)'])
  const [stopPoints, setStopPoints] = useState(10)

  // Forex — pip-based
  const [stopLossPips, setStopLossPips] = useState(20)
  const [pipValue, setPipValue] = useState(10)

  const riskAmount = balance * (riskPercent / 100)

  const { result, unit, warning } = useMemo(() => {
    if (type === 'stocks' || type === 'crypto') {
      const perUnitRisk = Math.abs(entryPrice - stopPrice)
      if (perUnitRisk === 0) return { result: 0, unit: type === 'stocks' ? 'shares' : 'units', warning: 'Entry and stop can\'t be equal.' }
      const units = riskAmount / perUnitRisk
      return { result: type === 'stocks' ? Math.floor(units) : Number(units.toFixed(4)), unit: type === 'stocks' ? 'shares' : 'units', warning: null }
    }
    if (type === 'futures') {
      if (pointValue <= 0 || stopPoints <= 0) return { result: 0, unit: 'contracts', warning: 'Set a point value and stop distance greater than 0.' }
      const contracts = riskAmount / (stopPoints * pointValue)
      return { result: Number(contracts.toFixed(2)), unit: 'contracts', warning: null }
    }
    // forex
    if (stopLossPips <= 0 || pipValue <= 0) return { result: 0, unit: 'lots', warning: 'Set stop loss pips and pip value greater than 0.' }
    const lots = riskAmount / (stopLossPips * pipValue)
    return { result: Number(lots.toFixed(2)), unit: 'lots', warning: null }
  }, [type, riskAmount, entryPrice, stopPrice, pointValue, stopPoints, stopLossPips, pipValue])

  return (
    <div className="rounded-xl border border-bg-border bg-bg-card p-5 glass-card space-y-4">
      <div className="flex items-center justify-between border-b border-bg-border pb-3">
        <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-widest">Position Size Calculator</h3>
      </div>

      {/* Instrument type selector */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(TYPE_LABEL) as InstrumentType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={clsx(
              'px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wide transition-all',
              type === t
                ? 'bg-oracle/15 text-oracle border-oracle/35'
                : 'bg-bg-elevated/30 text-ink-muted border-bg-border hover:border-oracle/25'
            )}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
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
          <label className="text-[10px] font-mono text-ink-muted uppercase">Risk (%)</label>
          <input
            type="number"
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
          />
        </div>

        {(type === 'stocks' || type === 'crypto') && (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-ink-muted uppercase">Entry Price</label>
              <input
                type="number"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-ink-muted uppercase">Stop Price</label>
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(Number(e.target.value))}
                className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
              />
            </div>
          </>
        )}

        {type === 'futures' && (
          <>
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-mono text-ink-muted uppercase">Instrument</label>
              <select
                value={futuresPreset}
                onChange={(e) => {
                  const preset = e.target.value as keyof typeof FUTURES_PRESETS
                  setFuturesPreset(preset)
                  if (preset !== 'Custom') setPointValue(FUTURES_PRESETS[preset])
                }}
                className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
              >
                {Object.keys(FUTURES_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-ink-muted uppercase">$ per Point</label>
              <input
                type="number"
                value={pointValue}
                onChange={(e) => setPointValue(Number(e.target.value))}
                className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-ink-muted uppercase">Stop (Points)</label>
              <input
                type="number"
                value={stopPoints}
                onChange={(e) => setStopPoints(Number(e.target.value))}
                className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
              />
            </div>
          </>
        )}

        {type === 'forex' && (
          <>
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
              <label className="text-[10px] font-mono text-ink-muted uppercase">Pip Value ($)</label>
              <input
                type="number"
                value={pipValue}
                onChange={(e) => setPipValue(Number(e.target.value))}
                className="w-full bg-bg-deep border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-ink-primary focus:outline-none focus:border-oracle/50"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5 col-span-2">
          <label className="text-[10px] font-mono text-ink-muted uppercase">Suggested Position Size</label>
          <div className="w-full bg-oracle/10 border border-oracle/30 rounded-lg px-3 py-2 text-sm font-mono font-bold text-oracle text-center">
            {result} {unit}
          </div>
        </div>
      </div>

      {warning && (
        <p className="text-[10px] font-mono text-pulse">{warning}</p>
      )}

      <div className="p-3 bg-bg-deep rounded-lg border border-bg-border">
        <div className="flex justify-between text-[10px] font-mono uppercase">
          <span className="text-ink-muted">Risk in $:</span>
          <span className="text-bear font-bold">${riskAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
