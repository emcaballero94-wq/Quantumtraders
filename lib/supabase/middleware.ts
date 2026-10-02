import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isOwnerEmail } from '@/lib/auth/access-control'

// Public-demo phase: default-deny instead of default-allow. Only the
// landing page, login, the OAuth callback, the Coinbase webhook (signature-
// verified, never carries a Supabase session) and the cron routes
// (bearer-token verified via CRON_SECRET, see rejectIfNotCron) are reachable
// without being the owner. Everything else — the whole dashboard and every
// other API route, including the ones that spend Anthropic/payment-provider
// money — requires isOwnerEmail(user.email).
const PUBLIC_PATH_PREFIXES = ['/login', '/auth', '/api/payments/webhook', '/api/cron', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml']

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return early if Supabase is not configured yet to prevent app crash
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshing the auth token. This hits Supabase's servers on every matched
  // request — if the project is unreachable (bad URL, paused project, no
  // network) this must fail fast instead of throwing and taking down every
  // request in the app.
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('[middleware] Supabase auth check failed — check NEXT_PUBLIC_SUPABASE_URL:', err instanceof Error ? err.message : err)
  }

  const { pathname } = request.nextUrl

  if (!isPublicPath(pathname)) {
    const isApiRoute = pathname.startsWith('/api/')

    if (!user) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (!isOwnerEmail(user.email)) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}
