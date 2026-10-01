'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Tour, type TourStep } from '@/components/tour/Tour'
import { useTour } from '@/lib/tour/use-tour'
import { OptionsFlowPanel } from '@/components/options/OptionsFlowPanel'

const OPTIONS_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="options-asset-toggle"]',
    title: 'Elegí el mercado',
    description: 'Acciones usa Tradier; Cripto usa la API pública de Deribit (BTC/ETH), sin necesidad de API key. Cada uno trae su propio set de símbolos, vencimientos y convención de precios.',
  },
  {
    target: '[data-tour="options-symbol"]',
    title: 'Elegí el símbolo o la moneda',
    description: 'Para acciones, buscá cualquier ticker con opciones listadas o usá los accesos rápidos. Para cripto, elegí BTC o ETH — ahí bid/ask/último quedan denominados en la cripto, no en dólares.',
  },
  {
    target: '[data-tour="options-expirations"]',
    title: 'Vencimiento',
    description: 'La cadena completa de strikes se arma para el vencimiento que elijas acá.',
  },
  {
    target: '[data-tour="options-chain"]',
    title: 'La cadena de opciones',
    description: 'Calls a la izquierda, puts a la derecha, con bid/ask/volumen/open interest de cada lado. El strike resaltado es el más cercano al precio actual del subyacente.',
  },
  {
    target: '[data-tour="options-flow"]',
    title: 'Options Flow (solo cripto)',
    description: 'Con BTC/ETH sí tenemos operaciones individuales (Deribit es público), así que acá va más allá de la cadena: score de presión 0-100, sesgo direccional, trades grandes y los strikes donde se concentra más premium. Con acciones no se muestra — ahí solo tenemos la cadena, no el flujo trade por trade.',
  },
]

interface OptionGreeks {
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  impliedVolatility: number | null
}

interface OptionContract {
  symbol: string
  underlying: string
  expirationDate: string
  strike: number
  optionType: 'call' | 'put'
  bid: number | null
  ask: number | null
  last: number | null
  volume: number | null
  openInterest: number | null
  greeks: OptionGreeks | null
}

interface ExpirationsResponse {
  success: boolean
  error?: string
  expirations: string[]
}

interface ChainResponse {
  success: boolean
  error?: string
  contracts: OptionContract[]
  underlyingPrice: number | null
}

interface FlowLargeTrade {
  symbol: string
  optionType: 'CALL' | 'PUT'
  strike: number
  expiration: string
  dte: number
  contracts: number
  premium: number | null
  side: 'BUY' | 'SELL' | 'UNKNOWN'
  timestamp: number
  classification: { direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNKNOWN'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string }
}

interface FlowKeyStrike {
  strike: number
  callPremium: number
  putPremium: number
  netDirectionalPressure: number
  shareOfTotalPremium: number
}

interface FlowResponse {
  success: boolean
  error?: string
  currency?: 'BTC' | 'ETH'
  tradeCount?: number
  totals?: { callPremium: number; putPremium: number; netPremium: number }
  directional?: { bullishPremium: number; bearishPremium: number; neutralPremium: number; unknownPremium: number }
  score?: {
    value: number
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
    dataQuality: 'GOOD' | 'DEGRADED'
    components: Record<string, number>
  }
  acceleration?: {
    direction: 'INCREASING' | 'DECREASING' | 'FLAT'
    magnitudePct: number | null
    trackedDirection: 'BULLISH' | 'BEARISH'
    confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  largeTrades?: FlowLargeTrade[]
  keyStrikes?: FlowKeyStrike[]
}

type AssetClass = 'equity' | 'crypto'

const QUICK_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA']
const CRYPTO_CURRENCIES: { label: string; value: 'BTC' | 'ETH' }[] = [
  { label: 'BTC', value: 'BTC' },
  { label: 'ETH', value: 'ETH' },
]

function fmt(value: number | null, decimals = 2): string {
  return value === null ? '—' : value.toFixed(decimals)
}

function fmtInt(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US')
}

function fmtUsdCompact(value: number | null): string {
  if (value === null) return '—'
  return `$${value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
}

export default function OptionsPage() {
  const { active: tourActive, start: startTour, close: closeTour } = useTour('options')
  const [assetClass, setAssetClass] = useState<AssetClass>('equity')

  const [symbolInput, setSymbolInput] = useState('SPY')
  const [symbol, setSymbol] = useState('SPY')
  const [cryptoCurrency, setCryptoCurrency] = useState<'BTC' | 'ETH'>('BTC')

  const [expirations, setExpirations] = useState<string[]>([])
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [contracts, setContracts] = useState<OptionContract[]>([])
  const [underlyingPrice, setUnderlyingPrice] = useState<number | null>(null)
  const [missingKey, setMissingKey] = useState(false)
  const [loadingExpirations, setLoadingExpirations] = useState(true)
  const [loadingChain, setLoadingChain] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [flow, setFlow] = useState<FlowResponse | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)

  // Equity (Tradier) expirations.
  useEffect(() => {
    if (assetClass !== 'equity') return
    let cancelled = false
    setLoadingExpirations(true)
    setExpirations([])
    setSelectedExpiration(null)
    setContracts([])
    setError(null)

    fetch(`/api/market/options/expirations?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json() as Promise<ExpirationsResponse>)
      .then((payload) => {
        if (cancelled) return
        if (!payload.success && payload.error?.includes('TRADIER_API_TOKEN')) {
          setMissingKey(true)
          return
        }
        setMissingKey(false)
        if (payload.expirations.length === 0) {
          setError(`Sin fechas de vencimiento disponibles para ${symbol}.`)
          return
        }
        setExpirations(payload.expirations)
        setSelectedExpiration(payload.expirations[0])
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo conectar con Tradier.')
      })
      .finally(() => {
        if (!cancelled) setLoadingExpirations(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, symbol])

  // Equity (Tradier) chain.
  useEffect(() => {
    if (assetClass !== 'equity' || !selectedExpiration) return
    let cancelled = false
    setLoadingChain(true)

    fetch(`/api/market/options/chain?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(selectedExpiration)}`)
      .then((r) => r.json() as Promise<ChainResponse>)
      .then((payload) => {
        if (cancelled) return
        setContracts(payload.contracts)
        setUnderlyingPrice(payload.underlyingPrice)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la cadena de opciones.')
      })
      .finally(() => {
        if (!cancelled) setLoadingChain(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, symbol, selectedExpiration])

  // Crypto (Deribit) expirations — no API key needed, so there's no
  // "missing key" state to handle here.
  useEffect(() => {
    if (assetClass !== 'crypto') return
    let cancelled = false
    setLoadingExpirations(true)
    setExpirations([])
    setSelectedExpiration(null)
    setContracts([])
    setError(null)
    setMissingKey(false)

    fetch(`/api/market/crypto-options/expirations?currency=${cryptoCurrency}`)
      .then((r) => r.json() as Promise<ExpirationsResponse>)
      .then((payload) => {
        if (cancelled) return
        if (payload.expirations.length === 0) {
          setError(`Sin fechas de vencimiento disponibles para ${cryptoCurrency}.`)
          return
        }
        setExpirations(payload.expirations)
        setSelectedExpiration(payload.expirations[0])
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo conectar con Deribit.')
      })
      .finally(() => {
        if (!cancelled) setLoadingExpirations(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, cryptoCurrency])

  // Crypto (Deribit) options flow — independent of the chain/expiration,
  // it runs off the most recent trade prints across all expirations.
  useEffect(() => {
    if (assetClass !== 'crypto') return
    let cancelled = false
    setLoadingFlow(true)
    setFlowError(null)

    fetch(`/api/market/crypto-options/flow?currency=${cryptoCurrency}`)
      .then((r) => r.json() as Promise<FlowResponse>)
      .then((payload) => {
        if (cancelled) return
        if (!payload.success) {
          setFlowError('No se pudo calcular el flow de opciones.')
          return
        }
        setFlow(payload)
      })
      .catch(() => {
        if (!cancelled) setFlowError('No se pudo conectar con Deribit para el flow.')
      })
      .finally(() => {
        if (!cancelled) setLoadingFlow(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, cryptoCurrency])

  // Crypto (Deribit) chain.
  useEffect(() => {
    if (assetClass !== 'crypto' || !selectedExpiration) return
    let cancelled = false
    setLoadingChain(true)

    fetch(`/api/market/crypto-options/chain?currency=${cryptoCurrency}&expiration=${encodeURIComponent(selectedExpiration)}`)
      .then((r) => r.json() as Promise<ChainResponse>)
      .then((payload) => {
        if (cancelled) return
        setContracts(payload.contracts)
        setUnderlyingPrice(payload.underlyingPrice)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la cadena de opciones.')
      })
      .finally(() => {
        if (!cancelled) setLoadingChain(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, cryptoCurrency, selectedExpiration])

  const strikes = Array.from(new Set(contracts.map((c) => c.strike))).sort((a, b) => a - b)
  const byStrike = new Map<number, { call?: OptionContract; put?: OptionContract }>()
  for (const contract of contracts) {
    const entry = byStrike.get(contract.strike) ?? {}
    entry[contract.optionType] = contract
    byStrike.set(contract.strike, entry)
  }

  const atmStrike =
    underlyingPrice !== null && strikes.length > 0
      ? strikes.reduce((closest, strike) =>
          Math.abs(strike - underlyingPrice) < Math.abs(closest - underlyingPrice) ? strike : closest,
        )
      : null

  const handleSymbolSubmit = () => {
    const next = symbolInput.trim().toUpperCase()
    if (next && next !== symbol) setSymbol(next)
  }

  const priceDecimals = assetClass === 'crypto' ? 4 : 2
  const priceSuffix = assetClass === 'crypto' ? ` ${cryptoCurrency}` : ''

  return (
    <div className="animate-fade-in pb-20 max-w-[1040px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-baseline justify-between gap-3.5 flex-wrap px-7 py-[18px] border-b border-bg-border">
          <div className="flex items-baseline gap-3.5 flex-wrap">
            <h1 className="text-[22px] font-sans font-medium text-ink-primary">Options Chain</h1>
            <span className="text-xs font-mono text-ink-secondary">
              Cadena de opciones en vivo · {assetClass === 'equity' ? 'Tradier' : 'Deribit'}
            </span>
          </div>
          <button
            type="button"
            onClick={startTour}
            className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider border border-bg-border text-ink-secondary hover:border-oracle/50 hover:text-oracle transition-colors"
          >
            Ver tutorial
          </button>
        </div>

        <div data-tour="options-asset-toggle" className="flex gap-2 px-7 pt-4">
          <button
            type="button"
            onClick={() => setAssetClass('equity')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
              assetClass === 'equity'
                ? 'border-oracle/50 bg-oracle/10 text-oracle'
                : 'border-bg-border text-ink-secondary hover:border-ink-muted',
            )}
          >
            Acciones
          </button>
          <button
            type="button"
            onClick={() => setAssetClass('crypto')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
              assetClass === 'crypto'
                ? 'border-atlas/50 bg-atlas/10 text-atlas'
                : 'border-bg-border text-ink-secondary hover:border-ink-muted',
            )}
          >
            Cripto
          </button>
        </div>

        {assetClass === 'equity' ? (
          <div data-tour="options-symbol" className="flex flex-wrap items-center gap-3 px-7 py-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={symbolInput}
                onChange={(e) => setSymbolInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSymbolSubmit()}
                placeholder="Símbolo (ej. SPY)"
                className="w-32 bg-bg-deep border border-bg-border rounded-lg px-3 py-1.5 text-xs font-mono uppercase text-ink-primary focus:outline-none focus:border-oracle/50 transition-colors"
              />
              <button
                type="button"
                onClick={handleSymbolSubmit}
                className="px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border border-bg-border text-ink-secondary hover:border-ink-muted transition-colors"
              >
                Buscar
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {QUICK_SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSymbolInput(s)
                    setSymbol(s)
                  }}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
                    symbol === s
                      ? 'border-oracle/50 bg-oracle/10 text-oracle'
                      : 'border-bg-border text-ink-secondary hover:border-ink-muted',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div data-tour="options-symbol" className="flex gap-2 flex-wrap px-7 py-4">
            {CRYPTO_CURRENCIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCryptoCurrency(c.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
                  cryptoCurrency === c.value
                    ? 'border-atlas/50 bg-atlas/10 text-atlas'
                    : 'border-bg-border text-ink-secondary hover:border-ink-muted',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {expirations.length > 0 && (
          <div data-tour="options-expirations" className="flex gap-2 flex-wrap px-7 pb-4 overflow-x-auto">
            {expirations.slice(0, 10).map((exp) => (
              <button
                key={exp}
                type="button"
                onClick={() => setSelectedExpiration(exp)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-mono whitespace-nowrap border transition-colors',
                  selectedExpiration === exp
                    ? 'border-nexus/50 bg-nexus/10 text-nexus'
                    : 'border-bg-border text-ink-secondary hover:border-ink-muted',
                )}
              >
                {exp}
              </button>
            ))}
          </div>
        )}
      </div>

      {assetClass === 'equity' && missingKey && (
        <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
          <p className="text-sm font-sans text-ink-secondary">Desactivado — falta la clave de Tradier.</p>
          <p className="text-xs font-sans text-ink-dim mt-1.5">
            Añade TRADIER_API_TOKEN en las variables de entorno para ver la cadena de opciones.
          </p>
        </div>
      )}

      {!(assetClass === 'equity' && missingKey) && error && (
        <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
          <p className="text-sm font-sans text-ink-secondary">{error}</p>
        </div>
      )}

      {!(assetClass === 'equity' && missingKey) && !error && (loadingExpirations || loadingChain) && strikes.length === 0 && (
        <div className="h-[420px] bg-bg-elevated rounded-xl animate-pulse" />
      )}

      {!(assetClass === 'equity' && missingKey) && !error && strikes.length > 0 && (
        <div data-tour="options-chain" className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
          {underlyingPrice !== null && (
            <div className="px-5 py-2.5 border-b border-bg-border text-xs font-mono text-ink-secondary">
              Subyacente:{' '}
              <span className="text-ink-primary tabular-nums">
                ${underlyingPrice.toLocaleString('en-US', { maximumFractionDigits: assetClass === 'crypto' ? 0 : 2 })}
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono tabular-nums">
              <thead>
                <tr className="border-b border-bg-border text-ink-secondary">
                  <th className="px-3 py-2 text-right font-normal">OI</th>
                  <th className="px-3 py-2 text-right font-normal">Vol</th>
                  <th className="px-3 py-2 text-right font-normal">Bid</th>
                  <th className="px-3 py-2 text-right font-normal">Ask</th>
                  <th className="px-3 py-2 text-center font-normal uppercase tracking-wider text-ink-primary">Strike</th>
                  <th className="px-3 py-2 text-left font-normal">Bid</th>
                  <th className="px-3 py-2 text-left font-normal">Ask</th>
                  <th className="px-3 py-2 text-left font-normal">Vol</th>
                  <th className="px-3 py-2 text-left font-normal">OI</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((strike) => {
                  const { call, put } = byStrike.get(strike) ?? {}
                  const isAtm = strike === atmStrike
                  return (
                    <tr
                      key={strike}
                      className={clsx(
                        'border-b border-bg-border/50',
                        isAtm && 'bg-oracle/10',
                      )}
                    >
                      <td className="px-3 py-1.5 text-right text-ink-secondary">{fmtInt(call?.openInterest ?? null)}</td>
                      <td className="px-3 py-1.5 text-right text-ink-secondary">{fmtInt(call?.volume ?? null)}</td>
                      <td className="px-3 py-1.5 text-right text-atlas">
                        {fmt(call?.bid ?? null, priceDecimals)}
                        {call?.bid !== null && call?.bid !== undefined ? priceSuffix : ''}
                      </td>
                      <td className="px-3 py-1.5 text-right text-atlas">
                        {fmt(call?.ask ?? null, priceDecimals)}
                        {call?.ask !== null && call?.ask !== undefined ? priceSuffix : ''}
                      </td>
                      <td
                        className={clsx(
                          'px-3 py-1.5 text-center font-bold',
                          isAtm ? 'text-oracle' : 'text-ink-primary',
                        )}
                      >
                        {strike.toLocaleString('en-US')}
                      </td>
                      <td className="px-3 py-1.5 text-left text-bear">
                        {fmt(put?.bid ?? null, priceDecimals)}
                        {put?.bid !== null && put?.bid !== undefined ? priceSuffix : ''}
                      </td>
                      <td className="px-3 py-1.5 text-left text-bear">
                        {fmt(put?.ask ?? null, priceDecimals)}
                        {put?.ask !== null && put?.ask !== undefined ? priceSuffix : ''}
                      </td>
                      <td className="px-3 py-1.5 text-left text-ink-secondary">{fmtInt(put?.volume ?? null)}</td>
                      <td className="px-3 py-1.5 text-left text-ink-secondary">{fmtInt(put?.openInterest ?? null)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {assetClass === 'crypto' && (
        <div data-tour="options-flow" className="mt-4 rounded-xl border border-bg-border bg-bg-base overflow-hidden">
          <div className="flex items-center justify-between px-7 py-[14px] border-b border-bg-border">
            <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-ink-secondary">Flujo de opciones</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-dim">
              {flow?.tradeCount != null ? `${flow.tradeCount} trades recientes` : ''}
            </span>
          </div>

          {flowError && <p className="px-7 py-6 text-sm font-sans text-ink-secondary text-center">{flowError}</p>}

          {!flowError && loadingFlow && !flow && (
            <div className="h-[200px] bg-bg-elevated animate-pulse" />
          )}

          {!flowError && flow && flow.tradeCount === 0 && (
            <p className="px-7 py-6 text-sm font-sans text-ink-secondary text-center">
              Sin trades recientes de opciones de {cryptoCurrency} en Deribit.
            </p>
          )}

          {!flowError && flow && flow.tradeCount != null && flow.tradeCount > 0 && (
            <OptionsFlowPanel flow={flow} currency={cryptoCurrency} underlyingPrice={underlyingPrice} />
          )}

          <p className="px-7 py-3 text-[10px] font-sans leading-relaxed text-ink-dim border-t border-bg-border">
            Score y clasificación calculados de forma determinística sobre los últimos {flow?.tradeCount ?? 0} trades de
            Deribit (hasta 1000, no es un histórico completo de la sesión) — no es un indicador inventado ni interpretado
            por IA, es aritmética directa sobre operaciones reales.
          </p>
        </div>
      )}

      <p className="mt-4 text-xs font-sans leading-relaxed text-ink-dim">
        {assetClass === 'equity' ? (
          <>
            Cadena de opciones completa (strikes, bid/ask, volumen, open interest) vía Tradier. Calls a la izquierda,
            puts a la derecha, strike resaltado = el más cercano al precio actual del subyacente. Si tu cuenta de
            Tradier todavía está en revisión, puedes obtener un token de sandbox gratis e instantáneo en{' '}
            developer.tradier.com mientras esperas la aprobación (datos con 15 min de retraso).
          </>
        ) : (
          <>
            Cadena de opciones de {cryptoCurrency} vía Deribit (sin necesidad de API key — es el exchange de opciones
            cripto con más liquidez para BTC y ETH). Importante: bid/ask/último están denominados en {cryptoCurrency},
            no en dólares — Deribit liquida sus opciones en la cripto subyacente, no en USD. Calls a la izquierda,
            puts a la derecha, strike resaltado = el más cercano al precio actual del subyacente.
          </>
        )}
      </p>

      <Tour steps={OPTIONS_TOUR_STEPS} active={tourActive} onClose={closeTour} />
    </div>
  )
}
