import { redirect } from 'next/navigation'
import Link from 'next/link'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function ProfiloPage() {
  const sessione = await leggiSessione()
  if (!sessione) redirect('/auth/login')

  const { data: utente } = await supabaseAdmin
    .from('utenti')
    .select('*')
    .eq('email', sessione.email)
    .single()

  const { data: manoscritti } = await supabaseAdmin
    .from('manoscritti')
    .select('*')
    .eq('email_scrittore', sessione.email)
    .order('data_registrazione', { ascending: false })

  const { data: richieste } = await supabaseAdmin
    .from('richieste')
    .select('*')
    .eq('email_lettore', sessione.email)
    .order('data_registrazione', { ascending: false })

  const { data: matches } = await supabaseAdmin
    .from('match')
    .select('*')
    .or(`email_scrittore.eq.${sessione.email},email_lettore.eq.${sessione.email}`)

  const dataIscrizione = utente?.data_registrazione
    ? new Date(utente.data_registrazione).toLocaleDateString('it-IT', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '—'

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <h1 className="font-serif font-normal text-4xl mb-1" style={{ color: 'var(--blu-notte)' }}>
          {utente?.nome || sessione.nome}
        </h1>
        <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
          {sessione.email}
        </p>
      </div>

      {/* Dati profilo */}
      <div
        className="p-6 mb-8"
        style={{ border: '1px solid color-mix(in srgb, var(--oro) 25%, transparent)' }}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="font-serif text-xs mb-1" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Membro dal
            </p>
            <p className="font-serif" style={{ color: 'var(--blu-notte)' }}>{dataIscrizione}</p>
          </div>
          <div>
            <p className="font-serif text-xs mb-1" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Stato
            </p>
            <p className="font-serif" style={{ color: utente?.sbloccato ? 'var(--oro)' : 'var(--blu-grigio)' }}>
              {utente?.sbloccato ? 'Sbloccato/a ★' : 'In attesa del primo match'}
            </p>
          </div>
          <div>
            <p className="font-serif text-xs mb-1" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Match ricevuti
            </p>
            <p className="font-serif text-2xl" style={{ color: 'var(--blu-notte)' }}>
              {matches?.length || 0}
            </p>
          </div>
          <div>
            <p className="font-serif text-xs mb-1" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Manoscritti registrati
            </p>
            <p className="font-serif text-2xl" style={{ color: 'var(--blu-notte)' }}>
              {manoscritti?.length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Storico manoscritti */}
      {manoscritti && manoscritti.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif font-normal text-xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            I tuoi manoscritti
          </h2>
          <div className="space-y-3">
            {manoscritti.map((m: any) => (
              <div
                key={m.id}
                className="p-4 flex items-start justify-between gap-4"
                style={{ border: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)' }}
              >
                <div>
                  <p className="font-serif" style={{ color: 'var(--blu-notte)' }}>
                    {m.titolo ? <em>{m.titolo}</em> : `${m.macro_area} — ${m.genere}`}
                  </p>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                    {m.fascia_pagine} pagine
                    {m.is_raccolta ? ' · raccolta' : ''}
                    {m.is_incompiuto ? ' · incompiuto' : ''}
                  </p>
                </div>
                <span
                  className="font-serif text-xs px-2 py-1 shrink-0"
                  style={{
                    background: m.stato === 'matchato'
                      ? 'var(--oro)'
                      : m.stato === 'in_attesa'
                      ? 'var(--blu-notte)'
                      : 'var(--blu-grigio)',
                    color: 'var(--avorio)',
                    opacity: m.stato === 'ritirato' ? 0.5 : 1,
                  }}
                >
                  {m.stato === 'matchato' ? 'Matchato' : m.stato === 'in_attesa' ? 'In attesa' : 'Ritirato'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Storico richieste */}
      {richieste && richieste.length > 0 && (
        <section className="mb-8">
          <h2 className="font-serif font-normal text-xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            Le tue richieste di lettura
          </h2>
          <div className="space-y-3">
            {richieste.map((r: any) => (
              <div
                key={r.id}
                className="p-4 flex items-start justify-between gap-4"
                style={{ border: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)' }}
              >
                <div>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>
                    {r.generi_accettati?.slice(0, 3).join(', ')}
                    {r.generi_accettati?.length > 3 ? ` + ${r.generi_accettati.length - 3}` : ''}
                  </p>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                    max {r.lunghezza_massima} pagine
                  </p>
                </div>
                <span
                  className="font-serif text-xs px-2 py-1 shrink-0"
                  style={{
                    background: r.stato === 'matchata'
                      ? 'var(--oro)'
                      : r.stato === 'in_attesa'
                      ? 'var(--blu-notte)'
                      : 'var(--blu-grigio)',
                    color: 'var(--avorio)',
                    opacity: r.stato === 'ritirata' ? 0.5 : 1,
                  }}
                >
                  {r.stato === 'matchata' ? 'Matchata' : r.stato === 'in_attesa' ? 'In attesa' : 'Ritirata'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div
        className="pt-8"
        style={{ borderTop: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)' }}
      >
        <Link href="/dashboard" className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
          ← Torna alla bacheca
        </Link>
      </div>
    </div>
  )
}
