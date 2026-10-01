import { NextResponse } from 'next/server'
import { isTradierConfigured } from '@/lib/tradier-data'
import { computeGexMatrix } from '@/lib/gex/matrix'
import { fetchGexMatrixInput } from '@/lib/gex/fetch-matrix-input'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

const MAX_EXPIRATIONS = 12

// Live strike × expiry GEX matrix for the heatmap view — unlike
// /api/market/gex (one expiration at a time), this fetches the nearest N
// expirations in one call so the page can show the full grid without the
// client firing N requests itself.
export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'market-gex-matrix',
    limit: 15,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const assetClass = searchParams.get('assetClass') === 'crypto' ? 'crypto' : 'equity'
  const expirationsParam = Number.parseInt(searchParams.get('expirations') ?? '', 10)
  const maxExpirations = Number.isFinite(expirationsParam) ? Math.min(Math.max(expirationsParam, 1), MAX_EXPIRATIONS) : 6

  try {
    if (assetClass === 'equity') {
      if (!isTradierConfigured()) {
        return NextResponse.json(
          { success: false, error: 'TRADIER_API_TOKEN no está configurada. GEX no está disponible para acciones.' },
          { status: 200 },
        )
      }
      const symbol = searchParams.get('symbol')?.trim().toUpperCase()
      if (!symbol) return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })

      const { underlyingPrice, perExpiration } = await fetchGexMatrixInput('equity', symbol, maxExpirations)
      if (underlyingPrice === null) {
        return NextResponse.json({ success: false, error: `No se pudo obtener el precio de ${symbol}.` }, { status: 200 })
      }

      const matrix = computeGexMatrix(perExpiration, underlyingPrice)
      return NextResponse.json({ success: true, assetClass, symbol, ...matrix })
    }

    const currency = searchParams.get('currency')?.trim().toUpperCase()
    if (currency !== 'BTC' && currency !== 'ETH') {
      return NextResponse.json({ success: false, error: 'currency must be BTC or ETH' }, { status: 400 })
    }

    const { underlyingPrice, perExpiration } = await fetchGexMatrixInput('crypto', currency, maxExpirations)
    if (underlyingPrice === null) {
      return NextResponse.json({ success: false, error: `No se pudo obtener el precio de ${currency}.` }, { status: 200 })
    }

    const matrix = computeGexMatrix(perExpiration, underlyingPrice)
    return NextResponse.json({ success: true, assetClass, currency, ...matrix })
  } catch (error) {
    console.error('[/api/market/gex-matrix] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to compute GEX matrix' }, { status: 502 })
  }
}
