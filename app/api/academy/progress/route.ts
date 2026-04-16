import { NextResponse } from 'next/server'
import { listAcademyRoutes } from '@/lib/academy/content'
import { computeRouteCompletion } from '@/lib/academy/exam-engine'
import { resolveLearnerId } from '@/lib/academy/learner'
import { listLearnerBadges, listLearnerProgress } from '@/lib/academy/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'academy-progress-get',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const learnerId = resolveLearnerId(request)

  try {
    const [progressRows, badges] = await Promise.all([
      listLearnerProgress(learnerId),
      listLearnerBadges(learnerId),
    ])

    const grouped = progressRows.reduce<Record<string, typeof progressRows>>((acc, item) => {
      if (!acc[item.routeId]) acc[item.routeId] = []
      acc[item.routeId].push(item)
      return acc
    }, {})

    const routeStatus = listAcademyRoutes().map((route) => {
      const rows = grouped[route.id] ?? []
      const passedBlockIds = rows.filter((row) => row.passed).map((row) => row.blockId)
      const completion = computeRouteCompletion({
        routeId: route.id,
        passedBlockIds,
      })
      const routeBadge = badges.find((badge) => badge.routeId === route.id) ?? null

      return {
        routeId: route.id,
        completedBlocks: completion?.completedBlocks ?? 0,
        totalBlocks: completion?.totalBlocks ?? route.blocks.length,
        completionPct: completion?.completionPct ?? 0,
        certified: Boolean(completion?.certified && routeBadge),
        badge: routeBadge,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        learnerId,
        progress: progressRows,
        badges,
        routeStatus,
      },
    })
  } catch (error) {
    console.error('[/api/academy/progress] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load academy progress' }, { status: 500 })
  }
}
