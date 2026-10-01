// Lets M.A.N.U. (Order Flow) and M.A.N.U. — GEX & Options cross-reference
// each other for the two assets both sides actually cover: Order Flow reads
// Binance perpetuals (symbols like BTCUSDT), GEX reads Deribit options
// (currencies BTC/ETH) — there's no equivalent for SOL (no Deribit options)
// or for equities (no perp order flow), so those stay single-sided.

export type CryptoCurrency = 'BTC' | 'ETH'

const ORDERFLOW_SYMBOL_BY_CURRENCY: Record<CryptoCurrency, string> = { BTC: 'BTCUSDT', ETH: 'ETHUSDT' }
const CURRENCY_BY_ORDERFLOW_SYMBOL: Record<string, CryptoCurrency> = { BTCUSDT: 'BTC', ETHUSDT: 'ETH' }

export function orderFlowSymbolForCurrency(currency: CryptoCurrency): string {
  return ORDERFLOW_SYMBOL_BY_CURRENCY[currency]
}

export function currencyForOrderFlowSymbol(symbol: string): CryptoCurrency | null {
  return CURRENCY_BY_ORDERFLOW_SYMBOL[symbol.toUpperCase()] ?? null
}
