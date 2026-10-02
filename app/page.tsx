import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isOwnerEmail } from '@/lib/auth/access-control'
import { LandingPage } from '@/components/marketing/LandingPage'

export default async function RootPage() {
  const supabase = await createClient()
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    // Only the owner gets bounced into the dashboard — anyone else who's
    // logged in (public-demo phase) just sees the landing page like a
    // signed-out visitor would. Redirecting every authenticated user here
    // would loop against middleware.ts, which sends non-owners from
    // /dashboard back to this exact page.
    if (data.user && isOwnerEmail(data.user.email)) redirect('/dashboard')
  }

  return <LandingPage />
}
