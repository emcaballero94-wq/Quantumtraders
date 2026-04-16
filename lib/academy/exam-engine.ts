import { findAcademyBlock, findAcademyRoute } from '@/lib/academy/content'

export interface ExamEvaluation {
  routeId: string
  blockId: string
  score: number
  passScore: number
  passed: boolean
  answers: Array<{
    questionId: string
    selectedIndex: number | null
    isCorrect: boolean
    explanation: string
  }>
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function evaluateBlockExam(input: {
  routeId: string
  blockId: string
  answers: Array<number | null>
}): ExamEvaluation | null {
  const block = findAcademyBlock(input.routeId, input.blockId)
  if (!block) return null

  const evaluatedAnswers = block.exam.questions.map((question, index) => {
    const selectedRaw = input.answers[index]
    const selectedIndex = typeof selectedRaw === 'number' && Number.isInteger(selectedRaw) ? selectedRaw : null
    const isCorrect = selectedIndex === question.correctIndex
    return {
      questionId: question.id,
      selectedIndex,
      isCorrect,
      explanation: question.explanation,
    }
  })

  const correctCount = evaluatedAnswers.filter((answer) => answer.isCorrect).length
  const score = block.exam.questions.length > 0
    ? clamp(Math.round((correctCount / block.exam.questions.length) * 100), 0, 100)
    : 0

  return {
    routeId: input.routeId,
    blockId: input.blockId,
    score,
    passScore: block.exam.passScore,
    passed: score >= block.exam.passScore,
    answers: evaluatedAnswers,
  }
}

export function computeRouteCompletion(input: {
  routeId: string
  passedBlockIds: string[]
}): { completedBlocks: number; totalBlocks: number; completionPct: number; certified: boolean } | null {
  const route = findAcademyRoute(input.routeId)
  if (!route) return null

  const routeBlockIds = route.blocks.map((block) => block.id)
  const passedSet = new Set(input.passedBlockIds)
  const completedBlocks = routeBlockIds.filter((blockId) => passedSet.has(blockId)).length
  const totalBlocks = routeBlockIds.length
  const completionPct = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0

  return {
    completedBlocks,
    totalBlocks,
    completionPct,
    certified: completedBlocks === totalBlocks && totalBlocks > 0,
  }
}
