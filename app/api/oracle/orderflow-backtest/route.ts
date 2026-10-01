import { NextResponse } from 'next/server'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'
import { listOrderFlowBriefs, type OrderFlowBriefRecord } from '@/lib/oracle/orderflow-persistence'
import { computeForwardOutcome } from '@/lib/manu/forward-returns'
import { logAiUsage } from '@/lib/ai-usage/usage-log'

const MIN_RECORDS = 5
const FUNDING_OVERHEATED_THRESHOLD = 0.0003 // 0.03% — a commonly-cited "hot" funding rate on Binance perps

type Bias = 'bullish' | 'bearish' | 'neutral'

function sign(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0
  if (value > 0) return 1
  if (value < 0) return -1
  return 0
}

function classifyBias(record: OrderFlowBriefRecord): Bias {
  const liquidationSkew =
    record.liquidationShortNotional !== null && record.liquidationLongNotional !== null
      ? record.liquidationShortNotional - record.liquidationLongNotional
      : null
  const fundingSignal =
    record.fundingRate === null
      ? 0
      : record.fundingRate < 0
        ? 1
        : record.fundingRate > FUNDING_OVERHEATED_THRESHOLD
          ? -1
          : 0

  const score = sign(record.cvd) + sign(record.bookImbalance) + sign(liquidationSkew) + fundingSignal
  if (score > 0) return 'bullish'
  if (score < 0) return 'bearish'
  return 'neutral'
}

interface BacktestRow {
  record: OrderFlowBriefRecord
  bias: Bias
  forwardReturnPct: number | null
  maxFavorableExcursionPct: number | null
  maxAdverseExcursionPct: number | null
  hit: boolean | null
}

// Forward-return/MFE/MAE scanning is shared with lib/manu/historical-validation.ts
// (see lib/manu/forward-returns.ts) so this and M.A.N.U.'s pattern matching don't
// each maintain their own definition of "what happened after this point".
function buildBacktestRows(records: OrderFlowBriefRecord[], horizonMs: number): BacktestRow[] {
  return records.map((record, i) => {
    const bias = classifyBias(record)
    const outcome = computeForwardOutcome(records, i, horizonMs)

    let hit: boolean | null = null
    if (outcome.forwardReturnPct !== null && bias !== 'neutral') {
      hit = (bias === 'bullish' && outcome.forwardReturnPct > 0) || (bias === 'bearish' && outcome.forwardReturnPct < 0)
    }

    return {
      record,
      bias,
      forwardReturnPct: outcome.forwardReturnPct,
      maxFavorableExcursionPct: outcome.maxFavorableExcursionPct,
      maxAdverseExcursionPct: outcome.maxAdverseExcursionPct,
      hit,
    }
  })
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'oracle-orderflow-backtest',
    limit: 20,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')?.trim().toUpperCase()
  const horizonMinutes = Number.parseInt(searchParams.get('horizonMinutes') ?? '15', 10) || 15

  if (!symbol) {
    return NextResponse.json({ success: false, error: 'symbol is required' }, { status: 400 })
  }

  const records = await listOrderFlowBriefs(symbol, 1000)
  if (records.length < MIN_RECORDS) {
    return NextResponse.json({
      success: false,
      error: `Todavía no hay suficiente historial guardado para ${symbol} (${records.length} registros, se necesitan al menos ${MIN_RECORDS}). Deja la página de Order Flow abierta un rato más.`,
    })
  }

  const rows = buildBacktestRows(records, horizonMinutes * 60_000)
  const gradedRows = rows.filter((row) => row.hit !== null)
  const hits = gradedRows.filter((row) => row.hit).length
  const hitRatePct = gradedRows.length > 0 ? (hits / gradedRows.length) * 100 : null

  const bullishRows = gradedRows.filter((row) => row.bias === 'bullish')
  const bearishRows = gradedRows.filter((row) => row.bias === 'bearish')
  const bullishReturns = bullishRows.map((row) => row.forwardReturnPct as number)
  const bearishReturns = bearishRows.map((row) => row.forwardReturnPct as number)
  const avg = (values: number[]) => (values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null)
  const mfe = (rows: BacktestRow[]) => {
    const values = rows.map((r) => r.maxFavorableExcursionPct).filter((v): v is number => v !== null)
    return values.length > 0 ? Math.max(...values) : null
  }
  const mae = (rows: BacktestRow[]) => {
    const values = rows.map((r) => r.maxAdverseExcursionPct).filter((v): v is number => v !== null)
    return values.length > 0 ? Math.min(...values) : null
  }

  const stats = {
    symbol,
    horizonMinutes,
    totalRecords: records.length,
    gradedRecords: gradedRows.length,
    hitRatePct,
    avgReturnPctWhenBullish: avg(bullishReturns),
    avgReturnPctWhenBearish: avg(bearishReturns),
    medianReturnPctWhenBullish: median(bullishReturns),
    medianReturnPctWhenBearish: median(bearishReturns),
    maxFavorableExcursionPctWhenBullish: mfe(bullishRows),
    maxAdverseExcursionPctWhenBullish: mae(bullishRows),
    maxFavorableExcursionPctWhenBearish: mfe(bearishRows),
    maxAdverseExcursionPctWhenBearish: mae(bearishRows),
    bullishCount: bullishReturns.length,
    bearishCount: bearishReturns.length,
    neutralCount: rows.length - bullishReturns.length - bearishReturns.length,
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: true, data: { stats, narrative: null, narrativeError: 'ANTHROPIC_API_KEY no configurada — solo estadísticas.' } })
  }

  if (gradedRows.length === 0) {
    return NextResponse.json({
      success: true,
      data: { stats, narrative: null, narrativeError: 'Ningún registro tiene todavía suficiente tiempo transcurrido para medir el retorno a futuro.' },
    })
  }

  const bestHit = [...gradedRows].filter((r) => r.hit).sort((a, b) => Math.abs(b.forwardReturnPct!) - Math.abs(a.forwardReturnPct!))[0]
  const worstMiss = [...gradedRows].filter((r) => !r.hit).sort((a, b) => Math.abs(b.forwardReturnPct!) - Math.abs(a.forwardReturnPct!))[0]

  const facts = [
    `Símbolo: ${symbol}. Horizonte de evaluación: ${horizonMinutes} minutos hacia adelante.`,
    `Registros totales guardados: ${stats.totalRecords}. Registros evaluables (con retorno a futuro medible y sesgo no neutral): ${stats.gradedRecords}.`,
    stats.hitRatePct !== null
      ? `Tasa de acierto direccional del sesgo compuesto (CVD + desequilibrio del libro + liquidaciones + funding): ${stats.hitRatePct.toFixed(1)}% sobre ${stats.gradedRecords} casos.`
      : 'Sin suficientes casos evaluables para calcular tasa de acierto.',
    `Retorno promedio a ${horizonMinutes}min cuando el sesgo era alcista: ${stats.avgReturnPctWhenBullish !== null ? `${stats.avgReturnPctWhenBullish.toFixed(3)}%` : 'sin datos'} (${stats.bullishCount} casos).`,
    `Retorno promedio a ${horizonMinutes}min cuando el sesgo era bajista: ${stats.avgReturnPctWhenBearish !== null ? `${stats.avgReturnPctWhenBearish.toFixed(3)}%` : 'sin datos'} (${stats.bearishCount} casos).`,
    bestHit ? `Mejor acierto: brief "${bestHit.record.briefText.slice(0, 200)}" → retorno real ${bestHit.forwardReturnPct!.toFixed(3)}%.` : null,
    worstMiss ? `Peor fallo: brief "${worstMiss.record.briefText.slice(0, 200)}" → retorno real ${worstMiss.forwardReturnPct!.toFixed(3)}%.` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `Eres M.A.N.U., el analista cuantitativo de Quantum Traders. Acabas de recibir los resultados de un backtest sobre tus propios briefs de order flow pasados para ${symbol}: se comparó el sesgo compuesto de cada brief (derivado de CVD, desequilibrio del libro, liquidaciones y funding) contra lo que el precio realmente hizo ${horizonMinutes} minutos después. Con base EXCLUSIVAMENTE en las siguientes cifras reales (no inventes nada), escribe un resumen de 4-6 líneas en español: si la tasa de acierto es meramente aceptable, dilo con honestidad — con este tamaño de muestra no es una prueba estadística fuerte. No des recomendaciones de inversión explícitas.

DATOS DEL BACKTEST:
${facts}

Devuelve solo el texto del resumen, sin títulos ni markdown.`

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
      console.error(`[/api/oracle/orderflow-backtest] Claude API responded ${response.status}: ${errorBody}`)
      return NextResponse.json({ success: true, data: { stats, narrative: null, narrativeError: 'Claude API request failed' } })
    }

    const result = await response.json()
    await logAiUsage({ route: 'oracle-orderflow-backtest', model: 'claude-haiku-4-5-20251001', usage: result?.usage })
    const text = result?.content?.[0]?.text
    const narrative = typeof text === 'string' && text.trim() ? text.trim() : null

    return NextResponse.json({ success: true, data: { stats, narrative, narrativeError: narrative ? null : 'Empty response from Claude API' } })
  } catch (error) {
    console.error('[/api/oracle/orderflow-backtest] Error:', error)
    return NextResponse.json({ success: true, data: { stats, narrative: null, narrativeError: 'Failed to generate AI summary' } })
  }
}
