import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { insertOrderFlowBrief } from '@/lib/oracle/orderflow-persistence'
import { logAiUsage } from '@/lib/ai-usage/usage-log'

interface OrderFlowSnapshotBody {
  symbol: string
  book: { bestBid: number | null; bestAsk: number | null; spread: number | null; bidDepth: number | null; askDepth: number | null } | null
  tape: { cvd: number | null; lastPrice: number | null } | null
  liquidations: { longNotional: number; shortNotional: number; count: number } | null
  derivatives: { fundingRate: number | null; openInterest: number | null; markPrice: number | null } | null
}

function fmtNum(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return 'sin dato'
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'sin dato'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-orderflow-brief',
    limit: 20,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY no está configurada. El brief de IA no está disponible.' },
      { status: 200 },
    )
  }

  let body: OrderFlowSnapshotBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.symbol) {
    return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })
  }

  const hasAnyData = Boolean(body.book || body.tape || body.liquidations || body.derivatives)
  if (!hasAnyData) {
    return NextResponse.json({ success: false, error: 'No hay datos suficientes todavía' }, { status: 200 })
  }

  const imbalance =
    body.book?.bidDepth !== null && body.book?.bidDepth !== undefined && body.book?.askDepth
      ? body.book.bidDepth - body.book.askDepth
      : null

  const facts = [
    `Símbolo: ${body.symbol}`,
    body.book
      ? `LIBRO DE ÓRDENES: mejor bid ${fmtNum(body.book.bestBid)}, mejor ask ${fmtNum(body.book.bestAsk)}, spread ${fmtNum(body.book.spread, 4)}. Profundidad visible: ${fmtNum(body.book.bidDepth, 4)} en bids vs ${fmtNum(body.book.askDepth, 4)} en asks${imbalance !== null ? ` (desequilibrio neto ${imbalance >= 0 ? '+' : ''}${imbalance.toFixed(4)}, ${imbalance >= 0 ? 'más compradores' : 'más vendedores'} en el libro visible)` : ''}.`
      : 'LIBRO DE ÓRDENES: sin dato todavía.',
    body.tape
      ? `CINTA / CVD: delta de volumen acumulado en esta sesión ${body.tape.cvd !== null && body.tape.cvd >= 0 ? '+' : ''}${fmtNum(body.tape.cvd, 3)} (positivo = presión compradora neta ejecutada, negativo = presión vendedora neta). Último precio operado: ${fmtNum(body.tape.lastPrice)}.`
      : 'CINTA / CVD: sin dato todavía.',
    body.liquidations
      ? `LIQUIDACIONES (BTC+ETH, mayores a $1,000, acumuladas en esta sesión): ${body.liquidations.count} eventos — ${fmtMoney(body.liquidations.longNotional)} en liquidaciones de largos (venta forzada) y ${fmtMoney(body.liquidations.shortNotional)} en liquidaciones de cortos (compra forzada).`
      : 'LIQUIDACIONES: sin liquidaciones significativas registradas todavía en esta sesión.',
    body.derivatives
      ? `DERIVADOS: funding rate actual ${body.derivatives.fundingRate !== null ? `${(body.derivatives.fundingRate * 100).toFixed(4)}%` : 'sin dato'}, open interest ${fmtNum(body.derivatives.openInterest, 0)} unidades del activo, mark price ${fmtNum(body.derivatives.markPrice)}.`
      : 'DERIVADOS: sin dato todavía.',
  ].join('\n')

  const prompt = `Eres M.A.N.U., el analista cuantitativo de Quantum Traders. Con base EXCLUSIVAMENTE en los siguientes datos reales de order flow en vivo (no inventes cifras ni hechos que no estén aquí), escribe un brief profesional de 4-6 líneas en español para un trader que está viendo esta pantalla en este momento. Cubre: sesgo del flujo de órdenes (compradores vs vendedores), qué dice el CVD sobre la presión reciente, si hay riesgo de liquidaciones en cascada dado lo que ya se liquidó, y si el funding/open interest sugiere un mercado sobre-apalancado en algún lado. Sé directo, sin relleno, sin emojis, sin recomendaciones de inversión explícitas (no digas "compra" o "vende"). Si alguna sección dice "sin dato", no la inventes — simplemente no la menciones o dilo brevemente.

DATOS:
${facts}

Devuelve solo el texto del brief, sin títulos ni markdown.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error(`[/api/oracle/orderflow-brief] Claude API responded ${response.status}: ${errorBody}`)
      return NextResponse.json({ success: false, error: 'Claude API request failed' }, { status: 502 })
    }

    const result = await response.json()
    await logAiUsage({ route: 'oracle-orderflow-brief', model: 'claude-haiku-4-5-20251001', usage: result?.usage })
    const text = result?.content?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Empty response from Claude API' }, { status: 502 })
    }

    const briefText = text.trim()

    await insertOrderFlowBrief({
      symbol: body.symbol,
      briefText,
      price: body.tape?.lastPrice ?? body.derivatives?.markPrice ?? null,
      cvd: body.tape?.cvd ?? null,
      fundingRate: body.derivatives?.fundingRate ?? null,
      openInterest: body.derivatives?.openInterest ?? null,
      bookImbalance: imbalance,
      liquidationLongNotional: body.liquidations?.longNotional ?? null,
      liquidationShortNotional: body.liquidations?.shortNotional ?? null,
      snapshot: body,
    })

    return NextResponse.json({ success: true, data: { brief: briefText } })
  } catch (error) {
    console.error('[/api/oracle/orderflow-brief] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate AI brief' }, { status: 502 })
  }
}
