'use client'

import { useState, useEffect } from 'react'
import { clsx } from 'clsx'

interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  publishedAt: string
  source: string
  category: 'forex' | 'commodities' | 'macro' | 'crypto' | 'general'
  symbols: string[]
}

const CATEGORY_STYLES: Record<string, string> = {
  forex:       'bg-atlas/10 border-atlas/30 text-atlas',
  commodities: 'bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]',
  macro:       'bg-oracle/10 border-oracle/30 text-oracle',
  crypto:      'bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-[#8b5cf6]',
  general:     'bg-bg-elevated border-bg-border text-ink-muted',
}

const CATEGORY_LABEL: Record<string, string> = {
  forex:       'FX',
  commodities: 'COMM',
  macro:       'MACRO',
  crypto:      'CRYPTO',
  general:     'NEWS',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

interface MarketNewsPanelProps {
  filterSymbols?: string[]
  compact?: boolean
}

export function MarketNewsPanel({ filterSymbols = [], compact = false }: MarketNewsPanelProps) {
  const [news, setNews]           = useState<NewsItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [activeFilter, setFilter] = useState<string>('all')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchNews = async () => {
    try {
      const symbolsQuery = filterSymbols.length > 0 ? `&symbols=${filterSymbols.join(',')}` : ''
      const res  = await fetch(`/api/market/news?limit=40${symbolsQuery}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNews(data.news ?? [])
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNews()
    const t = setInterval(fetchNews, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(t)
  }, [filterSymbols.join(',')])

  const categories = ['all', 'forex', 'macro', 'commodities', 'crypto']
  const filtered = activeFilter === 'all' ? news : news.filter(n => n.category === activeFilter)

  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl overflow-hidden glass-card flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-bg-border flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-xs font-mono font-bold text-ink-primary uppercase tracking-wider">
              Market Intelligence
            </h3>
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">
              ForexLive · Yahoo Finance · DailyFX · MarketWatch
            </p>
          </div>
          {lastUpdated && (
            <span className="text-[9px] font-mono text-ink-dim">
              Act. {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {loading && (
            <div className="w-3 h-3 border border-atlas border-t-transparent rounded-full animate-spin" />
          )}
          <button
            onClick={fetchNews}
            className="p-1.5 rounded hover:bg-bg-elevated transition-colors"
            title="Actualizar noticias"
          >
            <svg className="w-3 h-3 text-ink-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="px-4 py-2 border-b border-bg-border flex items-center gap-1 shrink-0 overflow-x-auto">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={clsx(
              'px-2.5 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all whitespace-nowrap border',
              activeFilter === cat
                ? 'bg-oracle/20 border-oracle/40 text-oracle'
                : 'border-transparent text-ink-dim hover:text-ink-muted hover:border-bg-border'
            )}
          >
            {cat === 'all' ? `⊕ Todo (${news.length})` : CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {/* News List */}
      <div className="flex-1 overflow-y-auto divide-y divide-bg-border/50 scrollbar-thin">
        {loading && news.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-oracle border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-mono text-ink-dim uppercase">Cargando noticias...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-[10px] font-mono text-bear uppercase">Error: {error}</p>
            <button onClick={fetchNews} className="mt-2 text-[9px] font-mono text-atlas uppercase hover:underline">
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[10px] font-mono text-ink-dim uppercase">Sin noticias en esta categoría</p>
          </div>
        ) : (
          filtered.map((item, i) => (
            <NewsRow key={item.id} item={item} index={i} compact={compact} />
          ))
        )}
      </div>
    </div>
  )
}

function NewsRow({ item, index, compact }: { item: NewsItem; index: number; compact: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={clsx(
        'group cursor-pointer transition-all hover:bg-bg-elevated/50',
        index === 0 && 'animate-fade-in',
        compact ? 'px-4 py-2.5' : 'px-5 py-3.5'
      )}
      onClick={() => {
        if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer')
        else setExpanded(e => !e)
      }}
    >
      <div className="flex items-start gap-3">
        {/* Left: time + category */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 w-10">
          <span className="text-[9px] font-mono text-ink-dim tabular-nums">
            {timeAgo(item.publishedAt)}
          </span>
          <span className={clsx(
            'text-[8px] font-mono font-bold px-1 py-0.5 rounded border uppercase tracking-wider',
            CATEGORY_STYLES[item.category]
          )}>
            {CATEGORY_LABEL[item.category]}
          </span>
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0">
          <p className={clsx(
            'font-mono text-ink-secondary group-hover:text-ink-primary transition-colors leading-snug',
            compact ? 'text-[10px]' : 'text-[11px]'
          )}>
            {item.title}
          </p>

          {!compact && item.summary && (
            <p className="text-[9px] font-mono text-ink-dim mt-1 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
              {item.summary}
            </p>
          )}

          {/* Source + Symbols */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[8px] font-mono text-ink-dim uppercase">{item.source}</span>
            {item.symbols.map(sym => (
              <span
                key={sym}
                className="text-[8px] font-mono px-1 rounded bg-bg-elevated border border-bg-border text-ink-muted"
              >
                {sym}
              </span>
            ))}
            {item.url && (
              <svg className="w-2.5 h-2.5 text-ink-dim group-hover:text-atlas transition-colors ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
