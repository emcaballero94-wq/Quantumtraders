import type { Bias, MacroAlignment } from './types'
import { clamp } from './indicators'

// ─── Static Rate Table (update periodically or via API) ──────

interface RateEntry {
  currency: string
  rate:     number
  bias:     'hawkish' | 'dovish' | 'neutral'
}

const CENTRAL_BANK_RATES: RateEntry[] = [
  { currency: 'USD', rate: 5.50, bias: 'neutral'  },
  { currency: 'EUR', rate: 4.50, bias: 'neutral'  },
  { currency: 'GBP', rate: 5.25, bias: 'neutral'  },
  { currency: 'JPY', rate: 0.10, bias: 'dovish'   },
  { currency: 'CHF', rate: 1.75, bias: 'neutral'  },
  { currency: 'AUD', rate: 4.35, bias: 'neutral'  },
  { currency: 'NZD', rate: 5.50, bias: 'hawkish'  },
  { currency: 'CAD', rate: 5.00, bias: 'neutral'  },
]

// ─── Helpers ─────────────────────────────────────────────────

function getRateEntry(currency: string): RateEntry | undefined {
  return CENTRAL_BANK_RATES.find((r) => r.currency === currency.toUpperCase())
}

/**
 * Extracts base and quote currencies from a symbol.
 * Handles: EURUSD, EUR/USD, XAUUSD (Gold), BTCUSD, etc.
 */
function parseCurrencies(symbol: string): { base: string; quote: string } {
  const clean = symbol.replace('/', '').toUpperCase()

  const SPECIAL: Record<string, { base: string; quote: string }> = {
    XAUUSD: { base: 'XAU', quote: 'USD' },
    XAGUSD: { base: 'XAG', quote: 'USD' },
    BTCUSD: { base: 'BTC', quote: 'USD' },
    ETHUSD: { base: 'ETH', quote: 'USD' },
    US30:   { base: 'USD', quote: 'USD' },
    NAS100: { base: 'USD', quote: 'USD' },
    SPX500: { base: 'USD', quote: 'USD' },
  }

  if (SPECIAL[clean]) return SPECIAL[clean]

  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) }
}

// ─── Interest Rate Differential ──────────────────────────────

function calcRateDifferential(
  base: string,
  quote: string,
): { score: number; description: string } {
  const baseRate  = getRateEntry(base)
  const quoteRate = getRateEntry(quote)

  // Special assets: Gold, Crypto, Indices
  if (!baseRate || base === 'XAU' || base === 'XAG' || base === 'BTC' || base === 'ETH') {
    // Gold = inverse USD correlation → scored separately
    return { score: 50, description: 'Activo especial — diferencial de tasas no aplica' }
  }

  if (!quoteRate) {
    return { score: 50, description: 'Datos de tasa no disponibles' }
  }

  const diff = baseRate.rate - quoteRate.rate

  let score = 50
  if (diff > 2)    score = 85
  else if (diff > 1)    score = 70
  else if (diff > 0)    score = 58
  else if (diff === 0)  score = 50
  else if (diff > -1)   score = 42
  else if (diff > -2)   score = 30
  else                  score = 15

  const hawkishBase  = baseRate.bias === 'hawkish'
  const dovishQuote  = quoteRate.bias === 'dovish'
  if (hawkishBase && dovishQuote) score = clamp(score + 10)
  if (baseRate.bias === 'dovish' && quoteRate.bias === 'hawkish') score = clamp(score - 10)

  return {
    score,
    description: `Diferencial: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% — ${baseRate.bias} vs ${quoteRate.bias}`,
  }
}

// ─── Dollar Index Context ─────────────────────────────────────

/**
 * Simplified DXY context based on current regime.
 * In production: fetch from market data API.
 */
function calcDXYContext(
  base:  string,
  quote: string,
  dxyStrength: 'strong' | 'weak' | 'neutral' = 'neutral',
): { score: number; description: string } {
  const usdBase  = base  === 'USD'
  const usdQuote = quote === 'USD'

  if (!usdBase && !usdQuote) {
    return { score: 50, description: 'Par sin USD — DXY contexto indirecto' }
  }

  if (dxyStrength === 'strong') {
    if (usdBase)  return { score: 70, description: 'DXY fuerte — favorable para base USD' }
    if (usdQuote) return { score: 30, description: 'DXY fuerte — presión sobre par vs USD' }
  }
  if (dxyStrength === 'weak') {
    if (usdBase)  return { score: 30, description: 'DXY débil — vientos en contra para USD base' }
    if (usdQuote) return { score: 70, description: 'DXY débil — favorable para par vs USD' }
  }

  return { score: 50, description: 'DXY neutral — sin sesgo directional claro' }
}

// ─── Risk Sentiment ──────────────────────────────────────────

type RiskSentiment = 'risk-on' | 'risk-off' | 'mixed'

function calcRiskSentiment(
  base:      string,
  quote:     string,
  sentiment: RiskSentiment = 'mixed',
): { score: number; description: string } {
  const RISK_ON_CURRENCIES  = ['AUD', 'NZD', 'CAD', 'GBP']
  const RISK_OFF_CURRENCIES = ['JPY', 'CHF', 'USD']

  const baseRiskOn   = RISK_ON_CURRENCIES.includes(base)
  const baseRiskOff  = RISK_OFF_CURRENCIES.includes(base)
  const quoteRiskOn  = RISK_ON_CURRENCIES.includes(quote)
  const quoteRiskOff = RISK_OFF_CURRENCIES.includes(quote)

  // Gold: benefits from risk-off
  if (base === 'XAU') {
    if (sentiment === 'risk-off') return { score: 80, description: 'Risk-off — Gold refuge asset favorecido' }
    if (sentiment === 'risk-on')  return { score: 35, description: 'Risk-on — menor demanda de refugio para Gold' }
    return { score: 55, description: 'Sentimiento mixto — Gold en equilibrio' }
  }

  // Crypto: benefits from risk-on
  if (base === 'BTC' || base === 'ETH') {
    if (sentiment === 'risk-on')  return { score: 80, description: 'Risk-on — apetito por crypto' }
    if (sentiment === 'risk-off') return { score: 25, description: 'Risk-off — salida de activos de riesgo' }
    return { score: 50, description: 'Sentimiento mixto' }
  }

  if (sentiment === 'risk-on') {
    if (baseRiskOn  && quoteRiskOff) return { score: 80, description: 'Risk-on — par risk-on vs safe-haven' }
    if (baseRiskOff && quoteRiskOn)  return { score: 20, description: 'Risk-on — par invertido al sentimiento' }
  }
  if (sentiment === 'risk-off') {
    if (baseRiskOff && quoteRiskOn)  return { score: 80, description: 'Risk-off — safe-haven favorecido' }
    if (baseRiskOn  && quoteRiskOff) return { score: 20, description: 'Risk-off — par de riesgo desfavorecido' }
  }

  return { score: 50, description: 'Sentimiento neutral o par no correlacionado' }
}

// ─── Economic Momentum ───────────────────────────────────────

function calcEconomicMomentum(
  base:   string,
  quote:  string,
): { score: number; description: string } {
  // Placeholder: in production, use real GDP/PMI/CPI momentum data
  // Returns a baseline of 50 (no edge from momentum alone without live data)
  return { score: 50, description: 'Momentum económico — datos en tiempo real requeridos' }
}

// ─── Final Macro Bias ────────────────────────────────────────

function deriveMacroBias(score: number): Bias {
  if (score >= 60) return 'long'
  if (score <= 40) return 'short'
  return 'neutral'
}

// ─── Main Engine ─────────────────────────────────────────────

export interface MacroEngineOptions {
  dxyStrength?: 'strong' | 'weak' | 'neutral'
  sentiment?:   RiskSentiment
}

export function analyzeMacro(
  symbol:  string,
  options: MacroEngineOptions = {},
): MacroAlignment {
  const { base, quote } = parseCurrencies(symbol)
  const { dxyStrength = 'neutral', sentiment = 'mixed' } = options

  const rateDiff   = calcRateDifferential(base, quote)
  const dxy        = calcDXYContext(base, quote, dxyStrength)
  const risk       = calcRiskSentiment(base, quote, sentiment)
  const momentum   = calcEconomicMomentum(base, quote)

  // Weighted macro score: rates 40%, DXY 25%, sentiment 25%, momentum 10%
  const macroScore = clamp(Math.round(
    rateDiff.score * 0.40 +
    dxy.score      * 0.25 +
    risk.score     * 0.25 +
    momentum.score * 0.10,
  ))

  const bias = deriveMacroBias(macroScore)

  return {
    symbol,
    macroScore,
    bias,
    breakdown: {
      interestRateDiff: {
        name:        'Diferencial de Tasas',
        score:       rateDiff.score,
        weight:      40,
        description: rateDiff.description,
      },
      dollarIndex: {
        name:        'Índice del Dólar (DXY)',
        score:       dxy.score,
        weight:      25,
        description: dxy.description,
      },
      riskSentiment: {
        name:        'Sentimiento de Riesgo',
        score:       risk.score,
        weight:      25,
        description: risk.description,
      },
      economicMomentum: {
        name:        'Momentum Económico',
        score:       momentum.score,
        weight:      10,
        description: momentum.description,
      },
    },
    updatedAt: new Date().toISOString(),
  }
}
