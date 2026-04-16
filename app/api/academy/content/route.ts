import { NextResponse } from 'next/server'
import { listPublicAcademyRoutes } from '@/lib/academy/content'
import { withApiCache } from '@/lib/server/api-cache'
import { rejectIfRateLimited } from '@/lib/server/endpoint-guards'

export async function GET(request: Request) {
  const blocked = rejectIfRateLimited(request, {
    routeKey: 'academy-content-get',
    limit: 120,
    windowMs: 60_000,
  })
  if (blocked) return blocked

  const routes = await withApiCache('academy-content', 60_000, async () => listPublicAcademyRoutes())
  return NextResponse.json({
    success: true,
    data: {
      objective: 'Ruta clara de progreso + certificación por nivel.',
      routes,
    },
  })
}
