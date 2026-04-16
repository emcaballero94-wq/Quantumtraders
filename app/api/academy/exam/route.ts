import { NextResponse } from 'next/server'
import { findAcademyRoute } from '@/lib/academy/content'
import { evaluateBlockExam, computeRouteCompletion } from '@/lib/academy/exam-engine'
import { resolveLearnerId } from '@/lib/academy/learner'
import { ensureLearnerBadge, listLearnerProgress, upsertLearnerBlockProgress } from '@/lib/academy/persistence'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

type ExamSubmitBody = {
  learnerId?: string
  routeId?: string
  blockId?: string
  answers?: Array<number | null>
}

export async function POST(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'academy-exam-post',
    limit: 60,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  try {
    const body = (await request.json()) as ExamSubmitBody
    const routeId = body.routeId?.trim()
    const blockId = body.blockId?.trim()
    const answers = Array.isArray(body.answers) ? body.answers : []
    if (!routeId || !blockId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: routeId, blockId' }, { status: 400 })
    }

    const learnerId = body.learnerId?.trim() || resolveLearnerId(request)
    const result = evaluateBlockExam({ routeId, blockId, answers })
    if (!result) {
      return NextResponse.json({ success: false, error: 'Route or block not found' }, { status: 404 })
    }

    await upsertLearnerBlockProgress({
      learnerId,
      routeId: result.routeId,
      blockId: result.blockId,
      score: result.score,
      passed: result.passed,
    })

    const progress = await listLearnerProgress(learnerId)
    const passedBlockIds = progress
      .filter((item) => item.routeId === routeId && item.passed)
      .map((item) => item.blockId)
    const completion = computeRouteCompletion({ routeId, passedBlockIds })

    let issuedBadge = null
    if (completion?.certified) {
      const route = findAcademyRoute(routeId)
      if (route) {
        issuedBadge = await ensureLearnerBadge({
          learnerId,
          routeId,
          routeTitle: route.title,
          metadata: {
            completionPct: completion.completionPct,
            completedBlocks: completion.completedBlocks,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        learnerId,
        evaluation: result,
        routeCompletion: completion,
        badge: issuedBadge,
      },
    })
  } catch (error) {
    console.error('[/api/academy/exam] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit exam' }, { status: 500 })
  }
}
