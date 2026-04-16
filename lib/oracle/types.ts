// ============================================================
// QUANTUM TRADERS IA — Oracle Core Types
// ============================================================

// ─── Primitives ─────────────────────────────────────────────

export type Bias = 'long' | 'short' | 'neutral'
export type Rating = 'strong' | 'operable' | 'mixed' | 'avoid'
export type Timeframe = 'M15' | 'H1' | 'H4' | 'D1' | 'W1'
export type Trend = 'uptrend' | 'downtrend' | 'sideways'
export type SessionName = 'Sydney' | 'Tokyo' | 'London' | 'New York' | 'Off'

// ─── Market Data ────────────────────────────────────────────

export interface Candle {
  timestamp: number
  open:      number
  high:      number
  low:       number
  close:     number
  volume?:   number
}

export interface CandleSet {
  h4:  Candle[]
  h1:  Candle[]
  m15: Candle[]
}

// ─── Technical Engine ───────────────────────────────────────

export interface TechnicalFactor {
  name:        string
  score:       number   // 0–100
  weight:      number   // contribution weight
  description: string
}

export interface TechnicalBreakdown {
  trendH4:       TechnicalFactor
  trendH1:       TechnicalFactor
  structureM15:  TechnicalFactor
  ema21:         TechnicalFactor
  ema50:         TechnicalFactor
  priceLocation: TechnicalFactor
  atr:           TechnicalFactor
}

export interface TechnicalAlignment {
  symbol:         string
  technicalScore: number   // 0–100
  bias:           Bias
  rating:         Rating
  trend:          Trend
  breakdown:      TechnicalBreakdown
  indicators: {
    ema21:    number
    ema50:    number
    atr:      number
    currentPrice: number
  }
  updatedAt: string
}

// ─── Macro Engine ───────────────────────────────────────────

export interface MacroFactor {
  name:        string
  score:       number
  weight:      number
  description: string
}

export interface MacroAlignment {
  symbol:     string
  macroScore: number
  bias:       Bias
  breakdown: {
    interestRateDiff: MacroFactor
    dollarIndex:      MacroFactor
    riskSentiment:    MacroFactor
    economicMomentum: MacroFactor
  }
  updatedAt: string
}

// ─── Timing Engine ──────────────────────────────────────────

export interface MarketSession {
  name:      SessionName
  openUTC:   string   // 'HH:MM'
  closeUTC:  string
  isActive:  boolean
  killZone:  boolean
  quality:   'high' | 'medium' | 'low'
  pairs:     string[]
}

export interface KillZone {
  name:     string
  session:  SessionName
  startUTC: string
  endUTC:   string
  isActive: boolean
}

export interface TimingAlignment {
  symbol:        string
  timingScore:   number
  activeSession: SessionName
  inKillZone:    boolean
  killZone:      KillZone | null
  sessions:      MarketSession[]
  nextSession:   MarketSession | null
  updatedAt:     string
}

// ─── Score Engine ───────────────────────────────────────────

export interface OracleScore {
  symbol:         string
  totalScore:     number   // 0–100
  macroScore:     number
  technicalScore: number
  timingScore:    number
  bias:           Bias
  rating:         Rating
  trend:          Trend
  recommendation: string
  updatedAt:      string
}

// ─── Radar / Asset List ─────────────────────────────────────

export interface RadarAsset {
  symbol:         string
  name:           string
  category:       'forex' | 'metals' | 'indices' | 'crypto'
  macroScore:     number
  technicalScore: number
  timingScore:    number
  totalScore:     number
  bias:           Bias
  rating:         Rating
  trend:          Trend
  inKillZone?:    boolean
  change24h:      number
  currentPrice:   number
}

// ─── Daily Brief ────────────────────────────────────────────

export interface DailyBrief {
  date:          string
  marketBias:    Bias
  summary:       string
  topSetup:      string
  keyEvent:      string
  activeSession: SessionName
  conditions:    string
  sentiment:     'risk-on' | 'risk-off' | 'mixed'
}

// ─── Alerts ─────────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertType = 'session' | 'killzone' | 'event' | 'technical' | 'macro' | 'confluence'

export interface OracleAlert {
  id:        string
  type:      AlertType
  severity:  AlertSeverity
  title:     string
  message:   string
  symbol?:   string
  timestamp: string
  read:      boolean
  priceZone?: { top: number, bottom: number, label: string }
}

// ─── Central Bank Rates ─────────────────────────────────────

export interface CentralBankRate {
  bank:       string
  country:    string
  currency:   string
  rate:       number
  lastChange: string
  bias:       'hawkish' | 'dovish' | 'neutral'
  nextMeeting: string
}

// ─── Economic Event ─────────────────────────────────────────

export type EventImpact = 'low' | 'medium' | 'high'

export interface EconomicEvent {
  id:        string
  datetime:  string
  country:   string
  currency:  string
  title:     string
  impact:    EventImpact
  forecast:  string | null
  previous:  string | null
  actual:    string | null
  pending:   boolean
}

// ─── Currency Strength ──────────────────────────────────────

export interface CurrencyStrength {
  currency: string
  score:    number   // -100 to +100
  trend:    'strengthening' | 'weakening' | 'stable'
  change1h: number
  change4h: number
  change1d: number
}

// ─── API Request/Response ───────────────────────────────────

export interface TechnicalRequest {
  symbol:  string
  candles: CandleSet
}

export interface TechnicalResponse {
  success: boolean
  data:    TechnicalAlignment | null
  error?:  string
}

export interface ScoreRequest {
  symbol:         string
  macroScore?:    number
  technicalScore: number
  timingScore?:   number
}

export interface ScoreResponse {
  success: boolean
  data:    OracleScore | null
  error?:  string
}

export interface BriefResponse {
  success: boolean
  data:    DailyBrief | null
  error?:  string
}

export interface AlertsResponse {
  success: boolean
  data:    OracleAlert[]
  error?:  string
}

// ─── Oracle Full State ──────────────────────────────────────

export interface OracleState {
  brief:          DailyBrief
  topOpportunity: RadarAsset | null
  radar:          RadarAsset[]
  sessions:       MarketSession[]
  killZones:      KillZone[]
  alerts:         OracleAlert[]
  centralBanks:   CentralBankRate[]
  calendar:       EconomicEvent[]
  currencyStrength: CurrencyStrength[]
  lastUpdated:    string
}
