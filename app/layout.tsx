import type { Metadata } from 'next'
import '@/styles/globals.css'
import { leggiSessione } from '@/lib/auth'
import { Navigazione } from '@/components/layout/Navigazione'

export const metadata: Metadata = {
  title: 'Melquíades — Manoscritti inediti cercano lettori',
  description:
    'Melquíades è il posto dove i manoscritti nel cassetto incontrano i lettori giusti. Gratuito, senza editori, senza filtri.',
  keywords: ['manoscritti', 'lettori', 'scrittura', 'libri inediti', 'beta reader'],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessione = await leggiSessione()

  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--avorio)' }}>
        <Navigazione utente={sessione} />
        <main>{children}</main>

        {/* Footer */}
        <footer
          className="mt-24 py-12 text-center"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)' }}
        >
          <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--oro)' }}>
            ✦ ✦ ✦
          </p>
          <p className="font-serif italic text-sm" style={{ color: 'var(--blu-grigio)' }}>
            «Il nome dice già tutto quello che siamo.»
          </p>
          <p className="font-serif text-xs mt-4" style={{ color: 'var(--blu-grigio)', opacity: 0.5 }}>
            Niente editori. Niente filtri. Niente costi.
          </p>
          <nav className="mt-6 flex items-center justify-center gap-6">
            <a href="/manifesto" className="font-serif text-xs" style={{ color: 'var(--blu-grigio)', opacity: 0.5 }}>Manifesto</a>
            <a href="/auth/login" className="font-serif text-xs" style={{ color: 'var(--blu-grigio)', opacity: 0.5 }}>Accedi</a>
          </nav>
        </footer>
      </body>
    </html>
  )
}
