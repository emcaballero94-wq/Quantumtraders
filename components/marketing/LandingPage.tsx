'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { useLocale } from '@/lib/i18n/LocaleProvider'

const COPY = {
  en: {
    badge: 'PRIVATE BETA · TERMINAL, SCANNER, TRADE AUDIT & ACADEMY',
    h1a: 'THE COMMAND CENTER FOR TRADERS WHO WANT',
    h1b: 'PROCESS, NOT NOISE.',
    sub: 'Quantum Traders puts market intelligence, a real trade audit, a structured roadmap, and a live terminal in one system. Not another signals app — your actual workflow.',
    ctaPrimary: 'ENTER TERMINAL',
    ctaSecondary: 'VIEW ROADMAP',
    login: 'LOG IN',
    beta: 'VIEW BETA',
    features: [
      { tag: 'SCANNER', title: 'Daily market context', desc: 'Bias, sessions, volatility, and setups worth watching — scanned across the instruments you trade, updated live.' },
      { tag: 'TRADE AUDIT', title: 'Your history, audited', desc: 'Win rate, profit factor, R-multiple, execution flags, and real behavioral patterns — computed from your own trades, not a diary.' },
      { tag: 'ACADEMY', title: 'A structured roadmap', desc: 'Foundation, execution & risk, professional edge — levels with real exams and certification, not video playlists.' },
    ],
    referenceLive: 'LIVE OPERATING SYSTEM',
    referenceView: 'REFERENCE VIEW',
    mobileReady: 'MOBILE READY',
    scannerBrief: 'SCANNER · DAILY BRIEF',
    biasTitle: "TODAY'S BIAS + EVENTS",
    auditPanel: 'TRADE AUDIT',
    auditItems: ['Win rate & profit factor', 'R-multiple per trade', 'Execution consistency flags', 'Behavioral pattern detection'],
    systemMap: 'SYSTEM MAP',
    grid: [
      { label: 'ATLAS', desc: 'Live charts & structure' },
      { label: 'NEXUS', desc: 'Correlations & DXY' },
      { label: 'GEX', desc: 'Gamma exposure' },
      { label: 'PULSE', desc: 'Risk & calendar' },
      { label: 'ROADMAP', desc: 'Levels & certification' },
      { label: 'MANDO', desc: 'Command cockpit' },
    ],
  },
  es: {
    badge: 'BETA PRIVADA · TERMINAL, SCANNER, TRADE AUDIT Y ACADEMIA',
    h1a: 'EL CENTRO DE CONTROL PARA TRADERS QUE QUIEREN',
    h1b: 'PROCESO, NO RUIDO.',
    sub: 'Quantum Traders une inteligencia de mercado, una auditoría real de tus operaciones, una ruta estructurada y una terminal en vivo en un solo sistema. No es otra app de señales — es tu forma de trabajar.',
    ctaPrimary: 'ENTRAR A LA TERMINAL',
    ctaSecondary: 'VER RUTA',
    login: 'INICIAR SESIÓN',
    beta: 'VER BETA',
    features: [
      { tag: 'SCANNER', title: 'Contexto diario de mercado', desc: 'Sesgo, sesiones, volatilidad y setups a vigilar — escaneado sobre los instrumentos que operas, actualizado en vivo.' },
      { tag: 'TRADE AUDIT', title: 'Tu historial, auditado', desc: 'Win rate, profit factor, R-multiple, señales de ejecución y patrones de conducta reales — calculado sobre tus propias operaciones, no un diario.' },
      { tag: 'ACADEMY', title: 'Una ruta estructurada', desc: 'Fundamentos, ejecución y riesgo, edge profesional — niveles con exámenes reales y certificación, no listas de videos.' },
    ],
    referenceLive: 'SISTEMA EN VIVO',
    referenceView: 'VISTA DE REFERENCIA',
    mobileReady: 'LISTO PARA MÓVIL',
    scannerBrief: 'SCANNER · BRIEF DIARIO',
    biasTitle: 'SESGO DEL DÍA + EVENTOS',
    auditPanel: 'TRADE AUDIT',
    auditItems: ['Win rate y profit factor', 'R-multiple por operación', 'Señales de consistencia', 'Detección de patrones de conducta'],
    systemMap: 'MAPA DEL SISTEMA',
    grid: [
      { label: 'ATLAS', desc: 'Gráficos y estructura' },
      { label: 'NEXUS', desc: 'Correlaciones y DXY' },
      { label: 'GEX', desc: 'Gamma exposure' },
      { label: 'PULSE', desc: 'Riesgo y calendario' },
      { label: 'ROADMAP', desc: 'Niveles y certificación' },
      { label: 'MANDO', desc: 'Cockpit de comando' },
    ],
  },
} as const

export function LandingPage() {
  const { locale, setLocale } = useLocale()
  const t = COPY[locale]

  return (
    <div className="min-h-screen bg-bg-base text-ink-primary">
      {/* ── Nav ── */}
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-bg-border">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-md bg-oracle-dim border border-oracle/25">
            <span className="text-oracle text-xs font-mono font-bold">QT</span>
          </div>
          <div className="leading-none">
            <p className="text-[11px] font-mono font-bold tracking-[0.18em] uppercase">Quantum Traders</p>
            <p className="text-[9px] font-mono text-ink-muted tracking-[0.2em] uppercase mt-0.5">Trading Terminal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 mr-2">
            {(['en', 'es'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={clsx(
                  'px-2 py-1 rounded text-[9px] font-mono font-semibold uppercase transition-colors',
                  locale === code ? 'bg-oracle/15 text-oracle border border-oracle/30' : 'text-ink-dim hover:text-ink-muted border border-transparent'
                )}
              >
                {code}
              </button>
            ))}
          </div>
          <Link href="/login" className="text-[10px] font-mono text-ink-muted hover:text-ink-primary uppercase tracking-wider transition-colors">
            {t.login}
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-oracle/30 bg-oracle/10 text-oracle text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-oracle/20 transition-colors"
          >
            {t.beta}
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-10 py-14 grid grid-cols-1 xl:grid-cols-[1fr_480px] gap-10 items-start">
        <div>
          <span className="inline-block px-3 py-1.5 rounded-full border border-atlas/30 bg-atlas/8 text-atlas text-[10px] font-mono uppercase tracking-widest">
            {t.badge}
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-mono font-bold tracking-tight leading-[1.1] mt-6">
            {t.h1a}
            <br />
            <span className="text-oracle">{t.h1b}</span>
          </h1>

          <p className="text-sm font-mono text-ink-muted mt-6 max-w-xl leading-relaxed">
            {t.sub}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-lg bg-oracle text-bg-base text-xs font-mono font-bold uppercase tracking-widest hover:bg-oracle/90 transition-colors"
            >
              {t.ctaPrimary}
            </Link>
            <Link
              href="/dashboard/courses"
              className="px-6 py-3 rounded-lg border border-bg-border bg-bg-card text-ink-secondary text-xs font-mono font-bold uppercase tracking-widest hover:border-oracle/30 transition-colors"
            >
              {t.ctaSecondary}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
            {t.features.map((feature) => (
              <div key={feature.tag} className="rounded-xl border border-bg-border bg-bg-card glass-card p-4 space-y-2">
                <span className="inline-block px-2 py-0.5 rounded border border-oracle/25 bg-oracle/8 text-oracle text-[9px] font-mono font-bold uppercase tracking-widest">
                  {feature.tag}
                </span>
                <p className="text-xs font-mono font-bold text-ink-primary">{feature.title}</p>
                <p className="text-[11px] font-mono text-ink-dim leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Reference mockup panel ── */}
        <div className="rounded-2xl border border-bg-border bg-bg-card glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">{t.referenceLive}</p>
              <p className="text-xs font-mono font-bold text-ink-primary uppercase mt-0.5">{t.referenceView}</p>
            </div>
            <span className="px-2 py-1 rounded-full border border-atlas/30 bg-atlas/8 text-atlas text-[8.5px] font-mono uppercase tracking-wider">
              {t.mobileReady}
            </span>
          </div>

          <div className="rounded-xl border border-bg-border bg-bg-elevated/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">{t.scannerBrief}</p>
              <span className="w-1.5 h-1.5 rounded-full bg-atlas animate-pulse-slow" />
            </div>
            <p className="text-[11px] font-mono font-bold text-ink-primary">{t.biasTitle}</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { sym: 'XAUUSD', bias: 'BULLISH', color: 'text-atlas' },
                { sym: 'SPX500', bias: 'NEUTRAL', color: 'text-pulse' },
                { sym: 'NVDA', bias: 'BEARISH', color: 'text-bear' },
              ].map((row) => (
                <div key={row.sym} className="rounded-lg border border-bg-border bg-bg-card p-2">
                  <p className="text-[8.5px] font-mono text-ink-dim">{row.sym}</p>
                  <p className={clsx('text-[10px] font-mono font-bold', row.color)}>{row.bias}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-bg-border bg-bg-elevated/30 p-4 space-y-2">
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">{t.auditPanel}</p>
            <div className="space-y-1.5">
              {t.auditItems.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-oracle shrink-0" />
                  <span className="text-[10px] font-mono text-ink-secondary">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-mono text-ink-dim uppercase tracking-wider">{t.systemMap}</p>
            <div className="grid grid-cols-3 gap-2">
              {t.grid.map((cell) => (
                <div key={cell.label} className="rounded-lg border border-bg-border bg-bg-elevated/20 p-2.5 hover:border-oracle/25 transition-colors">
                  <p className="text-[9px] font-mono font-bold text-oracle">{cell.label}</p>
                  <p className="text-[8.5px] font-mono text-ink-dim mt-0.5 leading-tight">{cell.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
