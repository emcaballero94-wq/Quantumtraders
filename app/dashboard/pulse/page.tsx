'use client'

import { useEffect, useMemo, useState } from 'react'
import { SectionTitle } from '@/components/ui/SectionTitle'
import type { CurrencyStrength } from '@/lib/oracle/types'

interface OracleStateResponse {
  success: boolean
  data?: {
    currencyStrength: CurrencyStrength[]
  }
}

interface QuoteItem {
  symbol: string
  price: number | null
  changePct: number | null
  high: number | null
  low: number | null
}

interface QuoteResponse {
  quotes: QuoteItem[]
}

interface HistoryResponseItem {
  close: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function riskRegimeFromVix(vix: number | null): { score: number; label: string; color: string } {
  if (vix === null) return { score: 50, label: 'Sin dato', color: 'text-ink-muted' }
  const score = clamp(Math.round(((45 - vix) / 35) * 100), 0, 100)
  if (score >= 70) return { score, label: 'Risk-On', color: 'text-atlas' }
  if (score <= 35) return { score, label: 'Risk-Off', color: 'text-bear' }
  return { score, label: 'Neutral', color: 'text-oracle' }
}

export default function PulsePage() {
  const [currencyStrength, setCurrencyStrength] = useState<CurrencyStrength[]>([])
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({})
  const [dxyStats, setDxyStats] = useState<{ min: number | null; max: number | null }>({ min: null, max: null })
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const [statePayload, quotePayload, dxyHistory] = await Promise.all([
          fetch('/api/oracle/state').then((response) => response.json() as Promise<OracleStateResponse>),
          fetch('/api/market/quote?symbols=DXY,VIX,SP500,NASDAQ,BTCUSD').then((response) => response.json() as Promise<QuoteResponse>),
          fetch('/api/market/history?symbol=DXY&interval=1h&outputsize=180').then((response) => response.json() as Promise<HistoryResponseItem[]>),
        ])
        if (!mounted) return

        setCurrencyStrength(statePayload?.data?.currencyStrength ?? [])
        const quoteMap: Record<string, QuoteItem> = {}
        for (const item of quotePayload?.quotes ?? []) quoteMap[item.symbol] = item
        setQuotes(quoteMap)

        const closes = (Array.isArray(dxyHistory) ? dxyHistory : [])
          .map((item) => item.close)
          .filter((value): value is number => Number.isFinite(value))
        setDxyStats({
          min: closes.length > 0 ? Math.min(...closes) : null,
          max: closes.length > 0 ? Math.max(...closes) : null,
        })
        setLastUpdated(new Date().toISOString())
      } catch {
        if (!mounted) return
        setCurrencyStrength([])
      }
    }

    fetchData()
    const timer = setInterval(fetchData, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const strongest = currencyStrength[0] ?? null
  const weakest = currencyStrength[currencyStrength.length - 1] ?? null
  const vix = quotes.VIX?.price ?? null
  const riskRegime = riskRegimeFromVix(vix)
  const dxy = quotes.DXY

  const indices = useMemo(
    () => ['DXY', 'SP500', 'NASDAQ', 'BTCUSD'].map((symbol) => quotes[symbol]).filter(Boolean) as QuoteItem[],
    [quotes],
  )

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between border border-bg-border bg-bg-card rounded-xl px-5 py-3">
        <div className="flex items-center gap-4">
          <span className="font-mono font-bold text-ink-primary text-xs tracking-wider">PULSE · Live Regime</span>
          <span className="text-ink-muted text-xs font-mono">
            {lastUpdated ? `Actualizado ${new Date(lastUpdated).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : 'Inicializando feed'}
          </span>
        </div>
        <div className={`text-xs font-bold font-mono ${riskRegime.color}`}>{riskRegime.label} ({riskRegime.score})</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle label="RISK METER (VIX)" />
            <span className="text-[10px] font-mono text-ink-dim">Fuente: Yahoo Finance</span>
          </div>
          <div className="space-y-3">
            <div className="w-full h-3 bg-bg-elevated rounded-full overflow-hidden">
              <div className={`h-full ${riskRegime.score >= 70 ? 'bg-atlas' : riskRegime.score <= 35 ? 'bg-bear' : 'bg-oracle'}`} style={{ width: `${riskRegime.score}%` }} />
            </div>
            <p className="text-xs font-mono text-ink-secondary">
              VIX: <span className="text-ink-primary font-bold">{vix?.toFixed(2) ?? '--'}</span> · Régimen: <span className={riskRegime.color}>{riskRegime.label}</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-bg-border bg-bg-card p-6 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <SectionTitle label="DXY CONTEXTO" />
            <span className="text-[10px] font-mono text-ink-dim">1H · 30D</span>
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-mono font-bold text-ink-primary">
              {dxy?.price?.toFixed(2) ?? '--'}
              <span className={`text-sm ml-2 ${(dxy?.changePct ?? 0) >= 0 ? 'text-atlas' : 'text-bear'}`}>
                {dxy?.changePct !== null && dxy?.changePct !== undefined ? `${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct.toFixed(2)}%` : '--'}
              </span>
            </p>
            <p className="text-[10px] font-mono text-ink-muted">
              Min 30D: {dxyStats.min?.toFixed(2) ?? '--'} · Max 30D: {dxyStats.max?.toFixed(2) ?? '--'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 space-y-6">
          <div className="flex justify-between items-center">
            <SectionTitle label="RANKING DE FUERZA" />
            <span className="text-[10px] font-mono text-ink-dim uppercase">Derivado de FX en tiempo real</span>
          </div>
          <div className="space-y-4 pt-2">
            {currencyStrength.map((item, index) => {
              const normalized = clamp(Math.round(((item.score + 100) / 200) * 100), 0, 100)
              return (
                <div key={item.currency} className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-ink-muted font-bold w-4">#{index + 1}</span>
                  <span className="text-ink-primary font-bold w-10">{item.currency}</span>
                  <div className="flex-1 bg-bg-elevated h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${item.score >= 0 ? 'bg-atlas' : 'bg-bear'}`} style={{ width: `${normalized}%` }} />
                  </div>
                  <span className={`w-12 text-right font-bold ${item.score >= 0 ? 'text-atlas' : 'text-bear'}`}>{item.score}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <SectionTitle label="ASSET SNAPSHOT" />
          <div className="space-y-3 pt-2">
            {indices.map((item) => (
              <div key={item.symbol} className="flex items-center justify-between p-4 bg-bg-card border border-bg-border rounded-lg">
                <div className="flex flex-col">
                  <span className="text-sm font-bold font-mono uppercase text-ink-primary">{item.symbol}</span>
                  <span className="text-[10px] font-mono text-ink-dim">Precio vivo</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-lg font-mono font-bold text-ink-primary">{item.price?.toFixed(item.symbol.includes('JPY') ? 3 : item.symbol === 'BTCUSD' ? 0 : 2) ?? '--'}</span>
                  <span className={`text-xs font-mono ${(item.changePct ?? 0) >= 0 ? 'text-atlas' : 'text-bear'}`}>
                    {item.changePct !== null && item.changePct !== undefined ? `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%` : '--'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-oracle/30 bg-bg-card p-6 border-l-4 border-l-oracle space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-oracle uppercase font-bold tracking-widest">Lectura del Oraculo</span>
        </div>
        <p className="text-sm font-mono text-ink-primary leading-relaxed">
          {strongest && weakest
            ? `${strongest.currency} es la divisa mas fuerte (${strongest.score}) y ${weakest.currency} la mas debil (${weakest.score}). La divergencia de ${Math.abs(strongest.score - weakest.score)} puntos sugiere vigilar pares cruzados entre ambas.`
            : 'Esperando datos de fuerza de divisas para generar lectura contextual.'}
        </p>
      </div>
    </div>
  )
}
