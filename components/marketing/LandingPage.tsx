'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { Sparkline } from '@/components/ui/Sparkline'
import { RotatingGlobe } from '@/components/marketing/RotatingGlobe'
import { HeroSpaceBackground } from '@/components/marketing/HeroSpaceBackground'
import { getActiveSessions } from '@/lib/oracle/timing-engine'

interface QuoteItem {
  symbol: string
  price: number | null
  changePct: number | null
}
interface QuoteResponse {
  quotes: QuoteItem[]
}
interface HistoryPoint {
  close: number
}

const CARD_SYMBOLS = ['SPX500', 'XAUUSD']
const TICKER_SYMBOLS = ['SPX500', 'NAS100', 'US30', 'XAUUSD', 'BTCUSD', 'VIX']

const COPY = {
  en: {
    live: 'LIVE',
    open: 'open',
    allClosed: 'All sessions closed',
    h1a: 'Decisions built on data.',
    h1b: 'Not emotion.',
    sub: 'The market intelligence terminal that gives you context, signals and tools to trade with clarity, precision and discipline.',
    ctaPrimary: 'Enter the terminal',
    ctaSecondary: 'See the platform',
    login: 'Log in',
    tagline: 'Market Intelligence Terminal',
    features: [
      { title: 'Market analysis', desc: 'Macro context, regime, volatility and opportunities in real time.' },
      { title: 'Analysis tools', desc: 'Scanner, charts, correlations, gamma and more.' },
      { title: 'Risk management', desc: 'Calculators, exposure, limits and capital control.' },
      { title: 'Trade journal', desc: 'Audit your execution, spot patterns and keep improving.' },
      { title: 'Education', desc: 'From the basics to advanced and algorithmic trading.' },
    ],
    showcase: {
      command: 'COMMAND', markets: 'MARKETS', risk: 'RISK', tools: 'TOOLS', journal: 'JOURNAL', learn: 'LEARN', account: 'ACCOUNT',
      marketState: 'MARKET STATE',
      regime: 'Regime', volatility: 'Volatility', bias: 'Bias', drawdown: 'Drawdown',
      trending: 'Trending', bullish: 'Bullish',
      keyMarkets: 'KEY MARKETS', topOpportunities: 'TOP OPPORTUNITIES',
      aiBrief: 'AI MARKET BRIEF',
      briefText: 'US indices hold a slight bullish bias short-term. Volatility stays contained while XAUUSD shows relative strength. Macro context remains favorable for risk assets, watch inflation data.',
    },
    advantage: {
      kicker: 'YOUR EDGE',
      title: 'Real information. In one place.',
      desc: 'Quantum Traders OS combines market intelligence, technical analysis and risk management tools so you make better decisions, faster.',
      stats: [
        { value: '6', label: 'CORE MARKETS' },
        { value: '24/7', label: 'REAL-TIME ANALYSIS' },
        { value: '1', label: 'TERMINAL, ALL-IN-ONE' },
      ],
      tagline: "THE MARKET DOESN'T WAIT. NEITHER DO YOU.",
    },
  },
  es: {
    live: 'EN VIVO',
    open: 'abiertos',
    allClosed: 'Todas las sesiones cerradas',
    h1a: 'Decisiones basadas en datos.',
    h1b: 'No en emociones.',
    sub: 'El terminal de inteligencia de mercado que te da contexto, señales y herramientas para operar con claridad, precisión y disciplina.',
    ctaPrimary: 'Acceder al terminal',
    ctaSecondary: 'Ver la plataforma',
    login: 'Ingresar',
    tagline: 'Market Intelligence Terminal',
    features: [
      { title: 'Análisis de mercado', desc: 'Contexto macro, régimen, volatilidad y oportunidades en tiempo real.' },
      { title: 'Herramientas', desc: 'Scanner, gráficos, correlaciones, gamma y más.' },
      { title: 'Gestión de riesgo', desc: 'Calculadoras, exposición, límites y control de capital.' },
      { title: 'Registro de trades', desc: 'Audita tu ejecución, detecta patrones y mejora.' },
      { title: 'Educación', desc: 'De lo básico al trading avanzado y algorítmico.' },
    ],
    showcase: {
      command: 'COMMAND', markets: 'MARKETS', risk: 'RISK', tools: 'TOOLS', journal: 'JOURNAL', learn: 'LEARN', account: 'ACCOUNT',
      marketState: 'MARKET STATE',
      regime: 'Regime', volatility: 'Volatility', bias: 'Bias', drawdown: 'Drawdown',
      trending: 'Trending', bullish: 'Bullish',
      keyMarkets: 'KEY MARKETS', topOpportunities: 'TOP OPORTUNIDADES',
      aiBrief: 'AI MARKET BRIEF',
      briefText: 'Los índices de EE.UU. mantienen un sesgo positivo a corto plazo. La volatilidad se mantiene estable mientras XAUUSD muestra fuerza relativa. El contexto macro sigue siendo favorable para activos de riesgo, con atención a los datos de inflación.',
    },
    advantage: {
      kicker: 'TU VENTAJA',
      title: 'Información real. En un solo lugar.',
      desc: 'Quantum Traders OS combina inteligencia de mercado, análisis técnico y herramientas de gestión para que tomes mejores decisiones, más rápido.',
      stats: [
        { value: '6', label: 'MERCADOS PRINCIPALES' },
        { value: '24/7', label: 'ANÁLISIS EN TIEMPO REAL' },
        { value: '1', label: 'TERMINAL TODO EN UNO' },
      ],
      tagline: 'EL MERCADO NO ESPERA. TU TAMPOCO.',
    },
  },
} as const

function fmtPrice(symbol: string, v: number | null | undefined) {
  if (v == null) return '—'
  const d = symbol === 'BTCUSD' ? 0 : 2
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtChg(v: number | null | undefined) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function HeroDataCard({ symbol, quote, history }: { symbol: string; quote: QuoteItem | undefined; history: number[] }) {
  const up = (quote?.changePct ?? 0) >= 0
  return (
    <div className="w-[150px] rounded-[10px] border border-bg-border bg-bg-card/85 backdrop-blur-md px-3.5 py-3 space-y-1.5">
      <p className="text-[10px] font-mono text-ink-secondary">{symbol}</p>
      <p className={clsx('text-base font-mono tabular-nums', up ? 'text-atlas' : 'text-bear')}>{fmtChg(quote?.changePct)}</p>
      <Sparkline values={history} up={up} />
    </div>
  )
}

export function LandingPage() {
  const { locale, setLocale } = useLocale()
  const t = COPY[locale]
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({})
  const [histories, setHistories] = useState<Record<string, number[]>>({})
  const [sessions, setSessions] = useState(() => getActiveSessions())

  useEffect(() => {
    const id = setInterval(() => setSessions(getActiveSessions()), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [quotePayload, ...historyPayloads] = await Promise.all([
          fetch(`/api/market/quote?symbols=${TICKER_SYMBOLS.join(',')}`).then((r) => r.json() as Promise<QuoteResponse>),
          ...CARD_SYMBOLS.map((s) => fetch(`/api/market/history?symbol=${s}&interval=1h&outputsize=24`).then((r) => r.json() as Promise<HistoryPoint[]>)),
        ])
        if (!mounted) return
        const qMap: Record<string, QuoteItem> = {}
        for (const item of quotePayload?.quotes ?? []) qMap[item.symbol] = item
        setQuotes(qMap)
        const hMap: Record<string, number[]> = {}
        CARD_SYMBOLS.forEach((s, i) => {
          hMap[s] = (Array.isArray(historyPayloads[i]) ? historyPayloads[i] : []).map((c) => c.close).filter((v): v is number => Number.isFinite(v))
        })
        setHistories(hMap)
      } catch {
        // hero shows placeholders on failure — no fake numbers
      }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  const activeNames = sessions.filter((s) => s.isActive).map((s) => s.name)
  const sessionLine = activeNames.length > 0 ? `${activeNames.join(locale === 'es' ? ' y ' : ' & ')} ${t.open}` : t.allClosed

  return (
    <div className="min-h-screen bg-bg-deep text-ink-primary overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden min-h-[780px] flex flex-col bg-[radial-gradient(900px_700px_at_78%_45%,rgba(232,180,76,0.22),transparent_70%)]">
        <div className="absolute inset-0 -z-20">
          <HeroSpaceBackground />
        </div>

        {/* Monumental globe, bleeding off the right edge */}
        <div className="absolute -z-10 right-[-60px] top-5 hidden lg:block w-[760px] h-[760px]" aria-hidden>
          <RotatingGlobe size={760} />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg-deep via-bg-deep/85 via-30% to-transparent to-55%" aria-hidden />

        {/* Nav */}
        <header className="flex items-center justify-between px-6 md:px-14 py-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-oracle/12 border border-oracle/40">
              <span className="text-oracle text-xs font-mono font-bold">QT</span>
            </div>
            <div className="leading-none space-y-[3px]">
              <p className="text-xs font-mono font-bold tracking-[0.18em] uppercase">Quantum Traders OS</p>
              <p className="text-[9px] font-mono text-ink-secondary tracking-[0.18em] uppercase">{t.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
              {(['es', 'en'] as const).map((code, i) => (
                <span key={code} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-ink-muted">/</span>}
                  <button
                    type="button"
                    onClick={() => setLocale(code)}
                    className={clsx('uppercase transition-colors', locale === code ? 'text-ink-primary' : 'text-ink-secondary hover:text-ink-primary')}
                  >
                    {code}
                  </button>
                </span>
              ))}
            </div>
            <Link
              href="/login"
              className="text-sm font-sans text-ink-primary border border-bg-border bg-bg-card/60 px-4 py-2 rounded-lg hover:border-oracle/40 transition-colors"
            >
              {t.login}
            </Link>
          </div>
        </header>

        {/* Headline */}
        <div className="relative px-6 md:px-14 pt-16 md:pt-24 pb-40 max-w-[780px] flex flex-col gap-7">
          <span className="self-start flex items-center gap-2 px-3 py-1.5 rounded-full border border-bg-border bg-bg-card/70 text-xs font-mono tracking-[0.14em] text-ink-secondary">
            <span className="w-[7px] h-[7px] rounded-full bg-atlas shadow-[0_0_10px_#10B981]" />
            <span className="text-atlas">{t.live}</span>
            <span>· {sessionLine}</span>
          </span>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-[80px] font-bold leading-[1.02] tracking-[-0.035em]">
            {t.h1a}
            <br />
            <span className="bg-gradient-to-r from-oracle to-[#F5CD7E] bg-clip-text text-transparent">{t.h1b}</span>
          </h1>
          <p className="text-lg lg:text-[19px] font-sans leading-relaxed text-ink-secondary max-w-[560px] text-pretty">{t.sub}</p>
          <div className="flex flex-wrap items-center gap-3.5 pt-1.5">
            <Link
              href="/login"
              className="text-[15px] font-sans font-semibold text-white bg-oracle hover:bg-oracle/90 px-6 py-4 rounded-[10px] shadow-[0_10px_40px_rgba(232,180,76,0.35)] transition-colors"
            >
              {t.ctaPrimary} →
            </Link>
            <a
              href="#showcase"
              className="flex items-center gap-2.5 text-[15px] font-sans text-ink-primary px-5 py-4 rounded-[10px] border border-bg-border bg-bg-card/60 hover:border-ink-muted transition-colors"
            >
              <span className="w-[22px] h-[22px] rounded-full border border-ink-muted flex items-center justify-center text-[9px]">▶</span>
              {t.ctaSecondary}
            </a>
          </div>
        </div>

        {/* Floating live cards around the globe */}
        <div className="absolute right-[500px] top-[130px] hidden xl:block">
          <HeroDataCard symbol="SPX500" quote={quotes.SPX500} history={histories.SPX500 ?? []} />
        </div>
        <div className="absolute right-12 top-[470px] hidden xl:block">
          <HeroDataCard symbol="XAUUSD" quote={quotes.XAUUSD} history={histories.XAUUSD ?? []} />
        </div>

        {/* Live ticker strip */}
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-bg-border bg-bg-deep/80 backdrop-blur-md">
          {TICKER_SYMBOLS.map((symbol) => {
            const q = quotes[symbol]
            const up = (q?.changePct ?? 0) >= 0
            return (
              <div key={symbol} className="flex items-baseline justify-between gap-3 px-6 py-4 border-r border-bg-border font-mono">
                <span className="text-xs text-ink-secondary">{symbol}</span>
                <span className="text-sm text-ink-primary tabular-nums">{fmtPrice(symbol, q?.price)}</span>
                <span className={clsx('text-xs tabular-nums', up ? 'text-atlas' : 'text-bear')}>{fmtChg(q?.changePct)}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Numbered features ── */}
      <section className="px-6 md:px-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {t.features.map((feature, i) => (
          <div
            key={feature.title}
            className={clsx('pt-11 pb-12 pr-7 space-y-3 border-t-2', i === 0 ? 'border-oracle' : 'border-bg-border')}
          >
            <p className="text-xs font-mono text-oracle">{String(i + 1).padStart(2, '0')}</p>
            <p className="text-lg font-sans font-semibold text-ink-primary">{feature.title}</p>
            <p className="text-sm font-sans leading-relaxed text-ink-secondary text-pretty">{feature.desc}</p>
          </div>
        ))}
      </section>

      {/* ── Product showcase ── */}
      <section id="showcase" className="max-w-[1400px] mx-auto px-6 md:px-14 py-16 border-t border-bg-border grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
        <div className="rounded-2xl border border-bg-border bg-bg-card overflow-hidden shadow-2xl">
          <div className="flex">
            <div className="w-32 shrink-0 border-r border-bg-border bg-bg-deep p-3 space-y-3 hidden sm:block">
              <div className="flex items-center gap-1.5 pb-2 border-b border-bg-border">
                <div className="w-5 h-5 rounded bg-oracle-dim border border-oracle/25 flex items-center justify-center">
                  <span className="text-oracle text-[7px] font-mono font-bold">QT</span>
                </div>
                <span className="text-[7px] font-mono text-ink-dim uppercase tracking-wider">Quantum</span>
              </div>
              {[t.showcase.command, t.showcase.markets, t.showcase.risk, t.showcase.tools, t.showcase.journal, t.showcase.learn, t.showcase.account].map((label, i) => (
                <p key={label} className={clsx('text-[8px] font-mono uppercase tracking-wider px-1.5 py-1 rounded', i === 0 ? 'bg-bg-elevated text-ink-primary font-bold' : 'text-ink-dim')}>
                  {label}
                </p>
              ))}
            </div>

            <div className="flex-1 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold text-ink-primary uppercase tracking-wider">{t.showcase.marketState}</span>
                <span className="text-[8px] font-mono text-atlas uppercase px-1.5 py-0.5 rounded bg-atlas/10 border border-atlas/25">Risk-On 86</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  [t.showcase.regime, t.showcase.trending, 'text-oracle'],
                  [t.showcase.volatility, 'VIX 16.8', 'text-ink-primary'],
                  [t.showcase.bias, t.showcase.bullish, 'text-atlas'],
                  [t.showcase.drawdown, '-2.8%', 'text-bear'],
                ].map(([label, value, color]) => (
                  <div key={label} className="rounded-lg border border-bg-border bg-bg-elevated/20 p-2">
                    <p className="text-[7px] font-mono text-ink-dim uppercase">{label}</p>
                    <p className={clsx('text-[9px] font-mono font-bold mt-0.5', color)}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-bg-border bg-bg-elevated/10 p-2.5 space-y-1.5">
                  <p className="text-[7px] font-mono text-ink-dim uppercase tracking-wider">{t.showcase.keyMarkets}</p>
                  {[
                    ['SPX500', '5,612.4', '+0.42%', true],
                    ['NAS100', '19,842.7', '+0.63%', true],
                    ['XAUUSD', '2,624.8', '+0.55%', true],
                  ].map(([sym, price, chg, up]) => (
                    <div key={sym as string} className="flex items-center justify-between text-[8px] font-mono">
                      <span className="text-ink-primary font-bold">{sym}</span>
                      <span className="text-ink-secondary">{price}</span>
                      <span className={up ? 'text-atlas' : 'text-bear'}>{chg}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-bg-border bg-bg-elevated/10 p-2.5 space-y-1.5">
                  <p className="text-[7px] font-mono text-ink-dim uppercase tracking-wider">{t.showcase.topOpportunities}</p>
                  {[
                    ['SPX500', 'Bullish', '0.72'],
                    ['NAS100', 'Bullish', '0.64'],
                    ['XAUUSD', 'Bullish', '0.58'],
                  ].map(([sym, tag, score]) => (
                    <div key={sym as string} className="flex items-center justify-between text-[8px] font-mono">
                      <span className="text-ink-primary font-bold">{sym}</span>
                      <span className="text-atlas">{tag}</span>
                      <span className="text-ink-secondary">{score}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-oracle/25 bg-oracle/5 p-2.5 space-y-1">
                <p className="text-[7px] font-mono text-oracle uppercase tracking-wider font-bold">{t.showcase.aiBrief}</p>
                <p className="text-[8px] font-mono text-ink-secondary leading-relaxed line-clamp-2">{t.showcase.briefText}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <p className="text-[10px] font-mono text-oracle uppercase tracking-[0.25em] font-bold">{t.advantage.kicker}</p>
          <h2 className="font-display text-3xl font-bold text-ink-primary leading-tight">{t.advantage.title}</h2>
          <p className="text-sm font-mono text-ink-muted leading-relaxed max-w-md">{t.advantage.desc}</p>
          <div className="flex items-center gap-8">
            {t.advantage.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-mono font-bold text-ink-primary">{stat.value}</p>
                <p className="text-[9px] font-mono text-ink-dim uppercase tracking-wider mt-1 max-w-[90px]">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-bg-border pt-5">
            <p className="text-[10px] font-mono text-ink-secondary uppercase tracking-[0.2em] font-bold">{t.advantage.tagline}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
