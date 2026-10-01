import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { fetchGexMatrixInput, type GexAssetClass } from '@/lib/gex/fetch-matrix-input'
import { computeGexMatrix } from '@/lib/gex/matrix'
import { listGexSnapshots } from '@/lib/gex/snapshot-persistence'
import { summarizeChain } from '@/lib/manu-gex/chain-summary'
import { compareToSnapshot } from '@/lib/manu-gex/day-over-day'
import { deriveGexStatus, keyChangeText, buildDeterministicGexNarrative } from '@/lib/manu-gex/narrative'
import type { GexBriefFacts, GexRegime } from '@/lib/manu-gex/types'

const EXPIRATIONS_FOR_BRIEF = 8

interface GexAnalyzeRequestBody {
  assetClass: GexAssetClass
  symbol: string
}

function fmtNum(value: number | null, decimals = 2): string {
  return value === null || !Number.isFinite(value) ? 'sin dato' : value.toFixed(decimals)
}

async function buildFacts(assetClass: GexAssetClass, symbol: string): Promise<GexBriefFacts | null> {
  const { underlyingPrice, perExpiration } = await fetchGexMatrixInput(assetClass, symbol, EXPIRATIONS_FOR_BRIEF)
  if (underlyingPrice === null || perExpiration.length === 0) return null

  const matrix = computeGexMatrix(perExpiration, underlyingPrice)

  const contractsWithGamma = matrix.expirations.reduce((sum, e) => sum + e.result.contractsWithGamma, 0)
  const totalContracts = matrix.expirations.reduce((sum, e) => sum + e.result.totalContracts, 0)
  const maxPainStrike = matrix.expirations.find((e) => e.result.maxPainStrike !== null)?.result.maxPainStrike ?? null

  const allContracts = perExpiration.flatMap((e) => e.contracts)
  const chain = summarizeChain(allContracts.map((c) => ({ optionType: c.optionType, volume: c.volume ?? null, openInterest: c.openInterest, iv: c.iv })))

  const snapshotDate = new Date().toISOString().slice(0, 10)
  const priorSnapshots = await listGexSnapshots(assetClass, symbol, 5)
  const priorSnapshot = priorSnapshots.find((s) => s.snapshotDate < snapshotDate) ?? null
  const dayOverDay = priorSnapshot
    ? compareToSnapshot(
        { netGex: matrix.aggregate.netGex, callWallStrike: matrix.aggregate.callWallStrike, putWallStrike: matrix.aggregate.putWallStrike },
        priorSnapshot,
      )
    : null

  const regime: GexRegime = matrix.aggregate.netGex >= 0 ? 'POSITIVE' : 'NEGATIVE'

  return {
    assetClass,
    symbol,
    underlyingPrice,
    netGex: matrix.aggregate.netGex,
    regime,
    callWallStrike: matrix.aggregate.callWallStrike,
    putWallStrike: matrix.aggregate.putWallStrike,
    gammaFlip: matrix.aggregate.gammaFlip,
    maxPainStrike,
    contractsWithGamma,
    totalContracts,
    dataQuality: totalContracts > 0 && contractsWithGamma / totalContracts >= 0.5 ? 'GOOD' : 'DEGRADED',
    chain,
    dayOverDay,
  }
}

async function generateAiNarrative(apiKey: string, facts: GexBriefFacts, status: string, keyChange: string): Promise<string | null> {
  const d = facts.dayOverDay
  const factLines = [
    `Activo: ${facts.symbol} (${facts.assetClass === 'equity' ? 'acciones' : 'cripto'}). Subyacente: ${fmtNum(facts.underlyingPrice)}.`,
    `STATUS calculado por el backend: ${status}.`,
    `KEY CHANGE calculado por el backend: ${keyChange}`,
    `Net GEX: ${fmtNum(facts.netGex, 0)} (régimen ${facts.regime === 'POSITIVE' ? 'positivo' : 'negativo'}).`,
    `Call wall: ${fmtNum(facts.callWallStrike)}. Put wall: ${fmtNum(facts.putWallStrike)}. Gamma flip: ${fmtNum(facts.gammaFlip)}. Max pain: ${fmtNum(facts.maxPainStrike)}.`,
    `Calidad de datos: ${facts.dataQuality} (${facts.contractsWithGamma}/${facts.totalContracts} contratos con gamma calculable, sobre ${EXPIRATIONS_FOR_BRIEF} vencimientos más cercanos).`,
    d
      ? `Comparación con la sesión anterior (${d.priorDate}) calculada por el backend: net GEX pasó de ${fmtNum(d.priorNetGex, 0)} a ${fmtNum(facts.netGex, 0)} (${fmtNum(d.netGexChangePct, 1)}%), régimen: ${d.regimeShift}. Call wall ${fmtNum(d.priorCallWallStrike)} → ${fmtNum(facts.callWallStrike)}. Put wall ${fmtNum(d.priorPutWallStrike)} → ${fmtNum(facts.putWallStrike)}.`
      : 'No hay snapshot de una sesión anterior todavía — no reportar ninguna comparación día a día.',
    `Flujo de opciones calculado por el backend: put/call volumen ${fmtNum(facts.chain.putCallVolumeRatio)}, put/call open interest ${fmtNum(facts.chain.putCallOpenInterestRatio)}, IV promedio calls ${fmtNum(facts.chain.avgCallIv, 4)}, IV promedio puts ${fmtNum(facts.chain.avgPutIv, 4)}, skew (put−call) ${fmtNum(facts.chain.ivSkew, 4)}.`,
  ].join('\n')

  const prompt = `Eres M.A.N.U. (Market Analysis & Navigation Unit) de Quantum Traders, en su variante de GEX y opciones. La interfaz ya le muestra al trader, por separado y antes de tu texto, el símbolo, el STATUS y el KEY CHANGE — NO los repitas ni les pongas título propio. Con base EXCLUSIVAMENTE en los datos ya calculados abajo (no inventes ni recalcules ninguna cifra — todos ya vienen calculados por el backend), redacta SOLO estas secciones, en este orden y con estos títulos exactos:

RÉGIMEN
[1-2 líneas sobre el net GEX y qué implica el signo para el hedging de dealers — sin afirmar que el precio subirá o bajará]

NIVELES
[1-2 líneas sobre call wall, put wall, gamma flip y max pain, y la distancia del subyacente a cada uno]

CAMBIO VS. SESIÓN ANTERIOR
[si hay comparación, descríbela; si no la hay, escribe literalmente "Sin historial todavía — esta es la primera sesión registrada para este símbolo."]

FLUJO DE OPCIONES
[1-2 líneas sobre el put/call ratio y el skew de volatilidad implícita, sin convertirlo en señal de compra/venta]

INTERPRETACIÓN
[1-3 líneas interpretando la combinación de datos, sin recomendaciones explícitas de compra/venta]

RIESGO
[1-2 líneas: calidad de datos, qué invalidaría esta lectura]

DATOS (STATUS y KEY CHANGE son solo contexto, no los repitas en tu respuesta):
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
      console.error(`[/api/manu/gex-analyze] Claude API responded ${response.status}: ${errorBody}`)
      return null
    }

    const result = await response.json()
    const text = result?.content?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (error) {
    console.error('[/api/manu/gex-analyze] Error:', error)
    return null
  }
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'manu-gex-analyze',
    limit: 15,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  let body: GexAnalyzeRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (body.assetClass !== 'equity' && body.assetClass !== 'crypto') {
    return NextResponse.json({ success: false, error: 'assetClass must be equity or crypto' }, { status: 400 })
  }
  if (!body.symbol?.trim()) {
    return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })
  }

  try {
    const symbol = body.symbol.trim().toUpperCase()
    const facts = await buildFacts(body.assetClass, symbol)
    if (!facts) {
      return NextResponse.json({ success: false, error: `No hay datos de opciones suficientes para ${symbol} todavía.` }, { status: 200 })
    }

    const status = deriveGexStatus(facts)
    const keyChange = keyChangeText(facts)

    const apiKey = process.env.ANTHROPIC_API_KEY
    let narrative: string
    let narrativeSource: 'ai' | 'deterministic' = 'deterministic'

    if (apiKey) {
      const aiNarrative = await generateAiNarrative(apiKey, facts, status, keyChange)
      if (aiNarrative) {
        narrative = aiNarrative
        narrativeSource = 'ai'
      } else {
        narrative = buildDeterministicGexNarrative(facts)
      }
    } else {
      narrative = buildDeterministicGexNarrative(facts)
    }

    return NextResponse.json({
      success: true,
      data: { status, keyChange, narrative, narrativeSource, facts, lastUpdated: new Date().toISOString() },
    })
  } catch (error) {
    console.error('[/api/manu/gex-analyze] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to run the GEX & Options analysis' }, { status: 502 })
  }
}
