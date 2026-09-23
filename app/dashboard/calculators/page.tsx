'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'

type InstrumentType = 'futures' | 'stocks' | 'forex' | 'crypto'

const TYPES: { id: InstrumentType; label: string; unit: string }[] = [
  { id: 'futures', label: 'Futuros / Índices', unit: 'contratos' },
  { id: 'stocks', label: 'Acciones', unit: 'acciones' },
  { id: 'forex', label: 'Forex', unit: 'lotes' },
  { id: 'crypto', label: 'Cripto', unit: 'unidades' },
]

// $ per 1.0 price move per contract — defaults only, always editable (specs vary by broker)
const FUTURES_PRESETS: { id: string; symbol: string; pointValue: number }[] = [
  { id: 'ES', symbol: 'SPX500', pointValue: 50 },
  { id: 'MES', symbol: 'SPX500', pointValue: 5 },
  { id: 'NQ', symbol: 'NAS100', pointValue: 20 },
  { id: 'MNQ', symbol: 'NAS100', pointValue: 2 },
  { id: 'YM', symbol: 'US30', pointValue: 5 },
  { id: 'GC', symbol: 'XAUUSD', pointValue: 100 },
]

const num = (v: string) => {
  const n = Number.parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
const money = (v: number) => Math.round(v).toLocaleString('en-US')

const inputCls =
  'h-11 w-full rounded-lg border border-bg-border bg-bg-card px-3 font-mono text-[15px] text-ink-primary tabular-nums focus:outline-none focus:border-pulse'

function Field({ label, tone, hint, children }: { label: string; tone?: 'up' | 'down'; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={clsx('text-xs font-sans', tone === 'up' ? 'text-atlas' : tone === 'down' ? 'text-bear' : 'text-ink-secondary')}>{label}</span>
      {children}
      {hint && <span className="text-[11px] font-sans text-ink-muted">{hint}</span>}
    </label>
  )
}

export default function CalculatorsPage() {
  const [type, setType] = useState<InstrumentType>('futures')
  const [account, setAccount] = useState('10000')
  const [risk, setRisk] = useState(1)
  const [preset, setPreset] = useState('MNQ')
  const [symbol, setSymbol] = useState('NAS100')
  const [entry, setEntry] = useState('27240')
  const [stop, setStop] = useState('27180')
  const [target, setTarget] = useState('27360')
  const [pointValue, setPointValue] = useState('2')
  const [pipSize, setPipSize] = useState('0.0001')
  const [pipValue, setPipValue] = useState('10')
  const [copied, setCopied] = useState(false)

  const typeMeta = TYPES.find((t) => t.id === type)!

  const choosePreset = (id: string) => {
    const p = FUTURES_PRESETS.find((x) => x.id === id)
    setPreset(id)
    if (p) {
      setPointValue(String(p.pointValue))
      setSymbol(p.symbol)
    }
  }

  const calc = useMemo(() => {
    const acct = num(account) ?? 0
    const E = num(entry)
    const S = num(stop)
    const T = num(target)
    const riskUsd = (acct * risk) / 100
    // $ per 1.0 price move per unit of size
    const multiplier =
      type === 'futures' ? num(pointValue) ?? 0
      : type === 'forex' ? (num(pipValue) ?? 0) / (num(pipSize) || 1)
      : 1
    if (E == null || S == null || E === S || multiplier <= 0) {
      return { riskUsd, size: null as number | null, loss: 0, gain: null as number | null, rr: null as number | null, wrongSide: false, E, S, T, raw: 0 }
    }
    const dist = Math.abs(E - S)
    const raw = riskUsd / (dist * multiplier)
    const size =
      type === 'stocks' ? Math.floor(raw)
      : type === 'futures' ? Math.floor(raw)
      : type === 'forex' ? Math.floor(raw * 100) / 100
      : Math.floor(raw * 10000) / 10000
    const loss = size * dist * multiplier
    const isLong = T != null ? T > E : E > S
    const wrongSide = T != null && (isLong ? !(S < E && T > E) : !(S > E && T < E))
    const gain = T != null ? size * Math.abs(T - E) * multiplier : null
    const rr = T != null ? Math.abs(T - E) / dist : null
    return { riskUsd, size, loss, gain, rr, wrongSide, E, S, T, raw }
  }, [account, entry, stop, target, risk, type, pointValue, pipValue, pipSize])

  const sizeLabel =
    calc.size == null ? '—'
    : type === 'forex' ? calc.size.toFixed(2)
    : type === 'crypto' ? calc.size.toFixed(4)
    : calc.size.toLocaleString('en-US')

  const message = (() => {
    if (calc.wrongSide) return { text: 'Stop y objetivo no están a lados opuestos de la entrada.', tone: 'text-bear' }
    if (type === 'futures' && calc.size === 0 && calc.raw > 0)
      return { text: `El riesgo alcanza para ${calc.raw.toFixed(2)} contratos. Usa un micro contrato o amplía tu riesgo.`, tone: 'text-pulse' }
    if (risk > 2) return { text: `Arriesgar ${risk}% es agresivo: 10 pérdidas seguidas = −${(100 - 100 * Math.pow(1 - risk / 100, 10)).toFixed(0)}% de la cuenta.`, tone: 'text-pulse' }
    if (calc.rr != null && calc.rr < 1) return { text: 'Tu objetivo está más cerca que tu stop: necesitas acertar más de la mitad de las veces.', tone: 'text-pulse' }
    return { text: 'Dentro de parámetros sanos.', tone: 'text-ink-secondary' }
  })()

  // Price ladder geometry (percent of height)
  const ladder = useMemo(() => {
    const { E, S, T } = calc
    if (E == null || S == null) return null
    const vals = [E, S, T ?? E]
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const span = hi - lo || 1
    const y = (v: number) => 8 + (1 - (v - lo) / span) * 84
    return { e: y(E), s: y(S), t: T != null ? y(T) : null }
  }, [calc])

  const tradeHref = (() => {
    const params = new URLSearchParams()
    if (symbol) params.set('symbol', symbol.toUpperCase())
    if (calc.E != null) params.set('entry', String(calc.E))
    if (calc.S != null) params.set('sl', String(calc.S))
    if (calc.T != null) params.set('tp', String(calc.T))
    if (calc.size != null) params.set('lot', String(calc.size))
    if (calc.E != null && calc.S != null) params.set('side', (calc.T != null ? calc.T > calc.E : calc.E > calc.S) ? 'BUY' : 'SELL')
    return `/dashboard/tools?${params.toString()}`
  })()

  const copy = async () => {
    const text = `${symbol} · ${sizeLabel} ${typeMeta.unit} · entrada ${entry} · stop ${stop}${target ? ` · objetivo ${target}` : ''} · riesgo $${money(calc.loss)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="animate-fade-in pb-20 max-w-[1280px]">
      <div className="rounded-xl border border-bg-border bg-bg-base px-6 md:px-10 py-9 grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)_200px] gap-9">
        {/* Inputs */}
        <section className="flex flex-col gap-4">
          <div className="space-y-2 pb-1.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-pulse">Calculadora · Tamaño de posición</p>
            <h1 className="text-3xl font-sans font-semibold tracking-tight text-ink-primary">¿Cuánto opero?</h1>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de instrumento">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                aria-pressed={type === t.id}
                className={clsx(
                  'text-xs font-sans px-3 py-1.5 rounded-md border transition-colors',
                  type === t.id ? 'border-pulse text-pulse bg-pulse/10' : 'border-bg-border text-ink-primary/80 hover:border-ink-muted',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Capital de la cuenta ($)">
              <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Activo">
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)} className={clsx(inputCls, 'uppercase')} />
            </Field>
          </div>

          <label className="flex flex-col gap-2">
            <span className="flex justify-between">
              <span className="text-xs font-sans text-ink-secondary">Riesgo por operación</span>
              <span className={clsx('text-[13px] font-mono tabular-nums', risk > 2 ? 'text-bear' : risk > 1 ? 'text-pulse' : 'text-atlas')}>
                {risk}% · ${money(calc.riskUsd)}
              </span>
            </span>
            <input type="range" min={0.25} max={3} step={0.25} value={risk} onChange={(e) => setRisk(Number(e.target.value))} className="w-full accent-pulse" />
            <span className="flex justify-between text-[10px] font-sans text-ink-muted">
              <span>0.25%</span><span>1% recomendado</span><span>3%</span>
            </span>
          </label>

          {type === 'futures' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Contrato">
              {FUTURES_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choosePreset(p.id)}
                  aria-pressed={preset === p.id}
                  className={clsx(
                    'text-[11px] font-mono px-2.5 py-1.5 rounded-md border transition-colors',
                    preset === p.id ? 'border-pulse text-pulse bg-pulse/10' : 'border-bg-border text-ink-primary/80 hover:border-ink-muted',
                  )}
                >
                  {p.id} · ${p.pointValue}/pt
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrada"><input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
            <Field label="Stop" tone="down"><input value={stop} onChange={(e) => setStop(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
            <Field label="Objetivo (opcional)" tone="up"><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
            {type === 'futures' && (
              <Field label="$ por punto / contrato">
                <input value={pointValue} onChange={(e) => { setPointValue(e.target.value); setPreset('') }} inputMode="decimal" className={inputCls} />
              </Field>
            )}
            {type === 'forex' && (
              <>
                <Field label="Valor del pip / lote ($)"><input value={pipValue} onChange={(e) => setPipValue(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
                <Field label="Tamaño del pip" hint="0.0001 · JPY: 0.01"><input value={pipSize} onChange={(e) => setPipSize(e.target.value)} inputMode="decimal" className={inputCls} /></Field>
              </>
            )}
          </div>
          <p className="text-[11px] font-sans leading-relaxed text-ink-muted">
            Los valores por punto son referencias; confírmalos en la especificación de tu broker.
          </p>
        </section>

        {/* Result */}
        <section className="flex flex-col justify-center gap-[18px]" aria-live="polite">
          <div className="space-y-1.5">
            <p className="text-sm font-sans text-ink-secondary">Tamaño de posición</p>
            <p className="flex items-baseline gap-3">
              <span className="text-6xl md:text-[88px] font-mono leading-none tracking-tighter text-pulse tabular-nums">{sizeLabel}</span>
              <span className="text-xl font-sans text-ink-secondary">{typeMeta.unit}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl border border-bg-border overflow-hidden">
            <div className="px-[18px] py-4 sm:border-r border-bg-border space-y-1">
              <p className="text-xs font-sans text-ink-secondary">Pérdida si toca stop</p>
              <p className="text-[22px] font-mono text-bear tabular-nums">−${money(calc.loss)}</p>
            </div>
            <div className="px-[18px] py-4 sm:border-r border-bg-border space-y-1">
              <p className="text-xs font-sans text-ink-secondary">Ganancia en objetivo</p>
              <p className="text-[22px] font-mono text-atlas tabular-nums">{calc.gain != null ? `+$${money(calc.gain)}` : '—'}</p>
            </div>
            <div className="px-[18px] py-4 space-y-1">
              <p className="text-xs font-sans text-ink-secondary">Relación R:R</p>
              <p className={clsx('text-[22px] font-mono tabular-nums', calc.rr == null ? 'text-ink-secondary' : calc.rr >= 2 ? 'text-atlas' : calc.rr >= 1 ? 'text-pulse' : 'text-bear')}>
                {calc.rr != null ? `1 : ${calc.rr.toFixed(2)}` : '—'}
              </p>
            </div>
          </div>
          <p className={clsx('text-[13px] font-sans', message.tone)}>{message.text}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={tradeHref}
              aria-disabled={calc.size == null || calc.wrongSide}
              className={clsx(
                'text-sm font-sans font-semibold text-bg-deep bg-pulse px-[18px] py-3 rounded-[10px] hover:bg-pulse/90 transition-colors',
                (calc.size == null || calc.wrongSide) && 'pointer-events-none opacity-40',
              )}
            >
              Registrar en Trade Audit →
            </Link>
            <button type="button" onClick={copy} className="text-sm font-sans text-ink-primary border border-bg-border px-[18px] py-3 rounded-[10px] hover:border-ink-muted">
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </section>

        {/* Price ladder */}
        <div className="hidden xl:block relative min-h-[440px] border-l border-bg-border" aria-hidden>
          {ladder && (
            <>
              {ladder.t != null && (
                <>
                  <div className="absolute left-0 w-2 rounded-sm bg-atlas/40" style={{ top: `${Math.min(ladder.t, ladder.e)}%`, height: `${Math.abs(ladder.t - ladder.e)}%` }} />
                  <div className="absolute left-[18px] right-0 -translate-y-1/2 space-y-0.5" style={{ top: `${ladder.t}%` }}>
                    <div className="h-0.5 bg-atlas" />
                    <p className="text-[11px] font-mono text-atlas">OBJ {target}</p>
                  </div>
                </>
              )}
              <div className="absolute left-0 w-2 rounded-sm bg-bear/40" style={{ top: `${Math.min(ladder.s, ladder.e)}%`, height: `${Math.abs(ladder.s - ladder.e)}%` }} />
              <div className="absolute left-[18px] right-0 -translate-y-1/2 space-y-0.5" style={{ top: `${ladder.e}%` }}>
                <div className="h-0.5 bg-ink-primary" />
                <p className="text-[11px] font-mono text-ink-primary">ENTRADA {entry}</p>
              </div>
              <div className="absolute left-[18px] right-0 -translate-y-1/2 space-y-0.5" style={{ top: `${ladder.s}%` }}>
                <div className="h-0.5 bg-bear" />
                <p className="text-[11px] font-mono text-bear">STOP {stop}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
