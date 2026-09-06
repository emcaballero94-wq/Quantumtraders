import { MARKET_SYMBOL_MAP } from '@/lib/market-data'

export interface CompanyOfficer {
  name: string
  title: string
  age: number | null
  totalPay: number | null
}

export interface FinancialsPoint {
  period: string
  revenue: number | null
  earnings: number | null
}

export interface CompanyProfile {
  symbol: string
  providerSymbol: string
  isEquity: boolean
  name: string | null
  exchange: string | null
  sector: string | null
  industry: string | null
  description: string | null
  website: string | null
  employees: number | null
  officers: CompanyOfficer[]
  marketCap: number | null
  peTrailing: number | null
  peForward: number | null
  eps: number | null
  dividendYield: number | null
  beta: number | null
  fiftyTwoWeekLow: number | null
  fiftyTwoWeekHigh: number | null
  volume: number | null
  avgVolume: number | null
  revenueTtm: number | null
  revenueGrowthYoy: number | null
  grossMargins: number | null
  profitMargins: number | null
  recommendationKey: string | null
  targetMeanPrice: number | null
  analystCount: number | null
  annualFinancials: FinancialsPoint[]
  quarterlyFinancials: FinancialsPoint[]
}

function raw(value: unknown): number | null {
  if (value && typeof value === 'object' && 'raw' in (value as Record<string, unknown>)) {
    const r = (value as Record<string, unknown>).raw
    return typeof r === 'number' && Number.isFinite(r) ? r : null
  }
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function mapFinancialsChart(entries: unknown): FinancialsPoint[] {
  if (!Array.isArray(entries)) return []
  return entries
    .map((entry: any) => ({
      period: str(entry?.date) ?? String(entry?.date ?? ''),
      revenue: raw(entry?.revenue),
      earnings: raw(entry?.earnings),
    }))
    .filter((point) => point.period)
}

export async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  const providerSymbol = MARKET_SYMBOL_MAP[symbol] ?? symbol
  const modules = 'assetProfile,summaryDetail,defaultKeyStatistics,financialData,price,earnings'
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(providerSymbol)}?modules=${modules}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
    next: { revalidate: 0 },
  })
  if (!response.ok) return null

  const json = await response.json()
  const result = json?.quoteSummary?.result?.[0]
  if (!result) return null

  const assetProfile = result.assetProfile ?? {}
  const summaryDetail = result.summaryDetail ?? {}
  const keyStats = result.defaultKeyStatistics ?? {}
  const financialData = result.financialData ?? {}
  const price = result.price ?? {}
  const earnings = result.earnings ?? {}

  const officers: CompanyOfficer[] = Array.isArray(assetProfile.companyOfficers)
    ? assetProfile.companyOfficers.map((officer: any) => ({
        name: str(officer?.name) ?? 'N/D',
        title: str(officer?.title) ?? 'N/D',
        age: raw(officer?.age),
        totalPay: raw(officer?.totalPay),
      }))
    : []

  const isEquity = officers.length > 0 || Boolean(assetProfile.sector) || Boolean(financialData.totalRevenue)

  return {
    symbol,
    providerSymbol,
    isEquity,
    name: str(price.longName) ?? str(price.shortName),
    exchange: str(price.exchangeName),
    sector: str(assetProfile.sector),
    industry: str(assetProfile.industry),
    description: str(assetProfile.longBusinessSummary),
    website: str(assetProfile.website),
    employees: raw(assetProfile.fullTimeEmployees),
    officers,
    marketCap: raw(summaryDetail.marketCap ?? price.marketCap),
    peTrailing: raw(summaryDetail.trailingPE),
    peForward: raw(summaryDetail.forwardPE ?? keyStats.forwardPE),
    eps: raw(keyStats.trailingEps),
    dividendYield: raw(summaryDetail.dividendYield),
    beta: raw(summaryDetail.beta ?? keyStats.beta),
    fiftyTwoWeekLow: raw(summaryDetail.fiftyTwoWeekLow),
    fiftyTwoWeekHigh: raw(summaryDetail.fiftyTwoWeekHigh),
    volume: raw(summaryDetail.volume),
    avgVolume: raw(summaryDetail.averageVolume),
    revenueTtm: raw(financialData.totalRevenue),
    revenueGrowthYoy: raw(financialData.revenueGrowth),
    grossMargins: raw(financialData.grossMargins),
    profitMargins: raw(financialData.profitMargins),
    recommendationKey: str(financialData.recommendationKey),
    targetMeanPrice: raw(financialData.targetMeanPrice),
    analystCount: raw(financialData.numberOfAnalystOpinions),
    annualFinancials: mapFinancialsChart(earnings?.financialsChart?.yearly),
    quarterlyFinancials: mapFinancialsChart(earnings?.financialsChart?.quarterly),
  }
}
