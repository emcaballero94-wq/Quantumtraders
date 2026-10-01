import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { listOrderFlowBriefsSince } from '@/lib/oracle/orderflow-persistence'
import { parseTimeWindow, clampSince, buildFlowTimeline, type FlowBucket } from '@/lib/oracle/orderflow-memory'

const MIN_RECORDS = 2

function fmtNum(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return 'sin dato'
  return value.toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function fmtMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'sin dato'
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function describeBucket(bucket: FlowBucket): string {
  const priceMove =
    bucket.priceStart !== null && bucket.priceEnd !== null
      ? `precio ${fmtNum(bucket.priceStart)} → ${fmtNum(bucket.priceEnd)} (${bucket.priceChangePct !== null ? `${bucket.priceChangePct >= 0 ? '+' : ''}${bucket.priceChangePct.toFixed(3)}%` : 'sin dato'})`
      : 'precio sin dato'
  const cvdMove =
    bucket.cvdStart !== null && bucket.cvdEnd !== null
      ? `CVD ${fmtNum(bucket.cvdStart, 3)} → ${fmtNum(bucket.cvdEnd, 3)}`
      : 'CVD sin dato'
  return `${bucket.startLabel}-${bucket.endLabel} UTC: ${priceMove}, ${cvdMove}, desequilibrio prom. del libro ${fmtNum(bucket.avgBookImbalance, 4)}, funding prom. ${bucket.avgFundingRate !== null ? `${(bucket.avgFundingRate * 100).toFixed(4)}%` : 'sin dato'}, sesgo del tramo: ${bucket.bias}.`
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-orderflow-memory',
    limit: 20,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'ANTHROPIC_API_KEY no está configurada. La memoria intradía no está disponible.' },
      { status: 200 },
    )
  }

  let body: { symbol?: string; question?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const symbol = body.symbol?.trim().toUpperCase()
  const question = body.question?.trim()
  if (!symbol || !question) {
    return NextResponse.json({ success: false, error: 'symbol and question are required' }, { status: 400 })
  }

  const now = new Date()
  const window = parseTimeWindow(question, now)
  const since = clampSince(window.since, now)

  const records = await listOrderFlowBriefsSince(symbol, since.toISOString(), 500)
  if (records.length < MIN_RECORDS) {
    return NextResponse.json({
      success: false,
      error: `Todavía no hay suficiente historial guardado para ${symbol} ${window.label} (${records.length} registro(s)). Deja la página de Order Flow abierta un rato más.`,
    })
  }

  const timeline = buildFlowTimeline(records)
  const first = records[0]
  const last = records[records.length - 1]

  const overallPriceChangePct =
    first.price !== null && last.price !== null && first.price !== 0
      ? ((last.price - first.price) / first.price) * 100
      : null

  const liquidationLongDelta =
    first.liquidationLongNotional !== null && last.liquidationLongNotional !== null
      ? last.liquidationLongNotional - first.liquidationLongNotional
      : null
  const liquidationShortDelta =
    first.liquidationShortNotional !== null && last.liquidationShortNotional !== null
      ? last.liquidationShortNotional - first.liquidationShortNotional
      : null
  const liquidationsResetDetected =
    (liquidationLongDelta !== null && liquidationLongDelta < 0) ||
    (liquidationShortDelta !== null && liquidationShortDelta < 0)

  const facts = [
    `Símbolo: ${symbol}. Ventana solicitada: ${window.label}. Registros analizados: ${records.length} (de ${new Date(first.createdAt).toISOString()} a ${new Date(last.createdAt).toISOString()}).`,
    `Movimiento de precio en toda la ventana: ${fmtNum(first.price)} → ${fmtNum(last.price)} (${overallPriceChangePct !== null ? `${overallPriceChangePct >= 0 ? '+' : ''}${overallPriceChangePct.toFixed(3)}%` : 'sin dato'}).`,
    'LÍNEA DE TIEMPO (order flow dividido en tramos cronológicos):',
    ...timeline.map((b) => `- ${describeBucket(b)}`),
    liquidationsResetDetected
      ? 'Liquidaciones: el contador se reinició al menos una vez en esta ventana (probablemente se recargó la página), así que el delta acumulado de liquidaciones en este periodo no es confiable — no lo reportes como cifra exacta.'
      : `Liquidaciones acumuladas en la ventana: ${fmtMoney(liquidationLongDelta)} en largos, ${fmtMoney(liquidationShortDelta)} en cortos.`,
    'NOTA: el CVD es un acumulado de volumen desde que se abrió la pantalla de Order Flow y se reinicia a cero cada vez que se recarga la página — una caída brusca en la línea de tiempo puede ser un reinicio de sesión, no necesariamente presión vendedora real. Tenlo en cuenta al interpretar los tramos.',
  ].join('\n')

  const prompt = `Eres M.A.N.U., el analista cuantitativo de Quantum Traders. Un trader te pregunta sobre la evolución histórica del order flow de ${symbol}. Con base EXCLUSIVAMENTE en los datos reales de abajo (no inventes cifras, eventos ni tramos que no estén ahí), responde su pregunta describiendo la progresión cronológica: qué pasó primero, en qué momento cambió el sesgo (si cambió), si el CVD/desequilibrio del libro confirmó o divergió del movimiento de precio, y si hubo señales de sobreapalancamiento o liquidaciones relevantes. Cierra con el estado más reciente. Sé directo, sin relleno, sin emojis, sin recomendaciones de inversión explícitas (no digas "compra" o "vende"). Responde en español, 6-10 líneas.

PREGUNTA DEL TRADER: "${question}"

DATOS:
${facts}

Devuelve solo el texto de la respuesta, sin títulos ni markdown.`

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
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error(`[/api/oracle/orderflow-memory] Claude API responded ${response.status}: ${errorBody}`)
      return NextResponse.json({ success: false, error: 'Claude API request failed' }, { status: 502 })
    }

    const result = await response.json()
    const text = result?.content?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Empty response from Claude API' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      data: {
        answer: text.trim(),
        windowLabel: window.label,
        recordCount: records.length,
        timeline,
      },
    })
  } catch (error) {
    console.error('[/api/oracle/orderflow-memory] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate AI answer' }, { status: 502 })
  }
}
