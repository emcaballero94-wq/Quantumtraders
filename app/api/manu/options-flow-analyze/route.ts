import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { computeOptionsFlowSnapshot } from '@/lib/options-flow/compute-snapshot'
import { deriveOptionsFlowLean, keyChangeText, buildDeterministicOptionsFlowNarrative } from '@/lib/manu-options-flow/narrative'
import { insertOptionsFlowBrief, listOptionsFlowBriefs } from '@/lib/manu-options-flow/brief-persistence'
import type { OptionsFlowBriefFacts } from '@/lib/manu-options-flow/types'
import { logAiUsage } from '@/lib/ai-usage/usage-log'
import type { CryptoCurrency } from '@/lib/manu/crypto-symbol-mapping'

const MAX_LARGE_TRADES_FOR_PROMPT = 5

function fmtNum(value: number | null, decimals = 2): string {
  return value === null || !Number.isFinite(value) ? 'sin dato' : value.toFixed(decimals)
}

function fmtUsd(value: number | null): string {
  if (value === null) return 'sin dato'
  return `$${Math.abs(value).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}`
}

async function buildFacts(currency: CryptoCurrency): Promise<OptionsFlowBriefFacts | null> {
  const snapshot = await computeOptionsFlowSnapshot(currency)
  if (snapshot.tradeCount === 0) return null

  return {
    currency,
    underlyingPriceUsd: snapshot.spotPriceUsd,
    tradeCount: snapshot.tradeCount,
    score: snapshot.score.value,
    scoreConfidence: snapshot.score.confidence,
    dataQuality: snapshot.score.dataQuality,
    bullishPremium: snapshot.directional.bullishPremium,
    bearishPremium: snapshot.directional.bearishPremium,
    callPremium: snapshot.totals.callPremium,
    putPremium: snapshot.totals.putPremium,
    callPutRatio: snapshot.totals.callPutRatioByPremium,
    noiseContractsPct: snapshot.noise.noiseContractsPct,
    adjustedCallPremium: snapshot.noise.adjustedTotals.callPremium,
    adjustedPutPremium: snapshot.noise.adjustedTotals.putPremium,
    adjustedCallPutRatio: snapshot.noise.adjustedTotals.callPutRatioByPremium,
    acceleration: snapshot.acceleration
      ? {
          direction: snapshot.acceleration.direction,
          magnitudePct: snapshot.acceleration.magnitudePct,
          trackedDirection: snapshot.acceleration.trackedDirection,
          windowMinutes: snapshot.acceleration.windowMinutes,
        }
      : null,
    largeTradeCount: snapshot.largeTrades.length,
    topLargeTrades: snapshot.largeTrades.slice(0, MAX_LARGE_TRADES_FOR_PROMPT).map((lt) => ({
      optionType: lt.trade.optionType,
      strike: lt.trade.strike,
      side: lt.trade.side,
      premium: lt.trade.premium,
      dte: lt.trade.dte,
      direction: lt.classification.direction,
    })),
    keyStrikes: snapshot.keyStrikes.map((k) => ({
      strike: k.strike,
      shareOfTotalPremium: k.shareOfTotalPremium,
      netDirectionalPressure: k.level.netDirectionalPressure,
    })),
  }
}

async function generateAiNarrative(apiKey: string, facts: OptionsFlowBriefFacts, keyChange: string): Promise<string | null> {
  const factLines = [
    `Moneda: ${facts.currency}. ${facts.tradeCount} trades de opciones recientes en Deribit (hasta 1000, no es un histórico completo de la sesión).`,
    `KEY CHANGE calculado por el backend: ${keyChange}`,
    `Score de presión: ${facts.score}/100 (confianza ${facts.scoreConfidence}, calidad de datos ${facts.dataQuality}).`,
    `Premium clasificado (no CALL/PUT bruto): ${fmtUsd(facts.bullishPremium)} alcista vs ${fmtUsd(facts.bearishPremium)} bajista.`,
    `Premium bruto: ${fmtUsd(facts.callPremium)} en calls, ${fmtUsd(facts.putPremium)} en puts. Call/Put ratio por prima: ${fmtNum(facts.callPutRatio)}.`,
    facts.acceleration
      ? `Aceleración calculada por el backend: prima ${facts.acceleration.trackedDirection === 'BULLISH' ? 'alcista' : 'bajista'} ${facts.acceleration.direction === 'INCREASING' ? 'acelerando' : facts.acceleration.direction === 'DECREASING' ? 'frenando' : 'estable'}${facts.acceleration.magnitudePct !== null ? ` (${facts.acceleration.magnitudePct >= 0 ? '+' : ''}${facts.acceleration.magnitudePct.toFixed(0)}% vs los ${facts.acceleration.windowMinutes} min previos)` : ''}.`
      : 'Sin base de comparación para aceleración todavía.',
    facts.largeTradeCount > 0
      ? `${facts.largeTradeCount} operaciones grandes (percentil 90). Las más relevantes:\n${facts.topLargeTrades.map((t) => `  - ${t.optionType} ${t.side === 'BUY' ? 'compra' : t.side === 'SELL' ? 'venta' : 'lado desconocido'} strike ${t.strike.toLocaleString('en-US')}, ${t.dte} DTE, ${fmtUsd(t.premium)}, clasificada ${t.direction === 'BULLISH' ? 'alcista' : t.direction === 'BEARISH' ? 'bajista' : 'sin lado claro'}.`).join('\n')}`
      : 'Sin operaciones grandes detectadas en la muestra actual.',
    facts.keyStrikes.length > 0
      ? `Strikes clave calculados por el backend (concentración de premium, NO soporte/resistencia confirmado): ${facts.keyStrikes.map((k) => `${k.strike.toLocaleString('en-US')} (${(k.shareOfTotalPremium * 100).toFixed(0)}% del premium total)`).join(', ')}.`
      : 'Sin concentración relevante por strike en la muestra actual.',
  ].join('\n')

  const prompt = `Eres M.A.N.U. (Market Analysis & Navigation Unit) de Quantum Traders, en su variante de Options Flow cripto (Deribit, BTC/ETH). La interfaz ya le muestra al trader, por separado y antes de tu texto, el score y el KEY CHANGE — NO los repitas ni les pongas título propio. Con base EXCLUSIVAMENTE en los datos ya calculados abajo (no inventes ni recalcules ninguna cifra — todos ya vienen calculados por el backend), redacta SOLO estas secciones, en este orden y con estos títulos exactos:

PRESIÓN
[1-2 líneas sobre el score y el premium clasificado alcista vs bajista — sin afirmar que el precio subirá o bajará]

OPERACIONES GRANDES
[1-2 líneas sobre qué dominan las operaciones grandes (compra/venta, calls/puts); si no hay, escribe literalmente "Sin operaciones grandes detectadas en la muestra actual."]

STRIKES CLAVE
[1-2 líneas sobre dónde se concentra el capital; aclará siempre que es concentración de premium, no soporte o resistencia confirmado; si no hay datos, escribe literalmente "Sin concentración relevante por strike en la muestra actual."]

ACELERACIÓN
[1 línea sobre si el flujo clasificado se está acelerando, frenando o estable; si no hay base de comparación, escribe literalmente "Sin base de comparación para aceleración todavía."]

INTERPRETACIÓN
[1-3 líneas combinando todo lo anterior, sin recomendaciones explícitas de compra/venta]

RIESGO
[1-2 líneas: recordá que es una ventana de hasta 1000 trades recientes (no la sesión completa) y que la clasificación es por operación individual — no detecta spreads ni combos, así que un leg vendido puede ser parte de una estrategia neutral, no una apuesta direccional aislada]

DATOS (KEY CHANGE es solo contexto, no lo repitas en tu respuesta):
${factLines}

Responde en español. Devuelve solo esas seis secciones con su título, sin markdown adicional.`

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
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error(`[/api/manu/options-flow-analyze] Claude API responded ${response.status}: ${errorBody}`)
      return null
    }

    const result = await response.json()
    await logAiUsage({ route: 'manu-options-flow-analyze', model: 'claude-haiku-4-5-20251001', usage: result?.usage })
    const text = result?.content?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (error) {
    console.error('[/api/manu/options-flow-analyze] Error:', error)
    return null
  }
}

interface OptionsFlowAnalyzeRequestBody {
  currency: CryptoCurrency
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'manu-options-flow-analyze',
    limit: 15,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  let body: OptionsFlowAnalyzeRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.currency !== 'BTC' && body.currency !== 'ETH') {
    return NextResponse.json({ success: false, error: 'currency must be BTC or ETH' }, { status: 400 })
  }

  try {
    const facts = await buildFacts(body.currency)
    if (!facts) {
      return NextResponse.json({ success: false, error: `Sin trades recientes de opciones de ${body.currency} en Deribit.` }, { status: 200 })
    }

    const lean = deriveOptionsFlowLean(facts)
    const keyChange = keyChangeText(facts)

    const apiKey = process.env.ANTHROPIC_API_KEY
    let narrative: string
    let narrativeSource: 'ai' | 'deterministic' = 'deterministic'

    if (apiKey) {
      const aiNarrative = await generateAiNarrative(apiKey, facts, keyChange)
      if (aiNarrative) {
        narrative = aiNarrative
        narrativeSource = 'ai'
      } else {
        narrative = buildDeterministicOptionsFlowNarrative(facts)
      }
    } else {
      narrative = buildDeterministicOptionsFlowNarrative(facts)
    }

    await insertOptionsFlowBrief({ currency: body.currency, lean, keyChange, narrative, narrativeSource, facts })

    return NextResponse.json({
      success: true,
      data: { lean, keyChange, narrative, narrativeSource, facts, lastUpdated: new Date().toISOString() },
    })
  } catch (error) {
    console.error('[/api/manu/options-flow-analyze] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to run the Options Flow analysis' }, { status: 502 })
  }
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'manu-options-flow-analyze-history',
    limit: 30,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const currency = searchParams.get('currency')?.trim().toUpperCase()
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 10

  if (currency !== 'BTC' && currency !== 'ETH') {
    return NextResponse.json({ success: false, error: 'currency must be BTC or ETH' }, { status: 400 })
  }

  const briefs = await listOptionsFlowBriefs(currency, limit)
  return NextResponse.json({ success: true, data: { briefs } })
}
