'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MACRO_AREE, GENERI, FASCE_PAGINE } from '@/types'
import type { MacroArea, FasciaPagine, NudgeData } from '@/types'

export default function RichiestaLetturaPage() {
  const router = useRouter()
  const [nudgeData, setNudgeData] = useState<NudgeData>({})
  const [macroAreeAperte, setMacroAreeAperte] = useState<Set<MacroArea>>(new Set())
  const [macroAreeSelezionate, setMacroAreeSelezionate] = useState<Set<MacroArea>>(new Set())
  const [generiSelezionati, setGeneriSelezionati] = useState<Set<string>>(new Set())
  const [lunghezzaMax, setLunghezzaMax] = useState<FasciaPagine | ''>('')
  const [loading, setLoading] = useState(false)
  const [loadingNudge, setLoadingNudge] = useState(true)
  const [errore, setErrore] = useState('')
  const [successo, setSuccesso] = useState(false)
  const [matchTrovato, setMatchTrovato] = useState(false)

  useEffect(() => {
    fetch('/api/nudge')
      .then(r => r.json())
      .then(data => {
        setNudgeData(data)
        setLoadingNudge(false)
      })
      .catch(() => setLoadingNudge(false))
  }, [])

  const toggleMacroArea = (ma: MacroArea) => {
    setMacroAreeAperte(prev => {
      const next = new Set(prev)
      next.has(ma) ? next.delete(ma) : next.add(ma)
      return next
    })
  }

  const toggleMacroAreaSelezione = (ma: MacroArea, checked: boolean) => {
    setMacroAreeSelezionate(prev => {
      const next = new Set(prev)
      checked ? next.add(ma) : next.delete(ma)
      return next
    })
    // Se deselezionata, rimuovi tutti i generi figli
    if (!checked) {
      setGeneriSelezionati(prev => {
        const next = new Set(prev)
        GENERI[ma].forEach(g => next.delete(g))
        return next
      })
    }
  }

  const toggleGenere = (genere: string, macroArea: MacroArea, checked: boolean) => {
    setGeneriSelezionati(prev => {
      const next = new Set(prev)
      checked ? next.add(genere) : next.delete(genere)
      return next
    })
  }

  // Calcola totale selezionato per l'alert
  const macroAreeArr = Array.from(macroAreeSelezionate)
  const generiArr = Array.from(generiSelezionati)
  
  const totaleSelezionato = macroAreeArr.reduce((acc, ma) => {
    return acc + (nudgeData[ma]?.totale || 0)
  }, 0) + generiArr.reduce((acc, g) => {
    // evita doppio conteggio se la macro-area è già selezionata
    for (const ma of MACRO_AREE) {
      if (macroAreeSelezionate.has(ma as MacroArea)) continue
      if (GENERI[ma as MacroArea].includes(g)) {
        return acc + (nudgeData[ma]?.generi?.[g] || 0)
      }
    }
    return acc
  }, 0)

  const tuttiGeneriSelezionati = [
    ...generiArr,
    ...macroAreeArr.flatMap(ma => GENERI[ma]),
  ]
  const generiUnici = Array.from(new Set(tuttiGeneriSelezionati))

  const invia = async () => {
    if (generiUnici.length === 0) {
      setErrore('Seleziona almeno un genere.')
      return
    }
    if (!lunghezzaMax) {
      setErrore('Indica la lunghezza massima che sei disposto/a a leggere.')
      return
    }

    setLoading(true)
    setErrore('')

    const res = await fetch('/api/richieste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generi_accettati: generiUnici,
        macro_aree_accettate: Array.from(macroAreeSelezionate),
        lunghezza_massima: lunghezzaMax,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setErrore(data.error || 'Qualcosa è andato storto.')
      return
    }

    setMatchTrovato(data.match_trovato)
    setSuccesso(true)
  }

  if (successo) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <p className="text-4xl mb-6">
            {matchTrovato ? '✦' : '○'}
          </p>
          <h1 className="font-serif font-normal text-3xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            {matchTrovato ? 'Match trovato!' : 'Richiesta registrata.'}
          </h1>
          <p className="font-serif text-lg leading-relaxed mb-8" style={{ color: 'var(--blu-grigio)' }}>
            {matchTrovato
              ? 'Abbiamo trovato un manoscritto compatibile con la tua richiesta. Ti contatteremo a breve con i dettagli.'
              : 'La tua richiesta è in attesa. Appena arriverà un manoscritto compatibile, ti metteremo in contatto con lo scrittore.'}
          </p>
          {!matchTrovato && (
            <p className="font-serif text-sm italic mb-8" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Siamo agli inizi. Il tuo primo match potrebbe richiedere qualche settimana.
            </p>
          )}
          <button
            onClick={() => { router.push('/dashboard'); router.refresh() }}
            className="btn-primario"
          >
            Torna alla bacheca
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <h1 className="font-serif font-normal text-4xl mb-3" style={{ color: 'var(--blu-notte)' }}>
          Cosa vorresti leggere?
        </h1>
        <p className="font-serif text-lg" style={{ color: 'var(--blu-grigio)' }}>
          Indica i generi che ti interessano e la lunghezza massima che sei disposto/a a leggere. Il sistema cercherà la corrispondenza più vecchia tra i manoscritti in attesa.
        </p>
      </div>

      {/* Alert nudge */}
      {generiUnici.length > 0 && (
        <div
          className="mb-8 p-4"
          style={{
            background: 'color-mix(in srgb, var(--oro) 8%, var(--avorio))',
            border: '1px solid color-mix(in srgb, var(--oro) 40%, transparent)',
          }}
        >
          <p className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>
            {totaleSelezionato > 0
              ? `Con questa selezione ci sono ${totaleSelezionato} ${totaleSelezionato === 1 ? 'scritto' : 'scritti'} in attesa di lettore.`
              : 'Nessuno scritto in attesa per questa selezione. Potresti dover aspettare.'}
          </p>
        </div>
      )}

      {/* Sezione generi */}
      <div
        className="mb-8 p-6"
        style={{ border: '1px solid color-mix(in srgb, var(--oro) 25%, transparent)' }}
      >
        <h2 className="font-serif font-normal text-xl mb-6" style={{ color: 'var(--blu-notte)' }}>
          Generi accettati
        </h2>

        <div className="space-y-3">
          {MACRO_AREE.map(ma => {
            const nudge = nudgeData[ma]
            const aperta = macroAreeAperte.has(ma as MacroArea)
            const selezionata = macroAreeSelezionate.has(ma as MacroArea)

            return (
              <div key={ma}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={selezionata}
                      onChange={e => toggleMacroAreaSelezione(ma as MacroArea, e.target.checked)}
                      className="w-4 h-4 accent-blu-notte"
                      style={{ accentColor: 'var(--blu-notte)' }}
                    />
                    <span className="font-serif font-medium text-lg" style={{ color: 'var(--blu-notte)' }}>
                      {ma}
                    </span>
                    {!loadingNudge && (
                      <span
                        className={nudge?.totale ? 'badge-oro' : 'badge-grigio'}
                        style={nudge?.totale ? {} : { opacity: 0.35 }}
                      >
                        {nudge?.totale || 0}
                      </span>
                    )}
                  </label>
                  <button
                    onClick={() => toggleMacroArea(ma as MacroArea)}
                    className="font-serif text-sm px-2"
                    style={{ color: 'var(--blu-grigio)' }}
                  >
                    {aperta ? '▲' : '▼'}
                  </button>
                </div>

                {/* Generi figli */}
                {aperta && (
                  <div className="mt-3 ml-7 space-y-2">
                    {GENERI[ma as MacroArea].map(genere => {
                      const count = nudge?.generi?.[genere] || 0
                      const genereChecked = selezionata || generiSelezionati.has(genere)

                      return (
                        <label key={genere} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={genereChecked}
                            disabled={selezionata}
                            onChange={e => toggleGenere(genere, ma as MacroArea, e.target.checked)}
                            style={{ accentColor: 'var(--blu-notte)' }}
                          />
                          <span className="font-serif text-sm" style={{ color: 'var(--blu-grigio)' }}>
                            {genere}
                          </span>
                          {!loadingNudge && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: count > 0 ? 'var(--oro)' : 'var(--blu-grigio)',
                                opacity: count > 0 ? 1 : 0.4,
                                fontFamily: 'Georgia, serif',
                              }}
                            >
                              {count > 0 ? `${count} in attesa` : '—'}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lunghezza massima */}
      <div
        className="mb-10 p-6"
        style={{ border: '1px solid color-mix(in srgb, var(--oro) 25%, transparent)' }}
      >
        <h2 className="font-serif font-normal text-xl mb-2" style={{ color: 'var(--blu-notte)' }}>
          Lunghezza massima
        </h2>
        <p className="font-serif text-sm mb-5" style={{ color: 'var(--blu-grigio)' }}>
          Leggerò testi fino a questa lunghezza.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FASCE_PAGINE.map(fascia => (
            <label
              key={fascia}
              className="flex items-center gap-2 p-3 cursor-pointer transition-all"
              style={{
                border: lunghezzaMax === fascia
                  ? '1px solid var(--oro)'
                  : '1px solid color-mix(in srgb, var(--oro) 25%, transparent)',
                background: lunghezzaMax === fascia
                  ? 'color-mix(in srgb, var(--oro) 8%, var(--avorio))'
                  : 'transparent',
              }}
            >
              <input
                type="radio"
                name="lunghezza"
                value={fascia}
                checked={lunghezzaMax === fascia}
                onChange={() => setLunghezzaMax(fascia)}
                style={{ accentColor: 'var(--blu-notte)' }}
              />
              <span className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>
                {fascia} pagine
              </span>
            </label>
          ))}
        </div>
      </div>

      {errore && (
        <p className="font-serif text-sm mb-6" style={{ color: '#8B3A3A' }}>{errore}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={invia}
          disabled={loading}
          className="btn-primario"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Un momento...' : 'Invia la mia richiesta'}
        </button>
        <button
          onClick={() => router.back()}
          className="font-serif text-sm"
          style={{ color: 'var(--blu-grigio)' }}
        >
          Annulla
        </button>
      </div>
    </div>
  )
}
