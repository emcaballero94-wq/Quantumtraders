import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { insertOrderFlowBrief, listOrderFlowBriefsSince } from '@/lib/oracle/orderflow-persistence'
import { insertMarketEvents } from '@/lib/oracle/market-events-persistence'
import { buildMarketState, buildMarketStateFromRecord, detectLiquidationReset, type LiveSnapshotInput } from '@/lib/manu/market-state'
import { classifyMarketChanges, deltaBetween } from '@/lib/manu/change-detection'
import { buildRelationships } from '@/lib/manu/relationships'
import { buildEvents, type LiquidationDeltas, type PreviousLiveSnapshot } from '@/lib/manu/event-engine'
import { currentFingerprintFromState, findSimilarConditions } from '@/lib/manu/historical-validation'
import { deriveConfidence, deriveStatus, keyChangeText, riskFactors, buildDeterministicNarrative } from '@/lib/manu/brief-formatter'
import { withAssetLock, shouldSkipBrief } from '@/lib/manu/asset-lock'
import type { MarketEvent } from '@/lib/manu/types'

const HISTORY_LOOKBACK_MS = 20 * 60_000
const MIN_BRIEF_INTERVAL_MS = 5_000

interface AnalyzeRequestBody {
  symbol: string
  book: { bestBid: number | null; bestAsk: number | null; spread: number | null; bidDepth: number | null; askDepth: number | null } | null
  tape: { cvd: number | null; lastPrice: number | null; sessionStartedAt?: number } | null
  liquidations: { longNotional: number; shortNotional: number; count: number; sessionStartedAt?: number } | null
  derivatives: { fundingRate: number | null; openInterest: number | null; markPrice: number | null } | null
  previousBook?: { bestBid: number | null; bestAsk: number | null; spread: number | null; bidDepth: number | null; askDepth: number | null } | null
}

function toLiveSnapshot(body: AnalyzeRequestBody): LiveSnapshotInput {
  return {
    price: body.tape?.lastPrice ?? body.derivatives?.markPrice ?? null,
    cvd: body.tape?.cvd ?? null,
    cvdSessionStartedAt: body.tape?.sessionStartedAt !== undefined ? new Date(body.tape.sessionStartedAt).toISOString() : null,
    fundingRate: body.derivatives?.fundingRate ?? null,
    openInterest: body.derivatives?.openInterest ?? null,
    bookImbalance:
      body.book?.bidDepth !== null && body.book?.bidDepth !== undefined && body.book?.askDepth !== null && body.book?.askDepth !== undefined
        ? body.book.bidDepth - body.book.askDepth
        : null,
    bidDepth: body.book?.bidDepth ?? null,
    askDepth: body.book?.askDepth ?? null,
    spread: body.book?.spread ?? null,
    liquidationLongNotional: body.liquidations?.longNotional ?? null,
    liquidationShortNotional: body.liquidations?.shortNotional ?? null,
    liquidationsSessionStartedAt:
      body.liquidations?.sessionStartedAt !== undefined ? new Date(body.liquidations.sessionStartedAt).toISOString() : null,
  }
}

async function runAnalysis(body: AnalyzeRequestBody) {
  const symbol = body.symbol.toUpperCase()
  const now = new Date()
  const live = toLiveSnapshot(body)

  const history = await listOrderFlowBriefsSince(symbol, new Date(now.getTime() - HISTORY_LOOKBACK_MS).toISOString(), 200)
  const lastRecord = history.length > 0 ? history[history.length - 1] : null

  if (shouldSkipBrief(lastRecord ? new Date(lastRecord.createdAt) : null, now, MIN_BRIEF_INTERVAL_MS)) {
    return { success: true as const, data: { skipped: true, reason: 'debounced' } }
  }

  const state = buildMarketState(symbol, now, live, history)
  const changes = classifyMarketChanges(
    now,
    { price: live.price, cvd: live.cvd, cvdSessionStartedAt: live.cvdSessionStartedAt, openInterest: live.openInterest, fundingRate: live.fundingRate },
    history,
  )
  const relationships = buildRelationships(state)

  const previousState = history.length > 0 ? buildMarketStateFromRecord(symbol, history, history.length - 1) : null
  const previousRegime = previousState?.marketRegime ?? null

  const liquidationResetDetected = detectLiquidationReset(lastRecord, live)
  const liquidationDeltas: LiquidationDeltas | null = liquidationResetDetected
    ? null
    : {
        long: deltaBetween(lastRecord?.liquidationLongNotional, live.liquidationLongNotional),
        short: deltaBetween(lastRecord?.liquidationShortNotional, live.liquidationShortNotional),
      }

  const previousLive: PreviousLiveSnapshot | null = body.previousBook
    ? { bidDepth: body.previousBook.bidDepth, askDepth: body.previousBook.askDepth, spread: body.previousBook.spread }
    : null

  const events = buildEvents(state, changes, previousLive, previousRegime, liquidationDeltas)

  const liqSkew =
    live.liquidationShortNotional !== null && live.liquidationLongNotional !== null && !liquidationResetDetected
      ? live.liquidationShortNotional - live.liquidationLongNotional
      : null
  const fingerprint = currentFingerprintFromState(state.cvdDelta5m, state.openInterestChange5m, state.orderBookImbalance, liqSkew)
  const historical = findSimilarConditions(history, fingerprint)

  const status = deriveStatus(events)
  const keyChange = keyChangeText(events)
  const confidence = deriveConfidence(state, historical, relationships)
  const risks = riskFactors(state, relationships, historical)

  const highSeverityEvents = events.filter((e) => e.severity === 'HIGH' || e.severity === 'CRITICAL')
  await insertMarketEvents(highSeverityEvents)

  const apiKey = process.env.ANTHROPIC_API_KEY
  let narrative: string
  let narrativeSource: 'ai' | 'deterministic' = 'deterministic'

  if (apiKey) {
    const aiNarrative = await generateAiNarrative(apiKey, { state, events, relationships, historical, status, keyChange, confidence, risks })
    if (aiNarrative) {
      narrative = aiNarrative
      narrativeSource = 'ai'
    } else {
      narrative = buildDeterministicNarrative({ status, keyChange, state, events, relationships, historical, confidence })
    }
  } else {
    narrative = buildDeterministicNarrative({ status, keyChange, state, events, relationships, historical, confidence })
  }

  await insertOrderFlowBrief({
    symbol,
    briefText: narrative,
    price: state.price,
    cvd: state.cvd,
    fundingRate: state.funding,
    openInterest: state.openInterest,
    bookImbalance: state.orderBookImbalance,
    liquidationLongNotional: live.liquidationLongNotional,
    liquidationShortNotional: live.liquidationShortNotional,
    cvdSessionStartedAt: live.cvdSessionStartedAt,
    liquidationsSessionStartedAt: live.liquidationsSessionStartedAt,
    snapshot: { manu: { state, events, relationships, historical, status, confidence }, raw: body },
  })

  return {
    success: true as const,
    data: {
      status,
      keyChange,
      narrative,
      narrativeSource,
      confidence,
      risks,
      marketState: state,
      events,
      relationships,
      historicalValidation: historical,
      lastUpdated: now.toISOString(),
    },
  }
}

function fmtNum(value: number | null, decimals = 3): string {
  if (value === null || !Number.isFinite(value)) return 'sin dato'
  return value.toFixed(decimals)
}

async function generateAiNarrative(
  apiKey: string,
  input: {
    state: ReturnType<typeof buildMarketState>
    events: MarketEvent[]
    relationships: ReturnType<typeof buildRelationships>
    historical: ReturnType<typeof findSimilarConditions>
    status: string
    keyChange: string
    confidence: string
    risks: string[]
  },
): Promise<string | null> {
  const { state, events, relationships, historical, status, keyChange, confidence, risks } = input
  const h15 = historical.horizons['15m']

  const facts = [
    `Activo: ${state.asset}. Hora: ${state.timestamp}.`,
    `STATUS calculado por el backend: ${status}.`,
    `KEY CHANGE calculado por el backend: ${keyChange}`,
    `Precio: ${fmtNum(state.price, 2)} (Δ1m ${fmtNum(state.priceChange1m)}%, Δ5m ${fmtNum(state.priceChange5m)}%, Δ15m ${fmtNum(state.priceChange15m)}%).`,
    `CVD: ${fmtNum(state.cvd)} (Δ1m ${fmtNum(state.cvdDelta1m)}, Δ5m ${fmtNum(state.cvdDelta5m)}).`,
    `Funding: ${state.funding !== null ? `${(state.funding * 100).toFixed(4)}%` : 'sin dato'}. Open interest: ${fmtNum(state.openInterest, 0)} (Δ5m ${fmtNum(state.openInterestChange5m)}%).`,
    `Libro: desequilibrio ${fmtNum(state.orderBookImbalance, 4)}, spread ${fmtNum(state.spread, 4)}.`,
    `Liquidaciones acumuladas en sesión: largos ${fmtNum(state.liquidationLong, 0)}, cortos ${fmtNum(state.liquidationShort, 0)}.`,
    `Régimen de mercado: ${state.marketRegime}. Calidad de datos: ${state.dataQuality}.`,
    `Eventos detectados por el backend (${events.length}): ${events.length > 0 ? events.map((e) => `${e.type} (${e.severity})`).join(', ') : 'ninguno'}.`,
    `Relaciones detectadas por el backend: ${relationships.length > 0 ? relationships.map((r) => `${r.pair}: ${r.observation}`).join('; ') : 'ninguna'}.`,
    historical.sampleLabel === 'INSUFFICIENT_SAMPLE'
      ? 'Validación histórica: muestra insuficiente, no reportar cifras de resultado histórico.'
      : `Validación histórica calculada por el backend: n=${historical.sampleSize} (${historical.sampleLabel}). Horizonte 15m: tasa positiva ${fmtNum(h15.positiveRatePct, 1)}%, retorno mediana ${fmtNum(h15.medianReturnPct)}%, retorno promedio ${fmtNum(h15.meanReturnPct)}%, MFE ${fmtNum(h15.maxFavorableExcursionPct)}%, MAE ${fmtNum(h15.maxAdverseExcursionPct)}% (n graded=${h15.gradedCount}).`,
    `CONFIDENCE calculado por el backend: ${confidence}.`,
    `Factores de riesgo calculados por el backend: ${risks.join(' ')}`,
  ].join('\n')

  const prompt = `Eres M.A.N.U. (Market Analysis & Navigation Unit) de Quantum Traders. La interfaz ya le muestra al trader, por separado y antes de tu texto, el símbolo, la hora, el STATUS y el KEY CHANGE — NO los repitas ni les pongas título propio. Con base EXCLUSIVAMENTE en los datos ya calculados abajo (no inventes ni recalcules ninguna cifra, ninguna estadística, ningún porcentaje — todos ya vienen calculados por el backend), redacta SOLO estas secciones, en este orden y con estos títulos exactos:

FLOW
[1-2 líneas sobre CVD / flujo agresivo]

LEVEL 2
[1-2 líneas sobre libro de órdenes / liquidez / desequilibrio]

DERIVATIVES
[1-2 líneas sobre OI / funding / liquidaciones]

RELATIONSHIPS
[1-2 líneas sobre las relaciones detectadas, sin convertirlas en señales de compra/venta]

HISTORICAL CONTEXT
[si hay muestra suficiente, resume n, tasa positiva, mediana y media; si no, escribe literalmente "Historical validation unavailable: insufficient observations."]

INTERPRETATION
[1-3 líneas interpretando la combinación de datos, sin afirmar que el precio subirá o bajará, sin recomendaciones explícitas de compra/venta]

RISK
[1-2 líneas basadas en los factores de riesgo dados]

DATOS (STATUS y KEY CHANGE son solo contexto, no los repitas en tu respuesta):
${facts}

Responde en español. Devuelve solo esas ocho secciones con su título, sin markdown adicional, sin repetir STATUS, KEY CHANGE ni CONFIDENCE (la interfaz ya los muestra aparte).`

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
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error(`[/api/manu/analyze] Claude API responded ${response.status}: ${errorBody}`)
      return null
    }

    const result = await response.json()
    const text = result?.content?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (error) {
    console.error('[/api/manu/analyze] Error:', error)
    return null
  }
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'manu-analyze',
    limit: 20,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  let body: AnalyzeRequestBody
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

  try {
    const result = await withAssetLock(body.symbol.toUpperCase(), () => runAnalysis(body))
    return NextResponse.json(result)
  } catch (error) {
    console.error('[/api/manu/analyze] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to run M.A.N.U. analysis' }, { status: 502 })
  }
}
