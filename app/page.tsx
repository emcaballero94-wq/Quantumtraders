import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/marketing/LandingPage'

export default async function RootPage() {
  const supabase = await createClient()
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    if (data.user) redirect('/dashboard')
  }

  return <LandingPage />
}
