'use client'

import { useState } from 'react'
import type { Trade } from '@/components/tools/TradeJournal'

interface AddTradeModalProps {
  onClose: () => void
  onCreated: (trade: Trade) => void
}

const EMOTION_TAGS = ['Confident', 'FOMO', 'Revenge', 'Bored', 'Anxious', 'Disciplined']
const MISTAKE_TAGS = ['None', 'Early exit', 'Moved stop', 'Oversized', 'No confirmation', 'Chased entry']

function numOrNull(value: string): number | null {
  const n = Number(value)
  return value.trim() === '' || Number.isNaN(n) ? null : n
}

export function AddTradeModal({ onClose, onCreated }: AddTradeModalProps) {
  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [result, setResult] = useState<'OPEN' | 'WIN' | 'LOSS'>('WIN')
  const [profit, setProfit] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [lotSize, setLotSize] = useState('')
  const [emotionTag, setEmotionTag] = useState('')
  const [mistakeTag, setMistakeTag] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!symbol.trim()) {
      setError('Symbol is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/journal/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          side,
          result,
          profit: numOrNull(profit) ?? 0,
          entryPrice: numOrNull(entryPrice),
          stopLoss: numOrNull(stopLoss),
          takeProfit: numOrNull(takeProfit),
          exitPrice: numOrNull(exitPrice),
          lotSize: numOrNull(lotSize),
          emotionTag: emotionTag || null,
          mistakeTag: mistakeTag || null,
          notes: notes.trim() || null,
        }),
      })
      const payload = await res.json()
      if (!res.ok || !payload.success) throw new Error(payload.error ?? 'Failed to save trade')

      onCreated({
        id: payload.data.id,
        symbol: payload.data.symbol,
        type: payload.data.side,
        result: payload.data.result,
        profit: payload.data.profit,
        date: new Date(payload.data.createdAt).toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        }),
        createdAt: payload.data.createdAt,
        entryPrice: payload.data.entryPrice,
        stopLoss: payload.data.stopLoss,
        takeProfit: payload.data.takeProfit,
        exitPrice: payload.data.exitPrice,
        lotSize: payload.data.lotSize,
        commission: payload.data.commission,
        swap: payload.data.swap,
        checklist: payload.data.checklist ?? null,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save trade')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-bg-border bg-bg-card glass-card p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono font-bold text-ink-primary uppercase tracking-widest">Manual Record</h3>
          <button type="button" onClick={onClose} className="text-ink-dim hover:text-ink-primary text-xs">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol">
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="SPX500" className="qt-input" required />
          </Field>
          <Field label="Side">
            <select value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')} className="qt-input">
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </Field>
          <Field label="Result">
            <select value={result} onChange={(e) => setResult(e.target.value as any)} className="qt-input">
              <option value="OPEN">OPEN</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
            </select>
          </Field>
          <Field label="P/L ($)">
            <input value={profit} onChange={(e) => setProfit(e.target.value)} type="number" step="any" placeholder="0" className="qt-input" />
          </Field>
          <Field label="Entry price">
            <input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} type="number" step="any" className="qt-input" />
          </Field>
          <Field label="Exit price">
            <input value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} type="number" step="any" className="qt-input" />
          </Field>
          <Field label="Stop loss">
            <input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} type="number" step="any" className="qt-input" />
          </Field>
          <Field label="Take profit">
            <input value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} type="number" step="any" className="qt-input" />
          </Field>
          <Field label="Lot / contracts">
            <input value={lotSize} onChange={(e) => setLotSize(e.target.value)} type="number" step="any" className="qt-input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Emotion">
            <select value={emotionTag} onChange={(e) => setEmotionTag(e.target.value)} className="qt-input">
              <option value="">—</option>
              {EMOTION_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </Field>
          <Field label="Mistake">
            <select value={mistakeTag} onChange={(e) => setMistakeTag(e.target.value)} className="qt-input">
              <option value="">—</option>
              {MISTAKE_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notes — setup, context, reasoning">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="qt-input" />
        </Field>

        {error && <p className="text-[10px] font-mono text-bear">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[10px] font-mono text-ink-muted uppercase hover:text-ink-primary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-oracle/10 text-oracle border border-oracle/30 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-oracle/20 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save record'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">{label}</span>
      {children}
    </label>
  )
}
