import { redirect } from 'next/navigation'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const ADMIN_EMAIL = process.env.GESTORE_EMAIL || 'admin@melquiades.it'

export default async function AdminPage() {
  const sessione = await leggiSessione()
  if (!sessione || sessione.email !== ADMIN_EMAIL) redirect('/dashboard')

  // Stats piattaforma
  const [
    { count: totUtenti },
    { count: utentiSbloccati },
    { count: manoscrittiAttesa },
    { count: richiesteAttesa },
    { count: matchTotali },
    { data: matchRecenti },
  ] = await Promise.all([
    supabaseAdmin.from('utenti').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('utenti').select('*', { count: 'exact', head: true }).eq('sbloccato', true),
    supabaseAdmin.from('manoscritti').select('*', { count: 'exact', head: true }).eq('stato', 'in_attesa'),
    supabaseAdmin.from('richieste').select('*', { count: 'exact', head: true }).eq('stato', 'in_attesa'),
    supabaseAdmin.from('match').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('match')
      .select('*, manoscritti:id_manoscritto(genere, macro_area, fascia_pagine, sinossi, titolo)')
      .order('data_match', { ascending: false })
      .limit(10),
  ])

  // Distribuzione generi in attesa
  const { data: generiInAttesa } = await supabaseAdmin
    .from('manoscritti')
    .select('macro_area, genere')
    .eq('stato', 'in_attesa')

  const distribuzione: Record<string, number> = {}
  generiInAttesa?.forEach(m => {
    const key = `${m.macro_area} — ${m.genere}`
    distribuzione[key] = (distribuzione[key] || 0) + 1
  })
  const distribuzioneOrdinata = Object.entries(distribuzione).sort((a, b) => b[1] - a[1])

  const stats = [
    { label: 'Utenti totali', valore: totUtenti || 0 },
    { label: 'Utenti sbloccati', valore: utentiSbloccati || 0 },
    { label: 'Manoscritti in attesa', valore: manoscrittiAttesa || 0 },
    { label: 'Richieste in attesa', valore: richiesteAttesa || 0 },
    { label: 'Match totali', valore: matchTotali || 0 },
    {
      label: 'Bilanciamento',
      valore: `${manoscrittiAttesa || 0} / ${richiesteAttesa || 0}`,
      sottotitolo: 'manoscritti / richieste'
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <h1 className="font-serif font-normal text-4xl mb-2" style={{ color: 'var(--blu-notte)' }}>
          Bacheca gestore
        </h1>
        <p className="font-serif" style={{ color: 'var(--blu-grigio)' }}>
          Riepilogo operativo della piattaforma.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
        {stats.map(s => (
          <div
            key={s.label}
            className="p-5"
            style={{ border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)' }}
          >
            <p className="font-serif text-3xl font-normal mb-1" style={{ color: 'var(--blu-notte)' }}>
              {s.valore}
            </p>
            <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>{s.label}</p>
            {s.sottotitolo && (
              <p className="font-serif text-xs mt-0.5" style={{ color: 'var(--blu-grigio)', opacity: 0.6 }}>
                {s.sottotitolo}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Match recenti */}
      <section className="mb-12">
        <h2 className="font-serif font-normal text-2xl mb-6" style={{ color: 'var(--blu-notte)' }}>
          Match recenti
        </h2>

        {!matchRecenti?.length ? (
          <p className="font-serif italic" style={{ color: 'var(--blu-grigio)' }}>
            Nessun match ancora.
          </p>
        ) : (
          <div className="space-y-3">
            {matchRecenti.map((m: any) => {
              const data = new Date(m.data_match).toLocaleDateString('it-IT', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
              return (
                <div
                  key={m.id}
                  className="p-4 grid md:grid-cols-3 gap-4 items-start"
                  style={{ border: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)' }}
                >
                  <div>
                    <p className="font-serif text-xs mb-1" style={{ color: 'var(--oro)' }}>Scrittore</p>
                    <p className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>{m.email_scrittore}</p>
                  </div>
                  <div>
                    <p className="font-serif text-xs mb-1" style={{ color: 'var(--oro)' }}>Lettore</p>
                    <p className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>{m.email_lettore}</p>
                    {m.primo_match_lettore && (
                      <span className="font-serif text-xs italic" style={{ color: 'var(--oro)' }}>
                        ★ primo match
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-serif text-xs mb-1" style={{ color: 'var(--blu-grigio)' }}>{data}</p>
                    {m.manoscritti && (
                      <p className="font-serif text-sm italic" style={{ color: 'var(--blu-grigio)' }}>
                        {m.manoscritti.titolo || m.manoscritti.genere} · {m.manoscritti.fascia_pagine}pp
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Distribuzione generi */}
      {distribuzioneOrdinata.length > 0 && (
        <section>
          <h2 className="font-serif font-normal text-2xl mb-6" style={{ color: 'var(--blu-notte)' }}>
            Manoscritti in attesa per genere
          </h2>
          <div className="space-y-2">
            {distribuzioneOrdinata.map(([genere, count]) => (
              <div key={genere} className="flex items-center gap-4">
                <div
                  className="h-1 rounded-full"
                  style={{
                    width: `${Math.max(4, (count / (distribuzioneOrdinata[0][1] || 1)) * 200)}px`,
                    background: 'var(--oro)',
                  }}
                />
                <span className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>{genere}</span>
                <span className="font-serif text-sm ml-auto" style={{ color: 'var(--blu-grigio)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
