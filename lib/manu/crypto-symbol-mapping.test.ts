import { describe, it, expect } from 'vitest'
import { orderFlowSymbolForCurrency, currencyForOrderFlowSymbol } from './crypto-symbol-mapping'

describe('crypto-symbol-mapping', () => {
  it('maps BTC/ETH to their Binance perp symbols', () => {
    expect(orderFlowSymbolForCurrency('BTC')).toBe('BTCUSDT')
    expect(orderFlowSymbolForCurrency('ETH')).toBe('ETHUSDT')
  })

  it('maps Binance perp symbols back to the Deribit currency, case-insensitively', () => {
    expect(currencyForOrderFlowSymbol('BTCUSDT')).toBe('BTC')
    expect(currencyForOrderFlowSymbol('btcusdt')).toBe('BTC')
    expect(currencyForOrderFlowSymbol('ethusdt')).toBe('ETH')
  })

  it('returns null for a symbol with no GEX counterpart (e.g. SOL)', () => {
    expect(currencyForOrderFlowSymbol('SOLUSDT')).toBeNull()
  })
})
