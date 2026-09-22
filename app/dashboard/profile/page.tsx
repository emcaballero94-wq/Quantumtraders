'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ProfileUser {
  email: string | null
  provider: string | null
  createdAt: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string; app_metadata?: { provider?: string }; created_at?: string } | null } }) => {
      const authUser = data.user
      setUser(
        authUser
          ? {
              email: authUser.email ?? null,
              provider: (authUser.app_metadata?.provider as string | undefined) ?? null,
              createdAt: authUser.created_at ?? null,
            }
          : null,
      )
      setLoading(false)
    })
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    if (!supabase) return
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in py-10 px-6">
      <div className="border-b border-bg-border pb-6">
        <h1 className="text-xl font-mono font-bold text-ink-primary tracking-tight uppercase">Perfil</h1>
        <p className="text-xs font-mono text-ink-muted mt-0.5 uppercase tracking-widest">Quién sos, qué tenés</p>
      </div>

      {loading && <p className="text-xs font-mono text-ink-dim">Cargando...</p>}

      {!loading && !user && (
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 text-xs font-mono text-ink-dim">
          No hay una sesión activa. <a href="/login" className="text-oracle hover:underline">Iniciar sesión →</a>
        </div>
      )}

      {!loading && user && (
        <div className="rounded-xl border border-bg-border bg-bg-card p-6 glass-card space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-oracle-dim border border-oracle/25 flex items-center justify-center shrink-0">
              <span className="text-oracle text-xl font-mono font-bold">{(user.email ?? 'T')[0]?.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-sm font-mono font-bold text-ink-primary">{user.email ?? '—'}</p>
              <p className="text-[10px] font-mono text-ink-dim uppercase tracking-wider mt-0.5">
                {user.provider === 'google' ? 'Google OAuth' : 'Email / Password'}
              </p>
            </div>
          </div>

          <div className="border-t border-bg-border pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Miembro desde</p>
              <p className="text-xs font-mono text-ink-secondary mt-1">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono text-ink-dim uppercase tracking-widest">Estado</p>
              <p className="text-xs font-mono text-atlas mt-1 font-bold">Sesión activa</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-3 rounded-lg border border-bear/30 bg-bear/10 text-bear text-xs font-mono font-bold uppercase tracking-widest hover:bg-bear/20 transition-colors disabled:opacity-50"
          >
            {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  )
}
