import { NextResponse } from 'next/server'
import { getTradeChecklist, upsertTradeChecklist } from '@/lib/oracle/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'journal-checklist-get',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const { searchParams } = new URL(request.url)
  const tradeId = searchParams.get('tradeId')?.trim()
  if (!tradeId) {
    return NextResponse.json({ success: false, error: 'Missing query param: tradeId' }, { status: 400 })
  }

  try {
    const checklist = await getTradeChecklist(tradeId)
    return NextResponse.json({ success: true, data: checklist })
  } catch (error) {
    console.error('[/api/journal/checklist GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load checklist' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'journal-checklist-put',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  try {
    const body = (await request.json()) as {
      tradeId?: string
      preStructure?: boolean
      preZone?: boolean
      preTiming?: boolean
      preRisk?: boolean
      postPlanFollowed?: boolean
      postExecutionQuality?: boolean
      postEmotionStable?: boolean
      postLessonLogged?: boolean
      notes?: string | null
    }

    if (!body.tradeId) {
      return NextResponse.json({ success: false, error: 'Missing required field: tradeId' }, { status: 400 })
    }

    const checklist = await upsertTradeChecklist({
      tradeId: body.tradeId,
      preStructure: body.preStructure,
      preZone: body.preZone,
      preTiming: body.preTiming,
      preRisk: body.preRisk,
      postPlanFollowed: body.postPlanFollowed,
      postExecutionQuality: body.postExecutionQuality,
      postEmotionStable: body.postEmotionStable,
      postLessonLogged: body.postLessonLogged,
      notes: body.notes,
    })

    if (!checklist) {
      return NextResponse.json({ success: false, error: 'Failed to update checklist' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: checklist })
  } catch (error) {
    console.error('[/api/journal/checklist PUT] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update checklist' }, { status: 500 })
  }
}
