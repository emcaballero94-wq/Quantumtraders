'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function fmtPct(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-bg-border bg-bg-elevated/30 px-3 py-2.5">
      <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">{label}</p>
      <p className="text-sm font-mono font-bold text-ink-primary mt-1 tabular-nums">{value}</p>
    </div>
  )
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>()
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

  const changeColor = (quote?.changePct ?? 0) >= 0 ? 'text-atlas' : 'text-bear'

  const hasFinancials = useMemo(
    () => Boolean(profile?.annualFinancials?.length || profile?.quarterlyFinancials?.length),
    [profile],
  )

  if (loading) {
    return (
      <div className="p-5 space-y-4 animate-fade-in">
        <div className="h-6 w-40 bg-bg-elevated rounded animate-pulse" />
        <div className="h-24 bg-bg-elevated rounded-xl animate-pulse" />
        <div className="h-64 bg-bg-elevated rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in pb-20 max-w-[1200px]">
      <Link href="/dashboard/scanner" className="text-[10px] font-mono text-ink-dim hover:text-ink-primary transition-colors uppercase tracking-wider">
        ← Volver al Scanner
      </Link>

      {/* Header — dense ticker-bar style */}
      <div className="rounded-xl border border-pulse/30 bg-black overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-mono font-bold text-pulse tracking-tight">{symbol}</h1>
              {profile?.exchange && <span className="text-[10px] font-mono text-ink-dim uppercase px-2 py-0.5 rounded border border-bg-border">{profile.exchange}</span>}
            </div>
            <p className="text-sm font-mono text-ink-secondary mt-1">{profile?.name ?? quote?.description ?? symbol}</p>
            {(profile?.sector || profile?.industry) && (
              <p className="text-[10px] font-mono text-ink-dim mt-1">{[profile?.sector, profile?.industry].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-pulse tabular-nums">{fmtNum(quote?.price ?? null)}</p>
            <p className={clsx('text-sm font-mono font-bold', changeColor)}>
              {quote?.changePct !== null && quote?.changePct !== undefined ? `${quote.changePct >= 0 ? '+' : ''}${quote.changePct.toFixed(2)}%` : '—'}
            </p>
          </div>
        </div>

        {/* Dense stat strip */}
        <div className="border-t border-pulse/20 bg-pulse/5 px-5 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10.5px] font-mono">
          <span className="text-ink-dim">O <span className="text-pulse font-bold">{fmtNum(quote?.open ?? null)}</span></span>
          <span className="text-ink-dim">H <span className="text-pulse font-bold">{fmtNum(quote?.high ?? null)}</span></span>
          <span className="text-ink-dim">L <span className="text-pulse font-bold">{fmtNum(quote?.low ?? null)}</span></span>
          <span className="text-ink-dim">Prev Close <span className="text-pulse font-bold">{fmtNum(quote?.prevClose ?? null)}</span></span>
          <span className="text-ink-dim">Vol <span className="text-pulse font-bold">{quote?.volume ? quote.volume.toLocaleString('en-US') : '—'}</span></span>
          {profile && (
            <span className="text-ink-dim">52W <span className="text-pulse font-bold">{fmtNum(profile.fiftyTwoWeekLow)} - {fmtNum(profile.fiftyTwoWeekHigh)}</span></span>
          )}
        </div>
      </div>

      {/* Relationship map */}
      {relatedNodes.length > 0 && <RelationshipMap center={symbol} nodes={relatedNodes} />}

      {/* AI Brief */}
      <div className="rounded-xl border border-oracle/30 bg-bg-card p-5 border-l-4 border-l-oracle space-y-2">
        <p className="text-[10px] font-mono text-oracle uppercase tracking-widest font-bold">Brief de IA</p>
        {briefLoading && <p className="text-xs font-mono text-ink-dim">Generando análisis...</p>}
        {!briefLoading && brief && <p className="text-sm font-mono text-ink-primary leading-relaxed">{brief}</p>}
        {!briefLoading && !brief && (
          <p className="text-xs font-mono text-ink-dim">{briefError ?? 'Brief de IA no disponible para este activo.'}</p>
        )}
      </div>

      {profileError && !profile && (
        <div className="rounded-xl border border-bg-border bg-bg-card p-5 text-xs font-mono text-ink-dim">{profileError}</div>
      )}

      {profile && (
        <>
          {/* Key stats */}
          <div>
            <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest mb-2">Estadísticas clave</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <StatTile label="Market Cap" value={fmtMoney(profile.marketCap)} />
              <StatTile label="P/E (TTM)" value={fmtNum(profile.peTrailing)} />
              <StatTile label="P/E Forward" value={fmtNum(profile.peForward)} />
              <StatTile label="EPS" value={fmtNum(profile.eps)} />
              <StatTile label="Beta" value={fmtNum(profile.beta)} />
              <StatTile label="Dividend Yield" value={fmtPct(profile.dividendYield)} />
              <StatTile label="Rango 52S" value={`${fmtNum(profile.fiftyTwoWeekLow)} - ${fmtNum(profile.fiftyTwoWeekHigh)}`} />
              <StatTile label="Vol. Promedio" value={profile.avgVolume ? profile.avgVolume.toLocaleString('en-US') : '—'} />
              <StatTile label="Ingresos (TTM)" value={fmtMoney(profile.revenueTtm)} />
              <StatTile label="Crec. Ingresos YoY" value={fmtPct(profile.revenueGrowthYoy)} />
              <StatTile label="Margen Bruto" value={fmtPct(profile.grossMargins)} />
              <StatTile label="Margen Neto" value={fmtPct(profile.profitMargins)} />
            </div>
          </div>

          {profile.recommendationKey && (
            <div className="rounded-xl border border-bg-border bg-bg-card p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Consenso de analistas</p>
                <p className="text-sm font-mono font-bold text-atlas uppercase mt-1">{profile.recommendationKey.replace('_', ' ')}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Precio objetivo promedio</p>
                <p className="text-sm font-mono font-bold text-ink-primary mt-1">{fmtNum(profile.targetMeanPrice)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Analistas</p>
                <p className="text-sm font-mono font-bold text-ink-primary mt-1">{profile.analystCount ?? '—'}</p>
              </div>
            </div>
          )}

          {/* Financials */}
          {hasFinancials && (
            <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
              <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Financieros anuales</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-[9px] text-ink-dim uppercase tracking-wider border-b border-bg-border">
                      <th className="text-left py-2">Período</th>
                      <th className="text-right py-2">Ingresos</th>
                      <th className="text-right py-2">Utilidad neta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.annualFinancials.map((row) => (
                      <tr key={row.period} className="border-b border-bg-border/50">
                        <td className="py-2 text-ink-secondary">{row.period}</td>
                        <td className="py-2 text-right text-ink-primary">{fmtMoney(row.revenue)}</td>
                        <td className={clsx('py-2 text-right font-bold', (row.earnings ?? 0) >= 0 ? 'text-atlas' : 'text-bear')}>{fmtMoney(row.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Company profile */}
          {profile.description && (
            <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Perfil de la empresa</p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-ink-dim">
                  {profile.employees && <span>{profile.employees.toLocaleString('en-US')} empleados</span>}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-oracle hover:underline">
                      Sitio web →
                    </a>
                  )}
                </div>
              </div>
              <p className="text-xs font-mono text-ink-secondary leading-relaxed">{profile.description}</p>
            </div>
          )}

          {/* Leadership */}
          {profile.officers.length > 0 && (
            <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
              <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Directivos</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {profile.officers.map((officer) => (
                  <div key={`${officer.name}-${officer.title}`} className="rounded-lg border border-bg-border bg-bg-elevated/20 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono font-bold text-ink-primary">{officer.name}</p>
                      <p className="text-[10px] font-mono text-ink-dim">{officer.title}</p>
                    </div>
                    <div className="text-right">
                      {officer.age !== null && <p className="text-[10px] font-mono text-ink-dim">{officer.age} años</p>}
                      {officer.totalPay !== null && <p className="text-[10px] font-mono text-ink-secondary">{fmtMoney(officer.totalPay)}/año</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* X / Social sentiment */}
      <div className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-2">
        <p className="text-[10px] font-mono text-ink-dim uppercase tracking-widest">Sentimiento en X (Twitter)</p>
        <p className="text-xs font-mono text-ink-dim leading-relaxed">
          Esta sección requiere credenciales de la API de X (bearer token de desarrollador) para escanear tweets relevantes del sector en tiempo real.
          Aún no está conectada — no se muestran datos simulados. Si tienes un token de la API de X, puedo integrarlo aquí.
        </p>
      </div>
    </div>
  )
}
