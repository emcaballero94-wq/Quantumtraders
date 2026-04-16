import { NextResponse } from 'next/server'
import {
  insertTradeJournalEntry,
  listTradeJournalEntries,
  listTradeChecklistsByTradeIds,
  upsertTradeChecklist,
} from '@/lib/oracle/persistence'
import { buildOracleState } from '@/lib/oracle/live-state'
import { scoreSetupFromAsset } from '@/lib/oracle/setup-rules'
import { withApiCache } from '@/lib/server/api-cache'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'journal-trades-get',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  try {
    const entries = await withApiCache('journal-trades', 10_000, async () => listTradeJournalEntries(300))
    const tradeIds = entries.map((entry) => entry.id)
    const checklists = await listTradeChecklistsByTradeIds(tradeIds)
    const data = entries.map((entry) => ({
      ...entry,
      checklist: checklists[entry.id] ?? null,
    }))
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[/api/journal/trades GET] Error:', error)
    return NextResponse.json({ success: false, data: [], error: 'Failed to load trade journal' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'journal-trades-post',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  try {
    const body = (await request.json()) as {
      symbol?: string
      side?: 'BUY' | 'SELL'
      result?: string
      profit?: number
      entryPrice?: number | null
      stopLoss?: number | null
      takeProfit?: number | null
      notes?: string | null
    }

    if (!body.symbol || !body.side) {
      return NextResponse.json({ success: false, error: 'Missing required fields: symbol, side' }, { status: 400 })
    }

    const entry = await insertTradeJournalEntry({
      symbol: body.symbol.toUpperCase(),
      side: body.side,
      result: body.result,
      profit: body.profit,
      entryPrice: body.entryPrice,
      stopLoss: body.stopLoss,
      takeProfit: body.takeProfit,
      notes: body.notes,
    })

    if (!entry) {
      return NextResponse.json({ success: false, error: 'Failed to persist trade journal entry' }, { status: 500 })
    }

    let checklist = null
    try {
      const state = await withApiCache('journal-trades-setup-state', 15_000, async () => buildOracleState())
      const asset = state.radar.find((item) => item.symbol === entry.symbol)
      if (asset) {
        const setup = scoreSetupFromAsset({
          asset,
          entry: body.entryPrice ?? null,
          stopLoss: body.stopLoss ?? null,
          takeProfit: body.takeProfit ?? null,
        })
        checklist = await upsertTradeChecklist({
          tradeId: entry.id,
          setupScore: setup.score,
          setupBias: setup.bias,
          confluenceCount: setup.confluence.count,
          setupRules: setup.rules,
        })
      } else {
        checklist = await upsertTradeChecklist({ tradeId: entry.id })
      }
    } catch {
      checklist = await upsertTradeChecklist({ tradeId: entry.id }).catch(() => null)
    }

    return NextResponse.json({ success: true, data: { ...entry, checklist } }, { status: 201 })
  } catch (error) {
    console.error('[/api/journal/trades POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
