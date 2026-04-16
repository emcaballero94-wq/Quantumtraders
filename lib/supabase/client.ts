import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Key missing. Auth features will be disabled.')
    return null as any // Return as any to avoid type issues in components that handle null
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
