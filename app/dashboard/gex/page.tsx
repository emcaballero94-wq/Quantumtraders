'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { GexHeatmap } from '@/components/gex/GexHeatmap'
import { GexManuBrief } from '@/components/gex/GexManuBrief'
import { TermHelp } from '@/components/ui/TermHelp'

interface GexProfilePoint {
  strike: number
  callGex: number
  putGex: number
  netGex: number
}

interface GexResponse {
  success: boolean
  error?: string
  underlyingPrice?: number
  expiration?: string
  netGex?: number
  callWallStrike?: number | null
  putWallStrike?: number | null
  gammaFlip?: number | null
  maxPainStrike?: number | null
  contractsWithGamma?: number
  totalContracts?: number
  profile?: GexProfilePoint[]
}

interface ExpirationsResponse {
  success: boolean
  error?: string
  expirations: string[]
}

type AssetClass = 'equity' | 'crypto'

const QUICK_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA']
const CRYPTO_CURRENCIES: { label: string; value: 'BTC' | 'ETH' }[] = [
  { label: 'BTC', value: 'BTC' },
  { label: 'ETH', value: 'ETH' },
]

function fmtGex(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function fmtStrike(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

type ViewMode = 'profile' | 'heatmap'

export default function GexPage() {
  const [assetClass, setAssetClass] = useState<AssetClass>('equity')
  const [view, setView] = useState<ViewMode>('profile')

  const [symbolInput, setSymbolInput] = useState('SPY')
  const [symbol, setSymbol] = useState('SPY')
  const [cryptoCurrency, setCryptoCurrency] = useState<'BTC' | 'ETH'>('BTC')

  const [expirations, setExpirations] = useState<string[]>([])
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [gex, setGex] = useState<GexResponse | null>(null)
  const [missingKey, setMissingKey] = useState(false)
  const [loadingExpirations, setLoadingExpirations] = useState(true)
  const [loadingGex, setLoadingGex] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Equity expirations (Tradier).
  useEffect(() => {
    if (assetClass !== 'equity') return
    let cancelled = false
    setLoadingExpirations(true)
    setExpirations([])
    setSelectedExpiration(null)
    setGex(null)
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

  // Crypto expirations (Deribit) — no API key needed.
  useEffect(() => {
    if (assetClass !== 'crypto') return
    let cancelled = false
    setLoadingExpirations(true)
    setExpirations([])
    setSelectedExpiration(null)
    setGex(null)
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

  // GEX computation for the selected expiration.
  useEffect(() => {
    if (!selectedExpiration) return
    let cancelled = false
    setLoadingGex(true)

    const params =
      assetClass === 'equity'
        ? `assetClass=equity&symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(selectedExpiration)}`
        : `assetClass=crypto&currency=${cryptoCurrency}&expiration=${encodeURIComponent(selectedExpiration)}`

    fetch(`/api/market/gex?${params}`)
      .then((r) => r.json() as Promise<GexResponse>)
      .then((payload) => {
        if (cancelled) return
        if (!payload.success) {
          setError(payload.error ?? 'No se pudo calcular GEX.')
          setGex(null)
          return
        }
        setGex(payload)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo calcular GEX.')
      })
      .finally(() => {
        if (!cancelled) setLoadingGex(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetClass, symbol, cryptoCurrency, selectedExpiration])

  const handleSymbolSubmit = () => {
    const next = symbolInput.trim().toUpperCase()
    if (next && next !== symbol) setSymbol(next)
  }

  const profile = gex?.profile ?? []
  const atmStrike =
    gex?.underlyingPrice !== undefined && profile.length > 0
      ? profile.reduce((closest, p) => (Math.abs(p.strike - gex.underlyingPrice!) < Math.abs(closest - gex.underlyingPrice!) ? p.strike : closest), profile[0].strike)
      : null

  const netGex = gex?.netGex ?? null
  const regimeText =
    netGex === null
      ? null
      : netGex >= 0
        ? 'Positivo — el hedging de dealers tiende a amortiguar los movimientos de precio.'
        : 'Negativo — el hedging de dealers puede amplificar los movimientos de precio.'

  const priceUnit = assetClass === 'crypto' ? cryptoCurrency : 'USD'

  return (
    <div className="animate-fade-in pb-20 max-w-[1040px]">
      <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
        <div className="flex items-baseline gap-3.5 flex-wrap px-7 py-[18px] border-b border-bg-border">
          <h1 className="text-[22px] font-sans font-medium text-ink-primary">GEX — Gamma Exposure</h1>
          <span className="text-xs font-mono text-ink-secondary">
            Dealer gamma exposure en vivo · {assetClass === 'equity' ? 'Tradier' : 'Deribit'} · Black-Scholes
          </span>
        </div>

        <div className="flex gap-2 px-7 pt-4">
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
          <span className="w-px bg-bg-border mx-1" />
          <button
            type="button"
            onClick={() => setView('profile')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
              view === 'profile'
                ? 'border-nexus/50 bg-nexus/10 text-nexus'
                : 'border-bg-border text-ink-secondary hover:border-ink-muted',
            )}
          >
            Perfil
          </button>
          <button
            type="button"
            onClick={() => setView('heatmap')}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors',
              view === 'heatmap'
                ? 'border-nexus/50 bg-nexus/10 text-nexus'
                : 'border-bg-border text-ink-secondary hover:border-ink-muted',
            )}
          >
            Mapa de calor
          </button>
        </div>

        {assetClass === 'equity' ? (
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
        ) : (
          <div className="flex gap-2 flex-wrap px-7 py-4">
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

        {view === 'profile' && expirations.length > 0 && (
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

      {assetClass === 'equity' && missingKey && (
        <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
          <p className="text-sm font-sans text-ink-secondary">Desactivado — falta la clave de Tradier.</p>
          <p className="text-xs font-sans text-ink-dim mt-1.5">
            Añade TRADIER_API_TOKEN en las variables de entorno para ver GEX de acciones.
          </p>
        </div>
      )}

      {!(assetClass === 'equity' && missingKey) && (
        <GexManuBrief assetClass={assetClass} symbolOrCurrency={assetClass === 'equity' ? symbol : cryptoCurrency} />
      )}

      {view === 'heatmap' && !(assetClass === 'equity' && missingKey) && (
        <GexHeatmap
          assetClass={assetClass}
          symbolOrCurrency={assetClass === 'equity' ? symbol : cryptoCurrency}
          priceUnit={priceUnit}
        />
      )}

      {view === 'profile' && !(assetClass === 'equity' && missingKey) && error && (
        <div className="rounded-xl border border-bg-border bg-bg-base px-7 py-10 text-center">
          <p className="text-sm font-sans text-ink-secondary">{error}</p>
        </div>
      )}

      {view === 'profile' && !(assetClass === 'equity' && missingKey) && !error && (loadingExpirations || loadingGex) && !gex && (
        <div className="h-[420px] bg-bg-elevated rounded-xl animate-pulse" />
      )}

      {view === 'profile' && !(assetClass === 'equity' && missingKey) && !error && gex && (
        <>
          <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-5 py-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Subyacente</p>
                <p className="text-lg font-mono tabular-nums text-ink-primary">
                  {gex.underlyingPrice !== undefined ? `${gex.underlyingPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${priceUnit}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Net GEX <TermHelp term="net_gex" /></p>
                <p className={clsx('text-lg font-mono tabular-nums', netGex === null ? 'text-ink-dim' : netGex >= 0 ? 'text-atlas' : 'text-bear')}>
                  {fmtGex(netGex)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Max Pain <TermHelp term="max_pain" /></p>
                <p className="text-lg font-mono tabular-nums text-ink-primary">{fmtStrike(gex.maxPainStrike)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Call Wall <TermHelp term="call_wall" /></p>
                <p className="text-lg font-mono tabular-nums text-atlas">{fmtStrike(gex.callWallStrike)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Put Wall <TermHelp term="put_wall" /></p>
                <p className="text-lg font-mono tabular-nums text-bear">{fmtStrike(gex.putWallStrike)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary mb-1">Gamma Flip <TermHelp term="gamma_flip" /></p>
                <p className="text-lg font-mono tabular-nums text-oracle">{fmtStrike(gex.gammaFlip)}</p>
              </div>
            </div>
            {regimeText && (
              <p className="px-5 py-3 border-t border-bg-border text-xs font-sans text-ink-secondary leading-relaxed">
                {regimeText}
              </p>
            )}
            <p className="px-5 pb-3 text-[10px] font-mono text-ink-dim">
              {gex.contractsWithGamma ?? 0} / {gex.totalContracts ?? 0} contratos con gamma calculable para este vencimiento.
            </p>
          </div>

          {profile.length > 0 && (
            <div className="rounded-xl border border-bg-border bg-bg-base overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono tabular-nums">
                  <thead>
                    <tr className="border-b border-bg-border text-ink-secondary">
                      <th className="px-3 py-2 text-right font-normal">Call GEX</th>
                      <th className="px-3 py-2 text-center font-normal uppercase tracking-wider text-ink-primary">Strike</th>
                      <th className="px-3 py-2 text-left font-normal">Put GEX</th>
                      <th className="px-3 py-2 text-right font-normal">Net GEX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...profile]
                      .sort((a, b) => b.strike - a.strike)
                      .map((point) => {
                        const isAtm = point.strike === atmStrike
                        const isCallWall = point.strike === gex.callWallStrike
                        const isPutWall = point.strike === gex.putWallStrike
                        return (
                          <tr
                            key={point.strike}
                            className={clsx('border-b border-bg-border/50', isAtm && 'bg-oracle/10')}
                          >
                            <td className={clsx('px-3 py-1.5 text-right', isCallWall ? 'text-atlas font-bold' : 'text-atlas')}>
                              {point.callGex !== 0 ? fmtGex(point.callGex) : '—'}
                            </td>
                            <td className={clsx('px-3 py-1.5 text-center font-bold', isAtm ? 'text-oracle' : 'text-ink-primary')}>
                              {fmtStrike(point.strike)}
                            </td>
                            <td className={clsx('px-3 py-1.5 text-left', isPutWall ? 'text-bear font-bold' : 'text-bear')}>
                              {point.putGex !== 0 ? fmtGex(point.putGex) : '—'}
                            </td>
                            <td className={clsx('px-3 py-1.5 text-right', point.netGex >= 0 ? 'text-atlas' : 'text-bear')}>
                              {fmtGex(point.netGex)}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <p className="mt-4 text-xs font-sans leading-relaxed text-ink-dim">
        GEX (gamma exposure) estima cuánta gamma neta tienen los dealers de opciones sobre todo el open interest de
        este vencimiento, vía Black-Scholes. Usa el gamma reportado por la fuente cuando existe; si no, calcula la
        volatilidad implícita a partir del último precio y deriva el gamma desde ahí (tasa libre de riesgo 4.5%,
        sin dividendos — supuestos simplificados, no datos en vivo). La convención de signo (calls positivo, puts
        negativo) es la que usan la mayoría de herramientas públicas de GEX y es una aproximación — no refleja la
        posición real de los market makers, que no es un dato público. GEX positivo sugiere que el hedging de
        dealers amortigua el movimiento del precio; negativo, que puede amplificarlo. Nada de esto es una
        recomendación de compra o venta.
      </p>
      {view === 'heatmap' && (
        <p className="mt-2 text-xs font-sans leading-relaxed text-ink-dim">
          El mapa de calor combina únicamente los vencimientos mostrados (no toda la cadena de opciones) — Call
          Wall, Put Wall, Gamma Flip y Régimen son ese agregado parcial, y cambian si movés el slider de vencimientos.
        </p>
      )}
      <p className="mt-2 text-xs font-sans leading-relaxed text-ink-dim">
        El brief de M.A.N.U. arriba analiza los {' '}
        <span className="font-mono">8</span> vencimientos más cercanos (no uno solo) y compara contra el snapshot
        diario más reciente — si todavía no hay uno de un día anterior, lo dice en vez de inventar una comparación.
        Es una lectura puntual bajo pedido, no un stream en vivo: tocá "Actualizar" para recalcularla.
      </p>
    </div>
  )
}
