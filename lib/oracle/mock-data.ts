/**
 * Mock data for Oracle — used in development and UI preview.
 * Replace with real API calls in production.
 */

import type {
  OracleState, RadarAsset, DailyBrief, OracleAlert,
  CentralBankRate, EconomicEvent, CurrencyStrength,
  MarketSession, KillZone,
} from './types'

// ─── Sessions ────────────────────────────────────────────────

export const MOCK_SESSIONS: MarketSession[] = [
  { name: 'Sydney',   openUTC: '21:00', closeUTC: '06:00', isActive: false, killZone: false, quality: 'low',    pairs: ['AUDUSD','NZDUSD'] },
  { name: 'Tokyo',    openUTC: '00:00', closeUTC: '09:00', isActive: false, killZone: false, quality: 'medium', pairs: ['USDJPY','EURJPY','GBPJPY'] },
  { name: 'London',   openUTC: '07:00', closeUTC: '16:00', isActive: true,  killZone: false, quality: 'high',   pairs: ['EURUSD','GBPUSD','XAUUSD'] },
  { name: 'New York', openUTC: '12:00', closeUTC: '21:00', isActive: true,  killZone: true,  quality: 'high',   pairs: ['EURUSD','GBPUSD','USDJPY','XAUUSD'] },
]

export const MOCK_KILL_ZONES: KillZone[] = [
  { name: 'New York Open Kill Zone',  session: 'New York', startUTC: '12:00', endUTC: '15:00', isActive: true  },
  { name: 'London Open Kill Zone',    session: 'London',   startUTC: '07:00', endUTC: '10:00', isActive: false },
  { name: 'London Close Kill Zone',   session: 'London',   startUTC: '15:00', endUTC: '16:00', isActive: false },
  { name: 'Asian Range Kill Zone',    session: 'Tokyo',    startUTC: '00:00', endUTC: '02:00', isActive: false },
]

// ─── Radar Assets ────────────────────────────────────────────

export const MOCK_RADAR: RadarAsset[] = [
  {
    symbol:         'XAUUSD',
    name:           'Gold / US Dollar',
    category:       'metals',
    macroScore:     78,
    technicalScore: 82,
    timingScore:    75,
    totalScore:     80,
    bias:           'long',
    rating:         'strong',
    trend:          'uptrend',
    change24h:      +1.24,
    currentPrice:   2341.50,
  },
  {
    symbol:         'GBPUSD',
    name:           'British Pound / US Dollar',
    category:       'forex',
    macroScore:     65,
    technicalScore: 72,
    timingScore:    80,
    totalScore:     70,
    bias:           'long',
    rating:         'strong',
    trend:          'uptrend',
    change24h:      +0.42,
    currentPrice:   1.2748,
  },
  {
    symbol:         'EURUSD',
    name:           'Euro / US Dollar',
    category:       'forex',
    macroScore:     58,
    technicalScore: 63,
    timingScore:    80,
    totalScore:     63,
    bias:           'long',
    rating:         'operable',
    trend:          'uptrend',
    change24h:      +0.18,
    currentPrice:   1.0842,
  },
  {
    symbol:         'GBPJPY',
    name:           'British Pound / Japanese Yen',
    category:       'forex',
    macroScore:     72,
    technicalScore: 68,
    timingScore:    60,
    totalScore:     68,
    bias:           'long',
    rating:         'operable',
    trend:          'uptrend',
    change24h:      +0.65,
    currentPrice:   192.34,
  },
  {
    symbol:         'USDJPY',
    name:           'US Dollar / Japanese Yen',
    category:       'forex',
    macroScore:     62,
    technicalScore: 55,
    timingScore:    65,
    totalScore:     59,
    bias:           'long',
    rating:         'operable',
    trend:          'sideways',
    change24h:      +0.22,
    currentPrice:   150.82,
  },
  {
    symbol:         'BTCUSD',
    name:           'Bitcoin / US Dollar',
    category:       'crypto',
    macroScore:     55,
    technicalScore: 48,
    timingScore:    70,
    totalScore:     52,
    bias:           'neutral',
    rating:         'mixed',
    trend:          'sideways',
    change24h:      -0.89,
    currentPrice:   67450.00,
  },
  {
    symbol:         'USDCAD',
    name:           'US Dollar / Canadian Dollar',
    category:       'forex',
    macroScore:     38,
    technicalScore: 35,
    timingScore:    60,
    totalScore:     38,
    bias:           'short',
    rating:         'mixed',
    trend:          'downtrend',
    change24h:      -0.31,
    currentPrice:   1.3621,
  },
  {
    symbol:         'EURCAD',
    name:           'Euro / Canadian Dollar',
    category:       'forex',
    macroScore:     28,
    technicalScore: 22,
    timingScore:    50,
    totalScore:     26,
    bias:           'short',
    rating:         'avoid',
    trend:          'downtrend',
    change24h:      -0.55,
    currentPrice:   1.4762,
  },
]

// ─── Daily Brief ─────────────────────────────────────────────

export const MOCK_BRIEF: DailyBrief = {
  date:          new Date().toISOString(),
  marketBias:    'long',
  summary:       'Sesgo alcista dominante con London y New York solapados. El oro lidera con alineación técnica y macro completa. El dólar muestra debilidad moderada frente a GBP y EUR. NFP mañana — ajustar tamaños antes del evento.',
  topSetup:      'XAUUSD — pullback a 2328 con estructura alcista H1 intacta',
  keyEvent:      'Jobless Claims USD — 13:30 UTC (alto impacto)',
  activeSession: 'New York',
  conditions:    'Kill Zone activa · Alta liquidez · Spread normal',
  sentiment:     'risk-on',
}

// ─── Alerts ──────────────────────────────────────────────────

export const MOCK_ALERTS: OracleAlert[] = [
  {
    id:        'a1',
    type:      'killzone',
    severity:  'warning',
    title:     'Kill Zone Activa',
    message:   'New York Open Kill Zone activa hasta las 15:00 UTC. Alta probabilidad de movimiento inicial.',
    timestamp: new Date().toISOString(),
    read:      false,
  },
  {
    id:        'a2',
    type:      'event',
    severity:  'critical',
    title:     'Evento de Alto Impacto',
    message:   'Jobless Claims USD en 45 min. Considerar cerrar posiciones abiertas o ajustar stops.',
    symbol:    'EURUSD',
    timestamp: new Date().toISOString(),
    read:      false,
  },
  {
    id:        'a3',
    type:      'technical',
    severity:  'info',
    title:     'XAUUSD — Setup Confirmado',
    message:   'Gold retestea EMA21 en H1. Estructura bullish M15 intacta. Score 80/100.',
    symbol:    'XAUUSD',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    read:      false,
    priceZone: { top: 2328, bottom: 2320, label: 'JARVIS Buy Zone' }
  },
]

// ─── Central Bank Rates ──────────────────────────────────────

export const MOCK_CENTRAL_BANKS: CentralBankRate[] = [
  { bank: 'Federal Reserve',  country: 'Estados Unidos', currency: 'USD', rate: 5.50, lastChange: '2023-07-26', bias: 'neutral',  nextMeeting: '2024-05-01' },
  { bank: 'ECB',              country: 'Eurozona',       currency: 'EUR', rate: 4.50, lastChange: '2023-09-14', bias: 'neutral',  nextMeeting: '2024-04-11' },
  { bank: 'Bank of England',  country: 'Reino Unido',    currency: 'GBP', rate: 5.25, lastChange: '2023-08-03', bias: 'neutral',  nextMeeting: '2024-05-09' },
  { bank: 'Bank of Japan',    country: 'Japón',          currency: 'JPY', rate: 0.10, lastChange: '2024-03-19', bias: 'dovish',   nextMeeting: '2024-04-26' },
  { bank: 'SNB',              country: 'Suiza',          currency: 'CHF', rate: 1.75, lastChange: '2023-09-21', bias: 'neutral',  nextMeeting: '2024-06-20' },
  { bank: 'RBA',              country: 'Australia',      currency: 'AUD', rate: 4.35, lastChange: '2023-11-07', bias: 'neutral',  nextMeeting: '2024-05-07' },
]

// ─── Economic Calendar ────────────────────────────────────────

export const MOCK_CALENDAR: EconomicEvent[] = [
  {
    id:       'e1',
    datetime: new Date(Date.now() + 45 * 60000).toISOString(),
    country:  'US',
    currency: 'USD',
    title:    'Jobless Claims',
    impact:   'high',
    forecast: '215K',
    previous: '212K',
    actual:   null,
    pending:  true,
  },
  {
    id:       'e2',
    datetime: new Date(Date.now() + 3 * 3600000).toISOString(),
    country:  'US',
    currency: 'USD',
    title:    'Fed Williams Speech',
    impact:   'medium',
    forecast: null,
    previous: null,
    actual:   null,
    pending:  true,
  },
  {
    id:       'e3',
    datetime: new Date(Date.now() - 2 * 3600000).toISOString(),
    country:  'EU',
    currency: 'EUR',
    title:    'ECB Bulletin',
    impact:   'low',
    forecast: null,
    previous: null,
    actual:   'Published',
    pending:  false,
  },
]

// ─── Currency Strength ────────────────────────────────────────

export const MOCK_CURRENCY_STRENGTH: CurrencyStrength[] = [
  { currency: 'GBP', score:  68, trend: 'strengthening', change1h:  0.12, change4h:  0.38, change1d:  0.65 },
  { currency: 'EUR', score:  52, trend: 'stable',        change1h:  0.05, change4h:  0.18, change1d:  0.22 },
  { currency: 'AUD', score:  48, trend: 'stable',        change1h: -0.02, change4h:  0.10, change1d: -0.15 },
  { currency: 'NZD', score:  45, trend: 'stable',        change1h:  0.01, change4h: -0.05, change1d: -0.30 },
  { currency: 'USD', score:  38, trend: 'weakening',     change1h: -0.08, change4h: -0.22, change1d: -0.55 },
  { currency: 'CAD', score:  35, trend: 'weakening',     change1h: -0.10, change4h: -0.30, change1d: -0.48 },
  { currency: 'CHF', score:  40, trend: 'stable',        change1h:  0.03, change4h: -0.08, change1d:  0.12 },
  { currency: 'JPY', score:  22, trend: 'weakening',     change1h: -0.15, change4h: -0.45, change1d: -0.82 },
]

// ─── Full Oracle State ────────────────────────────────────────

export const MOCK_ORACLE_STATE: OracleState = {
  brief:            MOCK_BRIEF,
  topOpportunity:   MOCK_RADAR[0]!,  // XAUUSD
  radar:            MOCK_RADAR,
  sessions:         MOCK_SESSIONS,
  killZones:        MOCK_KILL_ZONES,
  alerts:           MOCK_ALERTS,
  centralBanks:     MOCK_CENTRAL_BANKS,
  calendar:         MOCK_CALENDAR,
  currencyStrength: MOCK_CURRENCY_STRENGTH,
  lastUpdated:      new Date().toISOString(),
}

export const MOCK_AGENTS = [
  { id: 'atlas', name: 'ATLAS', specialty: 'Análisis Técnico', status: 'Activo', score: 85, mind: 'Observación' },
  { id: 'nexus', name: 'NEXUS', specialty: 'Correlaciones', status: 'Activo', score: 72, mind: 'Análisis' },
  { id: 'pulse', name: 'PULSE', specialty: 'Sentimiento', status: 'En espera', score: 58, mind: 'Cálculo' },
]

// ─── Mock Candle Generator (for API testing) ─────────────────

export function generateMockCandles(
  basePrice:  number,
  count:      number,
  volatility: number = 0.003,
) {
  const candles = []
  let price = basePrice

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * volatility * price
    const open   = price
    const close  = price + change
    const high   = Math.max(open, close) * (1 + Math.random() * volatility * 0.5)
    const low    = Math.min(open, close) * (1 - Math.random() * volatility * 0.5)

    candles.push({
      timestamp: Date.now() - (count - i) * 3600000,
      open, high, low, close,
      volume: Math.floor(Math.random() * 10000) + 1000,
    })

    price = close
  }

  return candles
}
