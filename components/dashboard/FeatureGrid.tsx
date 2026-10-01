import Link from 'next/link'
import {
  ScannerIcon,
  AtlasIcon,
  NexusIcon,
  OrderFlowIcon,
  OptionsIcon,
  GexIcon,
  PulseIcon,
  MindIcon,
  ToolsIcon,
  CoursesIcon,
} from '@/components/layout/Sidebar'

interface FeatureCardDef {
  href: string
  icon: (p: { cls: string }) => React.ReactElement
  chipBg: string
  chipText: string
  title: string
  description: string
  /** Only set for pages that already have a Tour — see lib/tour/use-tour.ts. */
  tourHref?: string
}

// One card per major feature, each linking straight into the page — and, for
// pages that already have an interactive tour (see components/tour/Tour.tsx),
// a second link that force-starts it via `?tour=<id>` even for a browser that
// already marked it seen.
const FEATURES: FeatureCardDef[] = [
  {
    href: '/dashboard/gex',
    icon: GexIcon,
    chipBg: 'bg-nexus/10',
    chipText: 'text-nexus',
    title: 'GEX — Gamma Exposure',
    description: 'Perfil y mapa de calor de dealer gamma, más un brief de IA que cruza datos con Order Flow para BTC/ETH.',
    tourHref: '/dashboard/gex?tour=gex',
  },
  {
    href: '/dashboard/orderflow',
    icon: OrderFlowIcon,
    chipBg: 'bg-atlas/10',
    chipText: 'text-atlas',
    title: 'Order Flow',
    description: 'Profundidad de mercado en vivo, CVD, liquidaciones y M.A.N.U. analizando todo en tiempo real.',
  },
  {
    href: '/dashboard/options',
    icon: OptionsIcon,
    chipBg: 'bg-oracle/10',
    chipText: 'text-oracle',
    title: 'Options',
    description: 'Cadena de opciones con griegas — acciones vía Tradier, cripto vía Deribit.',
  },
  {
    href: '/dashboard/atlas',
    icon: AtlasIcon,
    chipBg: 'bg-atlas/10',
    chipText: 'text-atlas',
    title: 'Charts',
    description: 'Gráficos en vivo con múltiples timeframes para tu watchlist.',
  },
  {
    href: '/dashboard/nexus',
    icon: NexusIcon,
    chipBg: 'bg-nexus/10',
    chipText: 'text-nexus',
    title: 'Correlations',
    description: 'Cómo se mueven los activos entre sí — el DXY, el oro, los índices.',
  },
  {
    href: '/dashboard/scanner',
    icon: ScannerIcon,
    chipBg: 'bg-oracle/10',
    chipText: 'text-oracle',
    title: 'Scanner',
    description: 'Brief diario y escaneo de condiciones técnicas sobre tu lista de activos.',
  },
  {
    href: '/dashboard/pulse',
    icon: PulseIcon,
    chipBg: 'bg-pulse/10',
    chipText: 'text-pulse',
    title: 'Market State',
    description: 'Régimen de mercado y contexto macro — qué está pasando y por qué.',
  },
  {
    href: '/dashboard/tools',
    icon: ToolsIcon,
    chipBg: 'bg-ink-muted/10',
    chipText: 'text-ink-secondary',
    title: 'Trade Audit',
    description: 'Registrá tus operaciones y revisá tu historial con ayuda de IA.',
  },
  {
    href: '/dashboard/mind',
    icon: MindIcon,
    chipBg: 'bg-atlas/10',
    chipText: 'text-atlas',
    title: 'Mind',
    description: 'Psicología del trading — hábitos, sesgos y disciplina.',
  },
  {
    href: '/dashboard/courses',
    icon: CoursesIcon,
    chipBg: 'bg-oracle/10',
    chipText: 'text-oracle',
    title: 'Academia',
    description: 'Ruta de principiante a trader sistemático, con certificación verificable.',
  },
]

export function FeatureGrid() {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-ink-secondary">Explorar</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {FEATURES.map((feature) => (
          <div
            key={feature.href}
            className="rounded-xl border border-bg-border bg-bg-card px-5 py-4 flex flex-col gap-3 hover:border-ink-muted transition-colors"
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${feature.chipBg}`}>
              <feature.icon cls={`w-[18px] h-[18px] ${feature.chipText}`} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-sans font-semibold text-ink-primary">{feature.title}</p>
              <p className="text-xs font-sans leading-relaxed text-ink-secondary">{feature.description}</p>
            </div>
            <div className="mt-auto flex items-center gap-3.5 pt-1">
              <Link href={feature.href} className="text-xs font-sans font-medium text-pulse hover:text-pulse/80 transition-colors">
                Abrir →
              </Link>
              {feature.tourHref && (
                <Link
                  href={feature.tourHref}
                  className="text-[10px] font-mono uppercase tracking-wider text-ink-dim hover:text-oracle transition-colors"
                >
                  Ver tutorial
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
