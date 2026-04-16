import type { CentralBankRate, EconomicEvent, EventImpact } from '@/lib/oracle/types'

type TradingEconomicsCalendarRow = {
  CalendarId?: string
  Date?: string
  Country?: string
  Event?: string
  Category?: string
  Importance?: number
  Forecast?: string
  Previous?: string
  Actual?: string
}

type ForexFactoryRow = {
  title?: string
  country?: string
  date?: string
  impact?: string
  forecast?: string
  previous?: string
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  'United States': 'USD',
  'United Kingdom': 'GBP',
  'Euro Area': 'EUR',
  Japan: 'JPY',
  Switzerland: 'CHF',
  Canada: 'CAD',
  Australia: 'AUD',
  'New Zealand': 'NZD',
}

const CENTRAL_BANK_DEFS = [
  { bank: 'Federal Reserve', country: 'United States', currency: 'USD' },
  { bank: 'European Central Bank', country: 'Euro Area', currency: 'EUR' },
  { bank: 'Bank of England', country: 'United Kingdom', currency: 'GBP' },
  { bank: 'Bank of Japan', country: 'Japan', currency: 'JPY' },
  { bank: 'Swiss National Bank', country: 'Switzerland', currency: 'CHF' },
  { bank: 'Bank of Canada', country: 'Canada', currency: 'CAD' },
  { bank: 'Reserve Bank of Australia', country: 'Australia', currency: 'AUD' },
  { bank: 'Reserve Bank of New Zealand', country: 'New Zealand', currency: 'NZD' },
] as const

function cleanNumeric(raw: string | null | undefined): number | null {
  if (!raw) return null
  const normalized = raw.replace(',', '.').replace(/[^\d.-]/g, '')
  if (!normalized) return null
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : null
}

function mapImportance(value: number | undefined): EventImpact {
  if (value === undefined || value === null) return 'low'
  if (value >= 3) return 'high'
  if (value >= 2) return 'medium'
  return 'low'
}

function mapForexFactoryImpact(value: string | undefined): EventImpact {
  const normalized = (value ?? '').toLowerCase()
  if (normalized.includes('high')) return 'high'
  if (normalized.includes('medium')) return 'medium'
  return 'low'
}

function parseTradingEconomicsAuth(): string {
  const key = process.env.TRADING_ECONOMICS_KEY
  const secret = process.env.TRADING_ECONOMICS_SECRET
  if (key && secret) return `${key}:${secret}`
  return 'guest:guest'
}

async function fetchTradingEconomicsCalendar(): Promise<TradingEconomicsCalendarRow[]> {
  const auth = parseTradingEconomicsAuth()
  const endpoint = `https://api.tradingeconomics.com/calendar?c=${encodeURIComponent(auth)}&f=json`
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'QuantumTraders/1.0',
    },
    next: { revalidate: 0 },
  })
  if (!response.ok) return []

  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data as TradingEconomicsCalendarRow[]
}

async function fetchForexFactoryCalendar(): Promise<ForexFactoryRow[]> {
  const endpoint = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'QuantumTraders/1.0',
    },
    next: { revalidate: 0 },
  })
  if (!response.ok) return []

  const data = await response.json()
  if (!Array.isArray(data)) return []
  return data as ForexFactoryRow[]
}

function normalizeCountryToCurrency(country: string | undefined): string {
  if (!country) return 'USD'
  const upper = country.toUpperCase()
  if (upper.length === 3) return upper
  return COUNTRY_TO_CURRENCY[country] ?? 'USD'
}

export async function fetchMacroCalendar(limit = 40): Promise<EconomicEvent[]> {
  const [teRows, ffRows] = await Promise.all([
    fetchTradingEconomicsCalendar().catch(() => []),
    fetchForexFactoryCalendar().catch(() => []),
  ])

  const teEvents = teRows.map((row, index) => {
    const iso = row.Date ? new Date(row.Date).toISOString() : new Date().toISOString()
    return {
      id: row.CalendarId ? `te-${row.CalendarId}` : `te-${index}`,
      datetime: iso,
      country: row.Country ?? 'Unknown',
      currency: normalizeCountryToCurrency(row.Country),
      title: row.Event || row.Category || 'Economic event',
      impact: mapImportance(row.Importance),
      forecast: row.Forecast || null,
      previous: row.Previous || null,
      actual: row.Actual || null,
      pending: new Date(iso).getTime() > Date.now(),
    } satisfies EconomicEvent
  })

  const ffEvents = ffRows.map((row, index) => {
    const iso = row.date ? new Date(row.date).toISOString() : new Date().toISOString()
    return {
      id: `ff-${index}`,
      datetime: iso,
      country: row.country ?? 'Unknown',
      currency: normalizeCountryToCurrency(row.country),
      title: row.title ?? 'Economic event',
      impact: mapForexFactoryImpact(row.impact),
      forecast: row.forecast || null,
      previous: row.previous || null,
      actual: null,
      pending: new Date(iso).getTime() > Date.now(),
    } satisfies EconomicEvent
  })

  const merged = [...teEvents, ...ffEvents]
  const unique = new Map<string, EconomicEvent>()
  for (const item of merged) {
    const key = `${item.currency}|${item.title}|${item.datetime.slice(0, 16)}`
    if (!unique.has(key)) unique.set(key, item)
  }

  return [...unique.values()]
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, limit)
}

function isPolicyRateEvent(title: string): boolean {
  const value = title.toLowerCase()
  if (value.includes('speech') || value.includes('speaks') || value.includes('minutes')) return false
  return (
    value.includes('interest rate') ||
    value.includes('rate decision') ||
    value.includes('cash rate') ||
    value.includes('refinancing rate') ||
    value.includes('policy rate')
  )
}

function inferBias(current: number, previous: number | null): 'hawkish' | 'dovish' | 'neutral' {
  if (previous === null) return 'neutral'
  if (current > previous) return 'hawkish'
  if (current < previous) return 'dovish'
  return 'neutral'
}

export async function fetchCentralBankRatesFromCalendar(): Promise<CentralBankRate[]> {
  const events = await fetchMacroCalendar(250)
  const rates: CentralBankRate[] = []

  for (const bankDef of CENTRAL_BANK_DEFS) {
    const matches = events
      .filter((event) => event.currency === bankDef.currency && isPolicyRateEvent(event.title))
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())

    const recent = matches[0]
    if (!recent) continue

    const currentRate = cleanNumeric(recent.actual ?? recent.forecast ?? recent.previous)
    if (currentRate === null) continue
    const previousRate = cleanNumeric(recent.previous)
    const nextMeeting = matches.find((event) => event.pending)?.datetime ?? recent.datetime

    rates.push({
      bank: bankDef.bank,
      country: bankDef.country,
      currency: bankDef.currency,
      rate: currentRate,
      lastChange: recent.datetime,
      bias: inferBias(currentRate, previousRate),
      nextMeeting,
    })
  }

  return rates
}
