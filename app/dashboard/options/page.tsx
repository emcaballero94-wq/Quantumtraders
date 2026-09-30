'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

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

const QUICK_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA']

function fmt(value: number | null, decimals = 2): string {
  return value === null ? '—' : value.toFixed(decimals)
}

function fmtInt(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('en-US')
}

export default function OptionsPage() {
  const [symbolInput, setSymbolInput] = useState('SPY')
  const [symbol, setSymbol] = useState('SPY')
  const [expirations, setExpirations] = useState<string[]>([])
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [contracts, setContracts] = useState<OptionContract[]>([])
  const [underlyingPrice, setUnderlyingPrice] = useState<number | null>(null)
  const [missingKey, setMissingKey] = useState(false)
  const [loadingExpirations, setLoadingExpirations] = useState(true)
  const [loadingChain, setLoadingChain] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [symbol])

  useEffect(() => {
    if (!selectedExpiration) return
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
  }, [symbol, selectedExpiration])

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

  return (
    <div className="animate-fade-in pb-20 max-w-[1040px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-baseline gap-3.5 flex-wrap px-7 py-[18px] border-b border-bg-border">
          <h1 className="text-[22px] font-sans font-medium text-ink-primary">Options Chain</h1>
          <span className="text-xs font-mono text-ink-secondary">Cadena de opciones en vivo · Tradier</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-7 py-4">
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

        {expirations.length > 0 && (
          <div className="flex gap-2 flex-wrap px-7 pb-4 overflow-x-auto">
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

      {missingKey && (
        <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
          <p className="text-sm font-sans text-ink-secondary">Desactivado — falta la clave de Tradier.</p>
          <p className="text-xs font-sans text-ink-dim mt-1.5">
            Añade TRADIER_API_TOKEN en las variables de entorno para ver la cadena de opciones.
          </p>
        </div>
      )}

      {!missingKey && error && (
        <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
          <p className="text-sm font-sans text-ink-secondary">{error}</p>
        </div>
      )}

      {!missingKey && !error && (loadingExpirations || loadingChain) && strikes.length === 0 && (
        <div className="h-[420px] bg-bg-elevated rounded-xl animate-pulse" />
      )}

      {!missingKey && !error && strikes.length > 0 && (
        <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
          {underlyingPrice !== null && (
            <div className="px-5 py-2.5 border-b border-bg-border text-xs font-mono text-ink-secondary">
              Subyacente: <span className="text-ink-primary tabular-nums">${underlyingPrice.toFixed(2)}</span>
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
                      <td className="px-3 py-1.5 text-right text-atlas">{fmt(call?.bid ?? null)}</td>
                      <td className="px-3 py-1.5 text-right text-atlas">{fmt(call?.ask ?? null)}</td>
                      <td
                        className={clsx(
                          'px-3 py-1.5 text-center font-bold',
                          isAtm ? 'text-oracle' : 'text-ink-primary',
                        )}
                      >
                        {strike}
                      </td>
                      <td className="px-3 py-1.5 text-left text-bear">{fmt(put?.bid ?? null)}</td>
                      <td className="px-3 py-1.5 text-left text-bear">{fmt(put?.ask ?? null)}</td>
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

      <p className="mt-4 text-xs font-sans leading-relaxed text-ink-dim">
        Cadena de opciones completa (strikes, bid/ask, volumen, open interest) vía Tradier. Calls a la izquierda,
        puts a la derecha, strike resaltado = el más cercano al precio actual del subyacente. Si tu cuenta de
        Tradier todavía está en revisión, puedes obtener un token de sandbox gratis e instantáneo en{' '}
        developer.tradier.com mientras esperas la aprobación (datos con 15 min de retraso).
      </p>
    </div>
  )
}
