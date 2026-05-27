import { redirect } from 'next/navigation'
import Link from 'next/link'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function DashboardPage() {
  const sessione = await leggiSessione()
  if (!sessione) redirect('/auth/login')

  // Recupera dati utente aggiornati
  const { data: utente } = await supabaseAdmin
    .from('utenti')
    .select('*')
    .eq('email', sessione.email)
    .single()

  // Recupera match dell'utente
  const { data: matches } = await supabaseAdmin
    .from('match')
    .select('*, manoscritti:id_manoscritto(*)')
    .or(`email_scrittore.eq.${sessione.email},email_lettore.eq.${sessione.email}`)
    .order('data_match', { ascending: false })

  // Manoscritti in attesa
  const { data: manoscritti } = await supabaseAdmin
    .from('manoscritti')
    .select('*')
    .eq('email_scrittore', sessione.email)
    .order('data_registrazione', { ascending: false })
    .limit(3)

  // Richieste in attesa
  const { data: richieste } = await supabaseAdmin
    .from('richieste')
    .select('*')
    .eq('email_lettore', sessione.email)
    .order('data_registrazione', { ascending: false })
    .limit(3)

  const nomeAbbreviato = utente?.nome?.split(' ')[0] || sessione.nome
  const haManoscrittoAttivo = manoscritti?.some(m => m.stato === 'in_attesa')
  const haRichiestaAttiva = richieste?.some(r => r.stato === 'in_attesa')

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Benvenuto */}
      <div className="mb-12">
        <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <h1 className="font-serif font-normal text-4xl mb-2" style={{ color: 'var(--blu-notte)' }}>
          Benvenuto/a, {nomeAbbreviato}.
        </h1>
        <p className="font-serif text-lg" style={{ color: 'var(--blu-grigio)' }}>
          {utente?.sbloccato
            ? 'Puoi leggere e condividere manoscritti.'
            : 'Su Melquíades si entra leggendo. Il tuo primo passo è richiedere una lettura.'}
        </p>
      </div>

      {/* Avviso primo accesso */}
      {!utente?.sbloccato && !haRichiestaAttiva && (
        <div
          className="mb-10 p-6"
          style={{
            background: 'color-mix(in srgb, var(--oro) 8%, var(--avorio))',
            border: '1px solid var(--oro)',
          }}
        >
          <p className="font-serif font-medium mb-2" style={{ color: 'var(--blu-notte)' }}>
            Il tuo primo passo
          </p>
          <p className="font-serif text-sm leading-relaxed mb-4" style={{ color: 'var(--blu-grigio)' }}>
            Su Melquíades si entra leggendo. Indica che tipo di testo vorresti leggere — genere e lunghezza — e il sistema cercherà una corrispondenza tra i manoscritti in attesa. Quando avverrà il match, potrai anche tu caricare il tuo.
          </p>
          <Link href="/lettura" className="btn-primario text-sm" style={{ padding: '10px 24px' }}>
            Richiedi una lettura →
          </Link>
        </div>
      )}

      {/* Match recenti */}
      {matches && matches.length > 0 && (
        <section className="mb-12">
          <h2 className="font-serif font-normal text-2xl mb-6" style={{ color: 'var(--blu-notte)' }}>
            I tuoi match
          </h2>
          <div className="space-y-4">
            {matches.map((match: any) => {
              const isScrive = match.email_scrittore === sessione.email
              const dataMatch = new Date(match.data_match).toLocaleDateString('it-IT', {
                day: 'numeric', month: 'long', year: 'numeric'
              })

              return (
                <div
                  key={match.id}
                  className="card-manoscritto"
                  style={{ cursor: 'default' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className="font-serif text-xs px-2 py-0.5"
                          style={{
                            background: isScrive ? 'var(--blu-notte)' : 'var(--oro)',
                            color: 'var(--avorio)',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {isScrive ? 'SCRITTORE' : 'LETTORE'}
                        </span>
                        {match.primo_match_lettore && !isScrive && (
                          <span className="font-serif text-xs italic" style={{ color: 'var(--oro)' }}>
                            primo match ★
                          </span>
                        )}
                      </div>
                      {match.manoscritti && (
                        <>
                          <p className="font-serif text-lg" style={{ color: 'var(--blu-notte)' }}>
                            {match.manoscritti.titolo
                              ? <em>{match.manoscritti.titolo}</em>
                              : `${match.manoscritti.macro_area} — ${match.manoscritti.genere}`}
                          </p>
                          {match.manoscritti.sinossi && (
                            <p className="font-serif text-sm mt-2 leading-relaxed" style={{ color: 'var(--blu-grigio)' }}>
                              {match.manoscritti.sinossi}
                            </p>
                          )}
                          <p className="font-serif text-xs mt-1" style={{ color: 'var(--blu-grigio)', opacity: 0.6 }}>
                            {match.manoscritti.fascia_pagine} pagine
                          </p>
                        </>
                      )}
                      <p className="font-serif text-sm mt-2" style={{ color: 'var(--blu-grigio)' }}>
                        {isScrive
                          ? `Lettore: ${match.email_lettore}`
                          : `Scrittore: ${match.email_scrittore}`}
                      </p>
                    </div>
                    <p className="font-serif text-sm shrink-0" style={{ color: 'var(--blu-grigio)', opacity: 0.6 }}>
                      {dataMatch}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Stato corrente */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {/* Richiesta di lettura */}
        <div>
          <h3 className="font-serif font-normal text-xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            Come lettore
          </h3>
          {haRichiestaAttiva ? (
            <div
              className="p-5"
              style={{ border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--oro)' }}
                />
                <span className="font-serif text-sm" style={{ color: 'var(--oro)' }}>
                  Richiesta in attesa
                </span>
              </div>
              {richieste?.filter(r => r.stato === 'in_attesa').map((r: any) => (
                <div key={r.id}>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                    Generi: {r.generi_accettati?.join(', ')}
                  </p>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                    Lunghezza max: {r.lunghezza_massima} pagine
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="p-5"
              style={{ border: '1px dashed color-mix(in srgb, var(--oro) 30%, transparent)' }}
            >
              <p className="font-serif text-sm mb-4" style={{ color: 'var(--blu-grigio)' }}>
                Nessuna richiesta attiva.
              </p>
              <Link href="/lettura" className="font-serif text-sm" style={{ color: 'var(--oro)' }}>
                Richiedi una lettura →
              </Link>
            </div>
          )}
        </div>

        {/* Manoscritto */}
        <div>
          <h3 className="font-serif font-normal text-xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            Come scrittore
          </h3>
          {!utente?.sbloccato ? (
            <div
              className="p-5"
              style={{ border: '1px dashed color-mix(in srgb, var(--oro) 20%, transparent)', opacity: 0.6 }}
            >
              <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                Disponibile dopo il primo match come lettore.
              </p>
            </div>
          ) : haManoscrittoAttivo ? (
            <div
              className="p-5"
              style={{ border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--oro)' }} />
                <span className="font-serif text-sm" style={{ color: 'var(--oro)' }}>
                  Manoscritto in attesa
                </span>
              </div>
              {manoscritti?.filter(m => m.stato === 'in_attesa').map((m: any) => (
                <div key={m.id}>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>
                    {m.titolo ? <em>{m.titolo}</em> : `${m.genere}`}
                  </p>
                  <p className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                    {m.fascia_pagine} pagine
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div
              className="p-5"
              style={{ border: '1px dashed color-mix(in srgb, var(--oro) 30%, transparent)' }}
            >
              <p className="font-serif text-sm mb-4" style={{ color: 'var(--blu-grigio)' }}>
                Nessun manoscritto in attesa.
              </p>
              <Link href="/manoscritto" className="font-serif text-sm" style={{ color: 'var(--oro)' }}>
                Carica un manoscritto →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats semplici */}
      <div
        className="py-8 text-center"
        style={{ borderTop: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)' }}
      >
        <div className="grid grid-cols-3 gap-8 max-w-sm mx-auto">
          <div>
            <p className="font-serif text-3xl font-normal" style={{ color: 'var(--blu-notte)' }}>
              {matches?.length || 0}
            </p>
            <p className="font-serif text-xs mt-1" style={{ color: 'var(--blu-grigio)' }}>
              match totali
            </p>
          </div>
          <div>
            <p className="font-serif text-3xl font-normal" style={{ color: 'var(--blu-notte)' }}>
              {manoscritti?.length || 0}
            </p>
            <p className="font-serif text-xs mt-1" style={{ color: 'var(--blu-grigio)' }}>
              manoscritti
            </p>
          </div>
          <div>
            <p className="font-serif text-3xl font-normal" style={{ color: 'var(--blu-notte)' }}>
              {richieste?.length || 0}
            </p>
            <p className="font-serif text-xs mt-1" style={{ color: 'var(--blu-grigio)' }}>
              richieste
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
