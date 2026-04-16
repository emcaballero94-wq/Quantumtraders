import { analyzeMacro } from '@/lib/oracle/macro-engine'
import { fetchCentralBankRatesFromCalendar, fetchMacroCalendar } from '@/lib/oracle/macro-feed'
import { listOracleAlerts, upsertOracleAlerts } from '@/lib/oracle/persistence'
import { getTopOpportunity, rankAssets, computeOracleScore } from '@/lib/oracle/score-engine'
import { analyzeTechnical } from '@/lib/oracle/technical-engine'
import { analyzeTiming, getActiveKillZones, getActiveSessions } from '@/lib/oracle/timing-engine'
import { scoreSetupFromAsset } from '@/lib/oracle/setup-rules'
import type {
  DailyBrief,
  EconomicEvent,
  OracleAlert,
  OracleState,
  RadarAsset,
  SessionName,
} from '@/lib/oracle/types'
import {
  computeCurrencyStrength,
  detectTrendFromCandles,
  fetchMarketHistory,
  fetchMarketQuotes,
  type MarketQuote,
  resampleCandles,
} from '@/lib/market-data'

interface RadarDefinition {
  symbol: string
  name: string
  category: RadarAsset['category']
}

interface RadarComputation {
  asset: RadarAsset
  alertHint: OracleAlert | null
}

const RADAR_DEFINITIONS: RadarDefinition[] = [
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'metals' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'forex' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'forex' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'forex' },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', category: 'forex' },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'crypto' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', category: 'forex' },
  { symbol: 'EURCAD', name: 'Euro / Canadian Dollar', category: 'forex' },
  { symbol: 'DXY', name: 'US Dollar Index', category: 'indices' },
  { symbol: 'SP500', name: 'S&P 500 Index', category: 'indices' },
  { symbol: 'NASDAQ', name: 'Nasdaq Composite', category: 'indices' },
]

let stateCache: { expiresAt: number; state: OracleState } | null = null
let pendingStatePromise: Promise<OracleState> | null = null

function toSessionName(value?: string): SessionName {
  if (value === 'Sydney' || value === 'Tokyo' || value === 'London' || value === 'New York') return value
  return 'Off'
}

function deriveDxyStrength(changePct: number | null): 'strong' | 'weak' | 'neutral' {
  if (changePct === null) return 'neutral'
  if (changePct >= 0.25) return 'strong'
  if (changePct <= -0.25) return 'weak'
  return 'neutral'
}

function deriveRiskSentiment(sp500ChangePct: number | null, btcChangePct: number | null): 'risk-on' | 'risk-off' | 'mixed' {
  if (sp500ChangePct === null || btcChangePct === null) return 'mixed'
  if (sp500ChangePct > 0 && btcChangePct > 0) return 'risk-on'
  if (sp500ChangePct < 0 && btcChangePct < 0) return 'risk-off'
  return 'mixed'
}

function fallbackRadarAsset(definition: RadarDefinition): RadarAsset {
  return {
    symbol: definition.symbol,
    name: definition.name,
    category: definition.category,
    macroScore: 50,
    technicalScore: 50,
    timingScore: 50,
    totalScore: 50,
    bias: 'neutral',
    rating: 'mixed',
    trend: 'sideways',
    change24h: 0,
    currentPrice: 0,
  }
}

function buildMarketAlerts(radar: RadarAsset[]): OracleAlert[] {
  const alerts: OracleAlert[] = []
  const now = new Date().toISOString()
  const top = rankAssets(radar).slice(0, 3)

  for (const asset of top) {
    alerts.push({
      id: `signal-${asset.symbol}`,
      type: 'technical',
      severity: asset.rating === 'strong' ? 'warning' : 'info',
      title: `${asset.symbol} con score ${asset.totalScore}`,
      message: `Bias ${asset.bias.toUpperCase()} con tendencia ${asset.trend} y cambio diario ${asset.change24h.toFixed(2)}%.`,
      symbol: asset.symbol,
      timestamp: now,
      read: false,
      priceZone: asset.currentPrice > 0
        ? {
            top: Number((asset.currentPrice * 1.003).toFixed(5)),
            bottom: Number((asset.currentPrice * 0.997).toFixed(5)),
            label: 'Zona de seguimiento',
          }
        : undefined,
    })
  }

  const volatileAssets = radar
    .filter((asset) => Math.abs(asset.change24h) >= 1.25)
    .slice(0, 2)

  for (const asset of volatileAssets) {
    alerts.push({
      id: `vol-${asset.symbol}`,
      type: 'macro',
      severity: 'critical',
      title: `Volatilidad elevada en ${asset.symbol}`,
      message: `Movimiento de ${asset.change24h.toFixed(2)}% en 24h. Ajustar tamaño de riesgo y stops.`,
      symbol: asset.symbol,
      timestamp: now,
      read: false,
      priceZone: asset.currentPrice > 0
        ? {
            top: Number((asset.currentPrice * 1.006).toFixed(5)),
            bottom: Number((asset.currentPrice * 0.994).toFixed(5)),
            label: 'Rango de riesgo',
          }
        : undefined,
    })
  }

  const confluenceCandidates = rankAssets(radar).slice(0, 6)
  for (const asset of confluenceCandidates) {
    const setup = scoreSetupFromAsset({ asset })
    if (setup.confluence.count < 3) continue

    const severity: OracleAlert['severity'] = setup.confluence.count >= 4 ? 'critical' : 'warning'
    const confluenceFlags = [
      setup.confluence.structure ? 'estructura' : null,
      setup.confluence.zone ? 'zona' : null,
      setup.confluence.timing ? 'timing' : null,
      setup.confluence.risk ? 'riesgo' : null,
    ].filter((item): item is string => Boolean(item))

    alerts.push({
      id: `confluence-${asset.symbol}`,
      type: 'confluence',
      severity,
      title: `Confluencia ${asset.symbol} (${setup.score})`,
      message: `Confluencias activas: ${confluenceFlags.join(' + ')}. Score setup ${setup.score}/100.`,
      symbol: asset.symbol,
      timestamp: now,
      read: false,
      priceZone: asset.currentPrice > 0
        ? {
            top: Number((asset.currentPrice * 1.004).toFixed(5)),
            bottom: Number((asset.currentPrice * 0.996).toFixed(5)),
            label: 'Zona de confluencia',
          }
        : undefined,
    })
  }

  const activeKillZone = getActiveKillZones().find((killZone) => killZone.isActive)
  if (activeKillZone) {
    alerts.push({
      id: `kz-${activeKillZone.name.replace(/\s+/g, '-').toLowerCase()}`,
      type: 'session',
      severity: 'warning',
      title: activeKillZone.name,
      message: `Ventana activa ${activeKillZone.startUTC}-${activeKillZone.endUTC} UTC. Priorizar ejecución disciplinada.`,
      timestamp: now,
      read: false,
    })
  }

  return alerts
}

function buildCalendarFromAlerts(alerts: OracleAlert[]): EconomicEvent[] {
  return alerts.map((alert, index) => ({
    id: `ev-${index + 1}`,
    datetime: alert.timestamp,
    country: 'US',
    currency: 'USD',
    title: alert.title,
    impact: alert.severity === 'critical' ? 'high' : alert.severity === 'warning' ? 'medium' : 'low',
    forecast: null,
    previous: null,
    actual: 'Live',
    pending: false,
  }))
}

function mergeAlertsWithReadState(
  generatedAlerts: OracleAlert[],
  persistedAlerts: OracleAlert[],
): OracleAlert[] {
  const readMap = new Map(persistedAlerts.map((alert) => [alert.id, alert.read]))
  return generatedAlerts.map((alert) => ({
    ...alert,
    read: readMap.get(alert.id) ?? alert.read,
  }))
}

function buildDailyBrief(state: Omit<OracleState, 'brief'>): DailyBrief {
  const ranked = rankAssets(state.radar)
  const top = ranked[0]
  const second = ranked[1]
  const activeSession = toSessionName(state.sessions.find((session) => session.isActive)?.name)
  const sentiment = (() => {
    if ((top?.change24h ?? 0) > 0.2 && (second?.change24h ?? 0) > 0.2) return 'risk-on' as const
    if ((top?.change24h ?? 0) < -0.2 && (second?.change24h ?? 0) < -0.2) return 'risk-off' as const
    return 'mixed' as const
  })()

  const summary = top
    ? `${top.symbol} lidera el radar con score ${top.totalScore}. ${second ? `${second.symbol} acompana con ${second.totalScore}.` : ''}`
    : 'Sin suficientes datos en tiempo real para construir el radar.'

  return {
    date: new Date().toISOString(),
    marketBias: top?.bias ?? 'neutral',
    summary: summary.slice(0, 200),
    topSetup: top ? `${top.symbol} ${top.bias.toUpperCase()} (${top.totalScore})` : 'Sin setup dominante',
    keyEvent: state.alerts[0]?.title ?? 'Sin alertas de alta prioridad',
    activeSession,
    conditions: state.killZones.some((killZone) => killZone.isActive)
      ? 'Kill Zone activa'
      : 'Mercado fuera de Kill Zone',
    sentiment,
  }
}

async function computeRadarAsset(
  definition: RadarDefinition,
  context: { dxyStrength: 'strong' | 'weak' | 'neutral'; riskSentiment: 'risk-on' | 'risk-off' | 'mixed' },
  quote: MarketQuote | undefined,
): Promise<RadarComputation> {
  try {
    const h1Promise = fetchMarketHistory(definition.symbol, { interval: '1h', range: '1mo' })
    const m15Promise = fetchMarketHistory(definition.symbol, { interval: '15m', range: '5d' })
    const [h1Candles, m15Candles] = await Promise.all([h1Promise, m15Promise])

    const h4Candles = resampleCandles(h1Candles, 4)
    const validForTechnical = h4Candles.length >= 30 && h1Candles.length >= 80 && m15Candles.length >= 120

    const technical = validForTechnical
      ? analyzeTechnical(definition.symbol, {
          h4: h4Candles.slice(-120),
          h1: h1Candles.slice(-240),
          m15: m15Candles.slice(-320),
        })
      : {
          technicalScore: 50,
          trend: detectTrendFromCandles(h1Candles),
        }

    const macro = analyzeMacro(definition.symbol, {
      dxyStrength: context.dxyStrength,
      sentiment: context.riskSentiment,
    })

    const timing = analyzeTiming(definition.symbol)
    const scored = computeOracleScore({
      symbol: definition.symbol,
      macroScore: macro.macroScore,
      technicalScore: technical.technicalScore,
      timingScore: timing.timingScore,
      trend: technical.trend,
    })

    const asset: RadarAsset = {
      symbol: definition.symbol,
      name: definition.name,
      category: definition.category,
      macroScore: macro.macroScore,
      technicalScore: technical.technicalScore,
      timingScore: timing.timingScore,
      totalScore: scored.totalScore,
      bias: scored.bias,
      rating: scored.rating,
      trend: scored.trend,
      inKillZone: timing.inKillZone,
      change24h: quote?.changePct ?? 0,
      currentPrice: quote?.price ?? 0,
    }

    const alertHint: OracleAlert | null = quote && quote.price
      ? {
          id: `hint-${definition.symbol}`,
          type: 'technical',
          severity: 'info',
          title: `${definition.symbol} seguimiento`,
          message: `Precio ${quote.price.toFixed(definition.symbol.includes('JPY') ? 3 : definition.symbol === 'XAUUSD' ? 2 : 5)} con variacion ${asset.change24h.toFixed(2)}%.`,
          symbol: definition.symbol,
          timestamp: new Date().toISOString(),
          read: false,
          priceZone: {
            top: Number((quote.high ?? quote.price).toFixed(5)),
            bottom: Number((quote.low ?? quote.price).toFixed(5)),
            label: 'Max/Min diario',
          },
        }
      : null

    return { asset, alertHint }
  } catch {
    return { asset: fallbackRadarAsset(definition), alertHint: null }
  }
}

async function buildOracleStateFresh(): Promise<OracleState> {
  const allQuotes = await fetchMarketQuotes(
    Array.from(new Set([...RADAR_DEFINITIONS.map((definition) => definition.symbol), 'VIX'])),
  )
  const quoteMap = new Map(allQuotes.map((quote) => [quote.symbol, quote]))

  const dxyStrength = deriveDxyStrength(quoteMap.get('DXY')?.changePct ?? null)
  const riskSentiment = deriveRiskSentiment(
    quoteMap.get('SP500')?.changePct ?? null,
    quoteMap.get('BTCUSD')?.changePct ?? null,
  )

  const radarResults = await Promise.all(
    RADAR_DEFINITIONS.map((definition) =>
      computeRadarAsset(definition, { dxyStrength, riskSentiment }, quoteMap.get(definition.symbol)),
    ),
  )
  const radar = rankAssets(radarResults.map((item) => item.asset))

  const sessions = getActiveSessions()
  const killZones = getActiveKillZones()
  const generatedAlerts = buildMarketAlerts(radar)
  const hintAlerts = radarResults
    .map((item) => item.alertHint)
    .filter((alert): alert is OracleAlert => Boolean(alert))
    .slice(0, 4)

  const combinedAlerts = [...generatedAlerts, ...hintAlerts]
  const persistedAlerts = await listOracleAlerts(400).catch(() => [])
  const alerts = mergeAlertsWithReadState(combinedAlerts, persistedAlerts)
  await upsertOracleAlerts(alerts).catch(() => undefined)

  const [calendarFeed, centralBankRates] = await Promise.all([
    fetchMacroCalendar(60).catch(() => [] as EconomicEvent[]),
    fetchCentralBankRatesFromCalendar().catch(() => []),
  ])
  const calendar = calendarFeed.length > 0 ? calendarFeed : buildCalendarFromAlerts(alerts)
  const currencyStrength = await computeCurrencyStrength()

  const partialState: Omit<OracleState, 'brief'> = {
    topOpportunity: getTopOpportunity(radar),
    radar,
    sessions,
    killZones,
    alerts,
    centralBanks: centralBankRates,
    calendar,
    currencyStrength,
    lastUpdated: new Date().toISOString(),
  }

  const brief = buildDailyBrief(partialState)
  return {
    ...partialState,
    brief,
  }
}

export async function buildOracleState(options?: { forceRefresh?: boolean }): Promise<OracleState> {
  const forceRefresh = options?.forceRefresh ?? false
  const now = Date.now()

  if (!forceRefresh && stateCache && stateCache.expiresAt > now) {
    return stateCache.state
  }

  if (!forceRefresh && pendingStatePromise) {
    return pendingStatePromise
  }

  pendingStatePromise = buildOracleStateFresh()
  try {
    const state = await pendingStatePromise
    stateCache = {
      state,
      expiresAt: now + 60_000,
    }
    return state
  } finally {
    pendingStatePromise = null
  }
}
