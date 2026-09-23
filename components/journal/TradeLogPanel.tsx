'use client'

import { useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import type { Trade } from '@/components/tools/TradeJournal'
import { VoiceConsole } from '@/components/tools/VoiceConsole'

type Side = 'BUY' | 'SELL'
type Outcome = 'OPEN' | 'WIN' | 'LOSS'

const PRE_ITEMS = [
  { key: 'preStructure', label: 'Estructura validada' },
  { key: 'preZone', label: 'Zona confirmada' },
  { key: 'preTiming', label: 'Timing de sesión' },
  { key: 'preRisk', label: 'Riesgo definido' },
] as const
type PreKey = (typeof PRE_ITEMS)[number]['key']

const EMOTIONS = ['Tranquilo', 'Confiado', 'Ansioso', 'FOMO', 'Frustrado']
const MISTAKES = ['Sin error', 'Entrada sin confirmación', 'Moví el stop', 'Sobreoperé', 'Contra tendencia']
const STEPS = ['1 · Plan', '2 · Datos', '3 · Emoción']

const num = (v: string) => {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const inputCls =
  'h-[42px] w-full rounded-lg border border-bg-border bg-bg-base px-3 font-mono text-sm text-ink-primary focus:outline-none focus:border-pulse'

function Field({ label, tone, children }: { label: string; tone?: 'up' | 'down'; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={clsx('text-[11px] font-sans', tone === 'up' ? 'text-atlas' : tone === 'down' ? 'text-bear' : 'text-ink-secondary')}>{label}</span>
      {children}
    </label>
  )
}

export function TradeLogPanel({ onCreated }: { onCreated: (trade: Trade) => void }) {
  const [step, setStep] = useState(1)
  const [voiceMode, setVoiceMode] = useState(false)
  const [pre, setPre] = useState<Record<PreKey, boolean>>({ preStructure: false, preZone: false, preTiming: false, preRisk: false })
  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState<Side>('BUY')
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [lot, setLot] = useState('')
  const [outcome, setOutcome] = useState<Outcome>('OPEN')
  const [profit, setProfit] = useState('')
  const [emotion, setEmotion] = useState<string | null>(null)
  const [mistake, setMistake] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefill from the calculator: /dashboard/tools?symbol=NAS100&entry=..&sl=..&tp=..&lot=..&side=BUY
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (!q.get('symbol') && !q.get('entry')) return
    if (q.get('symbol')) setSymbol(q.get('symbol')!.toUpperCase())
    if (q.get('entry')) setEntry(q.get('entry')!)
    if (q.get('sl')) setStop(q.get('sl')!)
    if (q.get('tp')) setTarget(q.get('tp')!)
    if (q.get('lot')) setLot(q.get('lot')!)
    if (q.get('side') === 'SELL' || q.get('side') === 'BUY') setSide(q.get('side') as Side)
    setStep(1)
  }, [])

  const calc = useMemo(() => {
    const e = num(entry)
    const s = num(stop)
    const t = num(target)
    if (e == null || s == null || t == null || e === s) return null
    const risk = Math.abs(e - s)
    const reward = Math.abs(t - e)
    const wrongSide = side === 'BUY' ? !(s < e && t > e) : !(s > e && t < e)
    return { risk, rr: reward / risk, wrongSide }
  }, [entry, stop, target, side])

  const canSave = symbol.trim().length > 0 && !calc?.wrongSide && (outcome === 'OPEN' || num(profit) != null)

  const reset = () => {
    setStep(1)
    setPre({ preStructure: false, preZone: false, preTiming: false, preRisk: false })
    setSymbol('')
    setEntry('')
    setStop('')
    setTarget('')
    setLot('')
    setOutcome('OPEN')
    setProfit('')
    setEmotion(null)
    setMistake(null)
    setNotes('')
  }

  const save = async () => {
    if (!canSave) {
      setError(calc?.wrongSide ? `Stop y objetivo no cuadran con ${side}.` : 'Completa activo y resultado.')
      setStep(2)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const rawProfit = num(profit) ?? 0
      const signedProfit = outcome === 'LOSS' ? -Math.abs(rawProfit) : outcome === 'WIN' ? Math.abs(rawProfit) : 0
      const res = await fetch('/api/journal/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          side,
          result: outcome,
          profit: signedProfit,
          entryPrice: num(entry),
          stopLoss: num(stop),
          takeProfit: num(target),
          lotSize: num(lot),
          closedAt: outcome === 'OPEN' ? null : new Date().toISOString(),
          emotionTag: emotion,
          mistakeTag: mistake && mistake !== 'Sin error' ? mistake : null,
          notes: notes || null,
        }),
      })
      const payload = await res.json()
      if (!res.ok || !payload?.success) throw new Error(payload?.error ?? 'No se pudo guardar')
      const created = payload.data

      let checklist = created.checklist ?? null
      if (Object.values(pre).some(Boolean)) {
        await fetch('/api/journal/checklist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tradeId: created.id,
            ...pre,
            postPlanFollowed: false,
            postExecutionQuality: false,
            postEmotionStable: false,
            postLessonLogged: false,
            notes: notes || null,
          }),
        }).catch(() => {})
        if (checklist) checklist = { ...checklist, ...pre }
      }

      onCreated({
        id: created.id,
        symbol: created.symbol,
        type: created.side,
        result: created.result,
        profit: created.profit,
        date: new Date(created.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        createdAt: created.createdAt,
        entryPrice: created.entryPrice,
        stopLoss: created.stopLoss,
        takeProfit: created.takeProfit,
        exitPrice: created.exitPrice,
        lotSize: created.lotSize,
        commission: created.commission,
        swap: created.swap,
        checklist,
      })
      reset()
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar la operación')
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="bg-bg-card px-[26px] py-[26px] flex flex-col gap-5 min-h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-sans font-medium text-ink-primary">Registrar operación</h2>
        <button
          type="button"
          onClick={() => setVoiceMode((v) => !v)}
          aria-pressed={voiceMode}
          aria-label="Dictar por voz"
          className={clsx(
            'w-9 h-9 rounded-full border flex items-center justify-center transition-colors',
            voiceMode ? 'border-pulse bg-pulse/15 text-pulse' : 'border-bg-border bg-bg-base text-ink-secondary hover:text-ink-primary',
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      </div>

      {voiceMode ? (
        <VoiceConsole
          onTradeParsed={(t) => {
            onCreated({ ...t, createdAt: new Date().toISOString() })
            setVoiceMode(false)
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {STEPS.map((label, i) => (
              <button key={label} type="button" onClick={() => setStep(i + 1)} className="flex flex-col gap-1.5 text-left">
                <span className={clsx('h-[3px] rounded-full', i + 1 <= step ? 'bg-pulse' : 'bg-bg-border')} />
                <span className={clsx('text-[11px] font-sans', i + 1 === step ? 'text-ink-primary' : 'text-ink-secondary')}>{label}</span>
              </button>
            ))}
          </div>

          {step === 1 && (
            <div className="flex flex-col gap-3.5">
              <p className="text-[13px] font-sans text-ink-secondary">Antes de entrar, confirma tu plan:</p>
              {PRE_ITEMS.map((item) => {
                const on = pre[item.key]
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPre((p) => ({ ...p, [item.key]: !p[item.key] }))}
                    aria-pressed={on}
                    className={clsx(
                      'flex items-center gap-3 px-3.5 py-3 rounded-lg border text-left transition-colors',
                      on ? 'border-pulse bg-pulse/[0.08]' : 'border-bg-border hover:border-ink-muted',
                    )}
                  >
                    <span
                      className={clsx(
                        'w-4 h-4 rounded border-[1.5px] flex items-center justify-center text-[11px] font-bold text-bg-deep',
                        on ? 'border-pulse bg-pulse' : 'border-bg-border',
                      )}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <span className="text-sm font-sans text-ink-primary">{item.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Activo">
                  <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="NAS100" className={clsx(inputCls, 'font-semibold uppercase')} />
                </Field>
              </div>
              <div className="col-span-2 grid grid-cols-2 h-[42px] rounded-lg border border-bg-border overflow-hidden font-mono text-[13px] font-semibold">
                {(['BUY', 'SELL'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    aria-pressed={side === s}
                    className={clsx(
                      'transition-colors',
                      side === s ? (s === 'BUY' ? 'bg-atlas/20 text-atlas' : 'bg-bear/20 text-bear') : 'text-ink-secondary hover:text-ink-primary',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Field label="Entrada"><input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Lote"><input value={lot} onChange={(e) => setLot(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Stop" tone="down"><input value={stop} onChange={(e) => setStop(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <Field label="Objetivo" tone="up"><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              <div className="col-span-2 flex justify-between px-3.5 py-3 rounded-lg bg-bg-base font-mono text-xs text-ink-secondary">
                <span>
                  R:R{' '}
                  <span className={clsx(!calc ? 'text-ink-secondary' : calc.wrongSide ? 'text-bear' : calc.rr >= 2 ? 'text-atlas' : calc.rr >= 1 ? 'text-pulse' : 'text-bear')}>
                    {calc ? (calc.wrongSide ? 'no cuadra' : `1 : ${calc.rr.toFixed(2)}`) : '—'}
                  </span>
                </span>
                <span>Riesgo {calc ? calc.risk.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'} pts</span>
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <span className="text-[11px] font-sans text-ink-secondary">Resultado</span>
                <div className="grid grid-cols-3 h-[42px] rounded-lg border border-bg-border overflow-hidden text-[13px] font-sans">
                  {([['OPEN', 'Abierta'], ['WIN', 'Ganada'], ['LOSS', 'Perdida']] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setOutcome(id)}
                      aria-pressed={outcome === id}
                      className={clsx(
                        'transition-colors',
                        outcome === id
                          ? id === 'WIN' ? 'bg-atlas/20 text-atlas' : id === 'LOSS' ? 'bg-bear/20 text-bear' : 'bg-bg-border text-ink-primary'
                          : 'text-ink-secondary hover:text-ink-primary',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {outcome !== 'OPEN' && (
                <div className="col-span-2">
                  <Field label="P/L en $" tone={outcome === 'WIN' ? 'up' : 'down'}>
                    <input value={profit} onChange={(e) => setProfit(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} />
                  </Field>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3.5">
              <p className="text-[13px] font-sans text-ink-secondary">¿Cómo te sentías?</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmotion((cur) => (cur === e ? null : e))}
                    aria-pressed={emotion === e}
                    className={clsx(
                      'text-[13px] font-sans px-3 py-1.5 rounded-full border transition-colors',
                      emotion === e ? 'border-pulse text-pulse bg-pulse/10' : 'border-bg-border text-ink-primary/80 hover:border-ink-muted',
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <p className="text-[13px] font-sans text-ink-secondary">¿Algún error?</p>
              <div className="flex flex-wrap gap-1.5">
                {MISTAKES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMistake((cur) => (cur === m ? null : m))}
                    aria-pressed={mistake === m}
                    className={clsx(
                      'text-xs font-sans px-2.5 py-1.5 rounded-full border transition-colors',
                      mistake === m ? 'border-bear text-bear bg-bear/10' : 'border-bg-border text-ink-primary/80 hover:border-ink-muted',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <Field label="Nota rápida">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Qué viste, por qué entraste…"
                  className="w-full rounded-lg border border-bg-border bg-bg-base px-3.5 py-3 font-sans text-[13px] text-ink-primary focus:outline-none focus:border-pulse resize-none"
                />
              </Field>
            </div>
          )}

          {error && <p className="text-xs font-sans text-bear">{error}</p>}

          <div className="flex gap-2 mt-auto">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-4 py-3 rounded-lg border border-bg-border text-[13px] font-sans text-ink-secondary hover:text-ink-primary disabled:opacity-40"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={() => (step < 3 ? setStep(step + 1) : save())}
              disabled={saving}
              className="flex-1 py-3 rounded-lg bg-pulse text-bg-deep text-sm font-sans font-semibold hover:bg-pulse/90 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Guardando…' : step < 3 ? 'Siguiente' : 'Guardar operación'}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
