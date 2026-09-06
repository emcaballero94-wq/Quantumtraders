// Hand-curated sector/peer groupings — real classification, not fabricated financial data.
// Used to draw a Bloomberg RMAP-style relationship map around a given symbol.
export const RELATED_TICKERS: Record<string, string[]> = {
  NVDA: ['AMD', 'AVGO', 'TSM', 'MU', 'NAS100'],
  AMD: ['NVDA', 'AVGO', 'TSM', 'MU', 'NAS100'],
  AVGO: ['NVDA', 'AMD', 'TSM', 'MU', 'NAS100'],
  TSM: ['NVDA', 'AMD', 'AVGO', 'MU', 'NAS100'],
  MU: ['NVDA', 'AMD', 'AVGO', 'TSM', 'NAS100'],
  MSFT: ['GOOGL', 'AMZN', 'META', 'NAS100', 'SPX500'],
  GOOGL: ['MSFT', 'META', 'AMZN', 'NAS100', 'SPX500'],
  AMZN: ['MSFT', 'GOOGL', 'META', 'NAS100', 'SPX500'],
  META: ['GOOGL', 'MSFT', 'AMZN', 'NAS100', 'SPX500'],
  TSLA: ['NVDA', 'NAS100', 'SPX500', 'BTCUSD'],
  PLTR: ['NVDA', 'NAS100', 'SPX500', 'MSFT'],
  SPX500: ['NAS100', 'US30', 'MSFT', 'NVDA', 'AMZN'],
  NAS100: ['SPX500', 'NVDA', 'MSFT', 'META', 'AMD'],
  US30: ['SPX500', 'NAS100', 'MSFT'],
  BTCUSD: ['TSLA', 'NAS100', 'SPX500'],
}

export function relatedSymbolsFor(symbol: string): string[] {
  return RELATED_TICKERS[symbol.toUpperCase()] ?? []
}
