'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'

interface NavProps {
  utente?: { nome: string; email: string; sbloccato: boolean } | null
}

export function Navigazione({ utente }: NavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)

  const logout = async () => {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--avorio)',
        borderBottom: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)',
      }}
    >
      <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href={utente ? '/dashboard' : '/'} className="flex flex-col items-start">
          <span className="text-xs tracking-widest" style={{ color: 'var(--oro)' }}>✦ ✦ ✦</span>
          <span className="text-2xl font-serif" style={{ color: 'var(--blu-notte)' }}>
            Melquíades
          </span>
        </Link>

        {utente ? (
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`font-serif text-sm transition-colors ${
                pathname === '/dashboard' ? 'text-oro' : 'text-blu-grigio hover:text-blu-notte'
              }`}
              style={{ color: pathname === '/dashboard' ? 'var(--oro)' : undefined }}
            >
              Bacheca
            </Link>
            <Link
              href="/lettura"
              className={`font-serif text-sm transition-colors`}
              style={{ color: pathname === '/lettura' ? 'var(--oro)' : 'var(--blu-grigio)' }}
            >
              Chiedi una lettura
            </Link>
            {utente.sbloccato && (
              <Link
                href="/manoscritto"
                className="font-serif text-sm transition-colors"
                style={{ color: pathname === '/manoscritto' ? 'var(--oro)' : 'var(--blu-grigio)' }}
              >
                Carica manoscritto
              </Link>
            )}
            <div className="flex items-center gap-4 ml-2 pl-4" style={{ borderLeft: '1px solid color-mix(in srgb, var(--oro) 40%, transparent)' }}>
              <Link
                href="/profilo"
                className="font-serif text-sm transition-colors"
                style={{ color: pathname === '/profilo' ? 'var(--oro)' : 'var(--blu-grigio)' }}
              >
                {utente.nome}
              </Link>
              <button
                onClick={logout}
                disabled={loading}
                className="font-serif text-xs transition-colors"
                style={{ color: 'var(--blu-grigio)', opacity: 0.6 }}
              >
                Esci
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="font-serif text-sm"
            style={{ color: 'var(--blu-grigio)' }}
          >
            Accedi
          </Link>
        )}
      </nav>
    </header>
  )
}
