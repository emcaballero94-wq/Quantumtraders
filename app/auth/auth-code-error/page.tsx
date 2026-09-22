import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-xl border border-bear/30 bg-bg-card p-6 space-y-4 text-center">
        <p className="text-xs font-mono text-bear uppercase tracking-widest font-bold">Error de autenticación</p>
        <p className="text-sm font-mono text-ink-secondary leading-relaxed">
          No se pudo completar el inicio de sesión. El enlace puede haber expirado o ya haber sido usado.
        </p>
        <Link
          href="/login"
          className="inline-block px-5 py-2.5 rounded-lg border border-oracle/30 bg-oracle/10 text-oracle text-xs font-mono font-bold uppercase tracking-widest hover:bg-oracle/20 transition-colors"
        >
          Volver a intentar
        </Link>
      </div>
    </div>
  )
}
