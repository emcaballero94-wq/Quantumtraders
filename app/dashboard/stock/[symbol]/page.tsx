'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import type { CompanyProfile } from '@/lib/market-fundamentals'
import { relatedSymbolsFor } from '@/lib/market-relationships'
import { RelationshipMap, type RelatedNode } from '@/components/market/RelationshipMap'

interface QuoteItem {
  symbol: string
  price: number | null
  changePct: number | null
  open: number | null
  high: number | null
  low: number | null
  prevClose: number | null
  volume: number | null
  description: string
}

interface QuoteResponse {
  quotes: QuoteItem[]
}

interface CompanyResponse {
  success: boolean
  data?: CompanyProfile
  error?: string
}

interface BriefResponse {
  success: boolean
  data?: { brief: string }
  error?: string
}

function fmtMoney(value: number | null): string {
  if (value === null || value === undefined) return '—'
  if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString('en-US')}`
}

function fmtNum(value: number | null, digits = 2): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtPct(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-bg-border pl-3.5 space-y-1.5 min-w-0">
      <p className="text-xs font-sans text-ink-secondary">{label}</p>
      <p className="text-[17px] font-mono text-ink-primary tabular-nums truncate">{value}</p>
    </div>
  )
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={clsx('text-[11px] font-mono uppercase tracking-[0.16em]', className ?? 'text-ink-secondary')}>{children}</p>
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('rounded-xl border border-bg-border p-6 space-y-2.5', className)}>{children}</div>
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>()
  const router = useRouter()
  const symbol = (params?.symbol ?? '').toUpperCase()

  const [quote, setQuote] = useState<QuoteItem | null>(null)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [relatedNodes, setRelatedNodes] = useState<RelatedNode[]>([])

  useEffect(() => {
    if (!symbol) return
    let mounted = true
    const relatedSymbols = relatedSymbolsFor(symbol)
    const load = async () => {
      setLoading(true)
      try {
        const [quotePayload, companyPayload, relatedPayload] = await Promise.all([
          fetch(`/api/market/quote?symbols=${encodeURIComponent(symbol)}`).then((r) => r.json() as Promise<QuoteResponse>),
          fetch(`/api/market/company?symbol=${encodeURIComponent(symbol)}`).then((r) => r.json() as Promise<CompanyResponse>),
          relatedSymbols.length > 0
            ? fetch(`/api/market/quote?symbols=${encodeURIComponent(relatedSymbols.join(','))}`).then((r) => r.json() as Promise<QuoteResponse>)
            : Promise.resolve<QuoteResponse>({ quotes: [] }),
        ])
        if (!mounted) return
        setQuote(quotePayload?.quotes?.[0] ?? null)
        if (companyPayload.success && companyPayload.data) {
          setProfile(companyPayload.data)
          setProfileError(null)
        } else {
          setProfile(null)
          setProfileError(companyPayload.error ?? 'No se pudo cargar la información fundamental')
        }
        setRelatedNodes(
          (relatedPayload?.quotes ?? []).map((q) => ({ symbol: q.symbol, changePct: q.changePct, volume: q.volume })),
        )
      } catch {
        if (!mounted) return
        setProfileError('No se pudo cargar la información fundamental')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [symbol])

  useEffect(() => {
    if (!profile || !symbol) return
    let mounted = true
    const loadBrief = async () => {
      setBriefLoading(true)
      try {
        const response = await fetch('/api/market/brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, profile, quote: { price: quote?.price ?? null, changePct: quote?.changePct ?? null } }),
        })
        const payload = (await response.json()) as BriefResponse
        if (!mounted) return
        if (payload.success && payload.data) {
          setBrief(payload.data.brief)
          setBriefError(null)
        } else {
          setBrief(null)
          setBriefError(payload.error ?? 'Brief de IA no disponible')
        }
      } catch {
        if (!mounted) return
        setBrief(null)
        setBriefError('Brief de IA no disponible')
      } finally {
        if (mounted) setBriefLoading(false)
      }
    }
    loadBrief()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, symbol])

  const up = (quote?.changePct ?? 0) >= 0
  const changeAbs = quote?.price != null && quote?.prevClose != null ? quote.price - quote.prevClose : null

  const hasFinancials = useMemo(
    () => Boolean(profile?.annualFinancials?.length || profile?.quarterlyFinancials?.length),
    [profile],
  )

  const eyebrow = [symbol, profile?.exchange].filter(Boolean).join(' · ')

  if (loading) {
    return (
      <div className="p-5 space-y-6 animate-fade-in max-w-[1200px]">
        <div className="h-4 w-32 bg-bg-elevated rounded animate-pulse" />
        <div className="flex justify-between gap-6">
          <div className="h-16 w-72 bg-bg-elevated rounded animate-pulse" />
          <div className="h-16 w-64 bg-bg-elevated rounded animate-pulse" />
        </div>
        <div className="h-14 bg-bg-elevated rounded animate-pulse" />
        <div className="h-80 bg-bg-elevated rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-9 animate-fade-in pb-20 max-w-[1200px]">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-[11px] font-mono text-ink-secondary hover:text-ink-primary transition-colors uppercase tracking-wider"
      >
        ← Volver
      </button>

      {/* Header — editorial: name left, large price right */}
      <header className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] items-end gap-6 pb-7 border-b border-bg-border">
        <div className="space-y-2.5 min-w-0">
          {eyebrow && <Eyebrow className="text-pulse">{eyebrow}</Eyebrow>}
          <h1 className="text-4xl font-sans font-semibold text-ink-primary tracking-tight truncate">
            {profile?.name ?? quote?.description ?? symbol}
          </h1>
          <p className="text-[13px] font-mono text-ink-secondary">
            {symbol}
            {quote?.prevClose != null && <> · Cierre previo {fmtNum(quote.prevClose)}</>}
            {(profile?.sector || profile?.industry) && <> · {[profile?.sector, profile?.industry].filter(Boolean).join(' · ')}</>}
          </p>
        </div>
        <div className="flex flex-col md:items-end gap-2">
          <p className="text-5xl md:text-6xl font-mono font-medium text-pulse tracking-tighter leading-none tabular-nums">
            {fmtNum(quote?.price ?? null)}
          </p>
          <p className={clsx('text-[15px] font-mono tabular-nums', up ? 'text-atlas' : 'text-bear')}>
            {quote?.changePct != null ? (
              <>
                {up ? '▲' : '▼'} {changeAbs != null && `${changeAbs >= 0 ? '+' : ''}${fmtNum(changeAbs)} · `}
                {`${up ? '+' : ''}${quote.changePct.toFixed(2)}%`} hoy
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
      </header>

      {/* Session stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        <StatCell label="Apertura" value={fmtNum(quote?.open ?? null)} />
        <StatCell label="Máximo" value={fmtNum(quote?.high ?? null)} />
        <StatCell label="Mínimo" value={fmtNum(quote?.low ?? null)} />
        <StatCell label="Cierre previo" value={fmtNum(quote?.prevClose ?? null)} />
        <StatCell
          label="Rango 52 sem."
          value={profile ? `${fmtNum(profile.fiftyTwoWeekLow, 0)}–${fmtNum(profile.fiftyTwoWeekHigh, 0)}` : '—'}
        />
        <StatCell label="Volumen" value={quote?.volume ? quote.volume.toLocaleString('en-US') : '—'} />
      </div>

      {relatedNodes.length > 0 && (
        <RelationshipMap center={symbol} centerPrice={fmtNum(quote?.price ?? null)} nodes={relatedNodes} />
      )}

      {/* AI brief + fundamentals status */}
      <div className={clsx('grid grid-cols-1 gap-5', !profile && 'md:grid-cols-2')}>
        <Card>
          <Eyebrow className="text-oracle">Brief de IA</Eyebrow>
          {briefLoading && <p className="text-[15px] font-sans text-ink-secondary">Generando análisis…</p>}
          {!briefLoading && brief && <p className="text-[15px] font-sans text-ink-primary leading-relaxed text-pretty">{brief}</p>}
          {!briefLoading && !brief && (
            <>
              <p className="text-[15px] font-sans text-ink-primary">Sin brief disponible todavía.</p>
              <p className="text-[13px] font-sans text-ink-secondary">{briefError ?? 'Se genera cuando hay información fundamental del activo.'}</p>
            </>
          )}
        </Card>

        {profileError && !profile && (
          <Card>
            <Eyebrow>Fundamentales</Eyebrow>
            <p className="text-[15px] font-sans text-ink-primary">No disponibles para este símbolo.</p>
            <p className="text-[13px] font-sans text-ink-secondary">{profileError}</p>
          </Card>
        )}
      </div>

      {profile && (
        <>
          <section className="space-y-4">
            <Eyebrow>Estadísticas clave</Eyebrow>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">
              <StatCell label="Market Cap" value={fmtMoney(profile.marketCap)} />
              <StatCell label="P/E (TTM)" value={fmtNum(profile.peTrailing)} />
              <StatCell label="P/E Forward" value={fmtNum(profile.peForward)} />
              <StatCell label="EPS" value={fmtNum(profile.eps)} />
              <StatCell label="Beta" value={fmtNum(profile.beta)} />
              <StatCell label="Dividend Yield" value={fmtPct(profile.dividendYield)} />
              <StatCell label="Vol. promedio" value={profile.avgVolume ? profile.avgVolume.toLocaleString('en-US') : '—'} />
              <StatCell label="Ingresos (TTM)" value={fmtMoney(profile.revenueTtm)} />
              <StatCell label="Crec. ingresos YoY" value={fmtPct(profile.revenueGrowthYoy)} />
              <StatCell label="Margen bruto" value={fmtPct(profile.grossMargins)} />
              <StatCell label="Margen neto" value={fmtPct(profile.profitMargins)} />
            </div>
          </section>

          {profile.recommendationKey && (
            <Card className="!space-y-0 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <Eyebrow>Consenso de analistas</Eyebrow>
                <p className="text-xl font-sans font-medium text-atlas capitalize">{profile.recommendationKey.replace('_', ' ')}</p>
              </div>
              <StatCell label="Precio objetivo promedio" value={fmtNum(profile.targetMeanPrice)} />
              <StatCell label="Analistas" value={profile.analystCount != null ? String(profile.analystCount) : '—'} />
            </Card>
          )}

          {hasFinancials && (
            <Card className="!space-y-4">
              <Eyebrow>Financieros anuales</Eyebrow>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono tabular-nums">
                  <thead>
                    <tr className="text-xs font-sans text-ink-secondary border-b border-bg-border">
                      <th className="text-left font-normal py-2.5">Período</th>
                      <th className="text-right font-normal py-2.5">Ingresos</th>
                      <th className="text-right font-normal py-2.5">Utilidad neta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.annualFinancials.map((row) => (
                      <tr key={row.period} className="border-b border-bg-border/50">
                        <td className="py-2.5 text-ink-secondary">{row.period}</td>
                        <td className="py-2.5 text-right text-ink-primary">{fmtMoney(row.revenue)}</td>
                        <td className={clsx('py-2.5 text-right', (row.earnings ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>{fmtMoney(row.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {profile.description && (
            <Card className="!space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Eyebrow>Perfil de la empresa</Eyebrow>
                <div className="flex items-center gap-4 text-xs font-mono text-ink-secondary">
                  {profile.employees && <span>{profile.employees.toLocaleString('en-US')} empleados</span>}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-pulse hover:underline">
                      Sitio web →
                    </a>
                  )}
                </div>
              </div>
              <p className="text-sm font-sans text-ink-secondary leading-relaxed text-pretty">{profile.description}</p>
            </Card>
          )}

          {profile.officers.length > 0 && (
            <Card className="!space-y-4">
              <Eyebrow>Directivos</Eyebrow>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {profile.officers.map((officer) => (
                  <div key={`${officer.name}-${officer.title}`} className="py-3 border-b border-bg-border/60 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-sans font-medium text-ink-primary truncate">{officer.name}</p>
                      <p className="text-xs font-sans text-ink-secondary truncate">{officer.title}</p>
                    </div>
                    <div className="text-right shrink-0 text-xs font-mono text-ink-secondary">
                      {officer.age !== null && <p>{officer.age} años</p>}
                      {officer.totalPay !== null && <p>{fmtMoney(officer.totalPay)}/año</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Card>
        <Eyebrow>Sentimiento en X</Eyebrow>
        <p className="text-[15px] font-sans text-ink-primary">Sin conectar.</p>
        <p className="text-[13px] font-sans text-ink-secondary leading-relaxed text-pretty">
          Requiere un bearer token de la API de X para escanear tweets relevantes del sector en tiempo real. No se muestran datos simulados.
        </p>
      </Card>
    </div>
  )
}
