'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { OrderBookHeatmap, type OrderBookSnapshot } from '@/components/orderflow/OrderBookHeatmap'
import { TradeTape, type TradeTapeSnapshot } from '@/components/orderflow/TradeTape'
import { LiquidationsFeed, type LiquidationsSnapshot } from '@/components/orderflow/LiquidationsFeed'
import { DerivativesPanel, type DerivativesSnapshot } from '@/components/orderflow/DerivativesPanel'

const SYMBOLS = [
  { label: 'BTC/USDT', value: 'btcusdt' },
  { label: 'ETH/USDT', value: 'ethusdt' },
]

const BRIEF_REFRESH_MS = 60_000
const BRIEF_FIRST_RUN_DELAY_MS = 8_000

const BACKTEST_HORIZONS = [5, 15, 60]

interface BacktestStats {
  symbol: string
  horizonMinutes: number
  totalRecords: number
  gradedRecords: number
  hitRatePct: number | null
  avgReturnPctWhenBullish: number | null
  avgReturnPctWhenBearish: number | null
  bullishCount: number
  bearishCount: number
  neutralCount: number
}

export default function OrderFlowPage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0].value)

  const [book, setBook] = useState<OrderBookSnapshot | null>(null)
  const [tape, setTape] = useState<TradeTapeSnapshot | null>(null)
  const [liquidations, setLiquidations] = useState<LiquidationsSnapshot | null>(null)
  const [derivatives, setDerivatives] = useState<DerivativesSnapshot | null>(null)

  const [brief, setBrief] = useState<string | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [lastBriefAt, setLastBriefAt] = useState<Date | null>(null)

  const [backtestHorizon, setBacktestHorizon] = useState(15)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [backtestError, setBacktestError] = useState<string | null>(null)
  const [backtestStats, setBacktestStats] = useState<BacktestStats | null>(null)
  const [backtestNarrative, setBacktestNarrative] = useState<string | null>(null)

  // Snapshots arrive via throttled callbacks from each live component. The
  // brief refresh runs on its own interval, so it reads the latest values
  // through a ref instead of depending on state (which would mean tearing
  // the interval down and rebuilding it on every single tick).
  const latestRef = useRef({ symbol, book, tape, liquidations, derivatives })
  useEffect(() => {
    latestRef.current = { symbol, book, tape, liquidations, derivatives }
  }, [symbol, book, tape, liquidations, derivatives])

  const generateBrief = useCallback(async () => {
    const current = latestRef.current
    if (!current.book && !current.tape && !current.liquidations && !current.derivatives) return

    setBriefLoading(true)
    try {
      const response = await fetch('/api/oracle/orderflow-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: current.symbol.toUpperCase(),
          book: current.book,
          tape: current.tape,
          liquidations: current.liquidations,
          derivatives: current.derivatives,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setBrief(result.data.brief)
        setBriefError(null)
      } else {
        setBriefError(result.error ?? 'No se pudo generar el brief.')
      }
    } catch {
      setBriefError('Error de conexión al generar el brief.')
    } finally {
      setBriefLoading(false)
      setLastBriefAt(new Date())
    }
  }, [])

  const runBacktest = useCallback(async () => {
    setBacktestLoading(true)
    setBacktestError(null)
    try {
      const response = await fetch(
        `/api/oracle/orderflow-backtest?symbol=${latestRef.current.symbol.toUpperCase()}&horizonMinutes=${backtestHorizon}`,
      )
      const result = await response.json()
      if (result.success) {
        setBacktestStats(result.data.stats)
        setBacktestNarrative(result.data.narrative ?? result.data.narrativeError ?? null)
      } else {
        setBacktestStats(null)
        setBacktestNarrative(null)
        setBacktestError(result.error ?? 'No se pudo correr el backtest.')
      }
    } catch {
      setBacktestStats(null)
      setBacktestNarrative(null)
      setBacktestError('Error de conexión al correr el backtest.')
    } finally {
      setBacktestLoading(false)
    }
  }, [backtestHorizon])

  // Symbol-specific snapshots (and the brief itself) reset on symbol switch.
  // Liquidations stay — that feed already covers BTC+ETH globally.
  useEffect(() => {
    setBook(null)
    setTape(null)
    setDerivatives(null)
    setBrief(null)
    setBriefError(null)
    setBacktestStats(null)
    setBacktestNarrative(null)
    setBacktestError(null)
  }, [symbol])

  // Auto-refresh while the page is open. This is a live analysis of what's
  // on screen right now, not a persistent background agent — Order Flow's
  // data lives in the browser's WebSocket connections, so the brief runs
  // only while someone is actually watching this page.
  useEffect(() => {
    const initial = setTimeout(generateBrief, BRIEF_FIRST_RUN_DELAY_MS)
    const interval = setInterval(generateBrief, BRIEF_REFRESH_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [generateBrief])

  const briefMissingKey = briefError?.includes('ANTHROPIC_API_KEY')

  return (
    <div className="animate-fade-in pb-20 max-w-[1040px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-baseline gap-3.5 flex-wrap px-7 py-[18px] border-b border-bg-border">
          <h1 className="text-[22px] font-sans font-medium text-ink-primary">Order Flow</h1>
          <span className="text-xs font-mono text-ink-secondary">Profundidad de mercado en vivo · Binance</span>
        </div>
        <div className="flex gap-2 px-7 py-4">
          {SYMBOLS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSymbol(s.value)}
              className={clsx(
                'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
                symbol === s.value
                  ? 'border-oracle/50 bg-oracle/10 text-oracle'
                  : 'border-bg-border text-ink-secondary hover:border-ink-muted',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border">
          <span className="text-xs font-mono uppercase tracking-[0.12em] text-oracle">Brief de IA · MANDO</span>
          <div className="flex items-center gap-3">
            {lastBriefAt && (
              <span className="text-[10px] font-mono text-ink-dim">
                Actualizado {lastBriefAt.toLocaleTimeString('es-ES', { hour12: false, timeZone: 'UTC' })} UTC
              </span>
            )}
            <button
              type="button"
              onClick={generateBrief}
              disabled={briefLoading}
              className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border border-bg-border text-ink-secondary hover:border-ink-muted transition-colors disabled:opacity-50"
            >
              {briefLoading ? 'Analizando…' : 'Actualizar'}
            </button>
          </div>
        </div>
        <div className="px-5 py-4">
          {briefLoading && !brief && <p className="text-xs font-sans text-ink-secondary">Analizando order flow…</p>}
          {brief && <p className="text-sm font-sans leading-relaxed text-ink-primary whitespace-pre-wrap">{brief}</p>}
          {!briefLoading && !brief && (
            <p className="text-xs font-sans text-ink-dim">
              {briefMissingKey
                ? 'Desactivado — falta la clave de Anthropic (ANTHROPIC_API_KEY).'
                : (briefError ?? 'Esperando suficientes datos en vivo para el primer análisis…')}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-bg-border flex-wrap gap-2">
          <span className="text-xs font-mono uppercase tracking-[0.12em] text-oracle">Backtest de sesgo</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {BACKTEST_HORIZONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setBacktestHorizon(h)}
                  className={clsx(
                    'px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors',
                    backtestHorizon === h
                      ? 'border-oracle/50 bg-oracle/10 text-oracle'
                      : 'border-bg-border text-ink-secondary hover:border-ink-muted',
                  )}
                >
                  {h}min
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={runBacktest}
              disabled={backtestLoading}
              className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border border-bg-border text-ink-secondary hover:border-ink-muted transition-colors disabled:opacity-50"
            >
              {backtestLoading ? 'Analizando…' : 'Ver backtest'}
            </button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {!backtestLoading && !backtestStats && !backtestError && (
            <p className="text-xs font-sans text-ink-dim">
              Corre un backtest sobre los briefs guardados: compara el sesgo compuesto de cada brief pasado
              (CVD + libro + liquidaciones + funding) contra lo que el precio hizo realmente después.
            </p>
          )}
          {backtestLoading && <p className="text-xs font-sans text-ink-secondary">Evaluando historial…</p>}
          {backtestError && <p className="text-xs font-sans text-bear">{backtestError}</p>}

          {backtestStats && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">
                    Tasa de acierto
                  </p>
                  <p className="text-lg font-mono tabular-nums text-ink-primary">
                    {backtestStats.hitRatePct !== null ? `${backtestStats.hitRatePct.toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-[10px] font-mono text-ink-dim mt-1">{backtestStats.gradedRecords} casos</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">
                    Retorno prom. alcista
                  </p>
                  <p
                    className={clsx(
                      'text-lg font-mono tabular-nums',
                      backtestStats.avgReturnPctWhenBullish === null
                        ? 'text-ink-dim'
                        : backtestStats.avgReturnPctWhenBullish >= 0
                          ? 'text-atlas'
                          : 'text-bear',
                    )}
                  >
                    {backtestStats.avgReturnPctWhenBullish !== null
                      ? `${backtestStats.avgReturnPctWhenBullish.toFixed(3)}%`
                      : '—'}
                  </p>
                  <p className="text-[10px] font-mono text-ink-dim mt-1">{backtestStats.bullishCount} casos</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">
                    Retorno prom. bajista
                  </p>
                  <p
                    className={clsx(
                      'text-lg font-mono tabular-nums',
                      backtestStats.avgReturnPctWhenBearish === null
                        ? 'text-ink-dim'
                        : backtestStats.avgReturnPctWhenBearish <= 0
                          ? 'text-atlas'
                          : 'text-bear',
                    )}
                  >
                    {backtestStats.avgReturnPctWhenBearish !== null
                      ? `${backtestStats.avgReturnPctWhenBearish.toFixed(3)}%`
                      : '—'}
                  </p>
                  <p className="text-[10px] font-mono text-ink-dim mt-1">{backtestStats.bearishCount} casos</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">
                    Registros totales
                  </p>
                  <p className="text-lg font-mono tabular-nums text-ink-primary">{backtestStats.totalRecords}</p>
                  <p className="text-[10px] font-mono text-ink-dim mt-1">{backtestStats.neutralCount} neutrales</p>
                </div>
              </div>
              {backtestNarrative && (
                <p className="text-sm font-sans leading-relaxed text-ink-primary whitespace-pre-wrap border-t border-bg-border pt-3">
                  {backtestNarrative}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <OrderBookHeatmap symbol={symbol} levels={10} onSnapshot={setBook} />
        <TradeTape symbol={symbol} onSnapshot={setTape} />
        <DerivativesPanel symbol={symbol} onSnapshot={setDerivatives} />
      </div>

      <div className="mt-4">
        <LiquidationsFeed onSnapshot={setLiquidations} />
      </div>

      <p className="mt-4 text-xs font-sans leading-relaxed text-ink-dim">
        Libro de órdenes (top 20 niveles, cada 100ms), cinta de operaciones con CVD (delta de volumen acumulado,
        reiniciado cada vez que abres la página), funding rate + open interest de futuros (funding en vivo,
        open interest sondeado cada 30s — Binance no transmite open interest por WebSocket) y liquidaciones
        de futuros (mayores a $1,000), todo en vivo de Binance — conexión directa desde el navegador, sin
        intermediarios. El heatmap, la cinta y el panel de derivados siguen al símbolo seleccionado arriba; las
        liquidaciones muestran BTC y ETH juntos, sin importar cuál elijas. El brief de IA de arriba lee estos
        cuatro paneles y se actualiza solo cada 60s mientras tengas esta página abierta. Por ahora solo cripto:
        futuros tradicionales (oro, índices, petróleo) y forex requieren un feed de datos Level 2 de pago
        (Databento, Rithmic, CQG) que todavía no está conectado.
      </p>
    </div>
  )
}
