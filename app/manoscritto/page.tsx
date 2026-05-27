'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MACRO_AREE, GENERI, FASCE_PAGINE } from '@/types'
import type { MacroArea, FasciaPagine } from '@/types'

export default function ManoscrittoPage() {
  const router = useRouter()
  const [macroArea, setMacroArea] = useState<MacroArea | ''>('')
  const [genere, setGenere] = useState('')
  const [sottogeneri, setSottogeneri] = useState<string[]>([])
  const [fasciaPagine, setFasciaPagine] = useState<FasciaPagine | ''>('')
  const [sinossi, setSinossi] = useState('')
  const [titolo, setTitolo] = useState('')
  const [isRaccolta, setIsRaccolta] = useState(false)
  const [isIncompiuto, setIsIncompiuto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [successo, setSuccesso] = useState(false)
  const [matchTrovato, setMatchTrovato] = useState(false)

  const generiDisponibili = macroArea ? GENERI[macroArea as MacroArea] : []
  const isNarrativa = macroArea === 'Narrativa'

  const toggleSottogenere = (sg: string) => {
    setSottogeneri(prev => {
      if (prev.includes(sg)) return prev.filter(s => s !== sg)
      if (prev.length >= 2) return prev
      return [...prev, sg]
    })
  }

  const invia = async () => {
    if (!macroArea || !genere || !fasciaPagine || !sinossi) {
      setErrore('Compila tutti i campi obbligatori: genere, fascia di pagine e sinossi.')
      return
    }
    if (sinossi.length < 50) {
      setErrore('La sinossi deve essere di almeno 50 caratteri.')
      return
    }

    setLoading(true)
    setErrore('')

    const res = await fetch('/api/manoscritti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        macro_area: macroArea,
        genere,
        sottogeneri: isNarrativa ? sottogeneri : [],
        fascia_pagine: fasciaPagine,
        sinossi,
        titolo: titolo || undefined,
        is_raccolta: isRaccolta,
        is_incompiuto: isIncompiuto,
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
          <p className="text-4xl mb-6">{matchTrovato ? '✦' : '○'}</p>
          <h1 className="font-serif font-normal text-3xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            {matchTrovato ? 'Match trovato!' : 'Manoscritto registrato.'}
          </h1>
          <p className="font-serif text-lg leading-relaxed mb-8" style={{ color: 'var(--blu-grigio)' }}>
            {matchTrovato
              ? 'Abbiamo trovato un lettore compatibile. Ti contatteremo con i dettagli del match.'
              : 'Il tuo manoscritto è in attesa del lettore giusto. Appena ci sarà una corrispondenza, ti avviseremo.'}
          </p>
          {!matchTrovato && (
            <p className="font-serif text-sm italic mb-8" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Siamo agli inizi. Il tuo primo match potrebbe richiedere qualche settimana.
            </p>
          )}
          <button onClick={() => { router.push('/dashboard'); router.refresh() }} className="btn-primario">
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
          Il tuo manoscritto
        </h1>
        <p className="font-serif text-lg" style={{ color: 'var(--blu-grigio)' }}>
          Raccontaci cosa hai scritto. Il sistema cercherà il lettore più compatibile tra le richieste in attesa.
        </p>
      </div>

      <div className="space-y-8">
        {/* Titolo (facoltativo) */}
        <div>
          <label className="block font-serif text-sm mb-2" style={{ color: 'var(--blu-grigio)' }}>
            Titolo <span style={{ color: 'var(--oro)', opacity: 0.6 }}>(facoltativo)</span>
          </label>
          <input
            type="text"
            value={titolo}
            onChange={e => setTitolo(e.target.value)}
            placeholder="Se il tuo manoscritto ha un titolo…"
            className="input-melquiades"
          />
        </div>

        {/* Macro-area */}
        <div>
          <label className="block font-serif text-sm mb-3" style={{ color: 'var(--blu-grigio)' }}>
            Tipo di testo *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {MACRO_AREE.map(ma => (
              <label
                key={ma}
                className="flex items-center gap-2 p-3 cursor-pointer transition-all"
                style={{
                  border: macroArea === ma ? '1px solid var(--oro)' : '1px solid color-mix(in srgb, var(--oro) 25%, transparent)',
                  background: macroArea === ma ? 'color-mix(in srgb, var(--oro) 8%, var(--avorio))' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="macro_area"
                  value={ma}
                  checked={macroArea === ma}
                  onChange={() => { setMacroArea(ma as MacroArea); setGenere(''); setSottogeneri([]) }}
                  style={{ accentColor: 'var(--blu-notte)' }}
                />
                <span className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>{ma}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Genere */}
        {macroArea && (
          <div>
            <label className="block font-serif text-sm mb-3" style={{ color: 'var(--blu-grigio)' }}>
              {isNarrativa ? 'Genere principale *' : 'Genere *'}
            </label>
            <div className="space-y-2">
              {generiDisponibili.map(g => (
                <label
                  key={g}
                  className="flex items-center gap-3 p-3 cursor-pointer transition-all"
                  style={{
                    border: genere === g ? '1px solid var(--oro)' : '1px solid color-mix(in srgb, var(--oro) 20%, transparent)',
                    background: genere === g ? 'color-mix(in srgb, var(--oro) 6%, var(--avorio))' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="genere"
                    value={g}
                    checked={genere === g}
                    onChange={() => setGenere(g)}
                    style={{ accentColor: 'var(--blu-notte)' }}
                  />
                  <span className="font-serif" style={{ color: 'var(--blu-notte)' }}>{g}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Sottogeneri (solo Narrativa) */}
        {isNarrativa && genere && (
          <div>
            <label className="block font-serif text-sm mb-2" style={{ color: 'var(--blu-grigio)' }}>
              Sottogeneri <span style={{ color: 'var(--oro)', opacity: 0.6 }}>(fino a 2, facoltativi)</span>
            </label>
            <p className="font-serif text-xs mb-3" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
              Visibili nella sinossi-anteprima, non vincolanti per il match.
            </p>
            <div className="flex flex-wrap gap-2">
              {generiDisponibili.filter(g2 => g2 !== genere).map(sg => (
                <button
                  key={sg}
                  onClick={() => toggleSottogenere(sg)}
                  type="button"
                  className="font-serif text-sm px-3 py-1.5 transition-all"
                  style={{
                    border: sottogeneri.includes(sg) ? '1px solid var(--oro)' : '1px solid color-mix(in srgb, var(--oro) 25%, transparent)',
                    background: sottogeneri.includes(sg) ? 'color-mix(in srgb, var(--oro) 12%, var(--avorio))' : 'transparent',
                    color: 'var(--blu-notte)',
                    opacity: !sottogeneri.includes(sg) && sottogeneri.length >= 2 ? 0.4 : 1,
                  }}
                >
                  {sg}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fascia pagine */}
        <div>
          <label className="block font-serif text-sm mb-3" style={{ color: 'var(--blu-grigio)' }}>
            Lunghezza *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FASCE_PAGINE.map(fascia => (
              <label
                key={fascia}
                className="flex items-center gap-2 p-3 cursor-pointer transition-all"
                style={{
                  border: fasciaPagine === fascia ? '1px solid var(--oro)' : '1px solid color-mix(in srgb, var(--oro) 25%, transparent)',
                  background: fasciaPagine === fascia ? 'color-mix(in srgb, var(--oro) 8%, var(--avorio))' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="fascia_pagine"
                  value={fascia}
                  checked={fasciaPagine === fascia}
                  onChange={() => setFasciaPagine(fascia)}
                  style={{ accentColor: 'var(--blu-notte)' }}
                />
                <span className="font-serif text-sm" style={{ color: 'var(--blu-notte)' }}>
                  {fascia} pagine
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Sinossi */}
        <div>
          <label className="block font-serif text-sm mb-2" style={{ color: 'var(--blu-grigio)' }}>
            Sinossi * — Il lettore la vedrà prima di confermare il match
          </label>
          <textarea
            value={sinossi}
            onChange={e => setSinossi(e.target.value)}
            placeholder="Descrivi il tuo manoscritto in poche righe. Di cosa parla? Qual è il tono? Cosa rende unico questo testo?"
            rows={5}
            className="w-full bg-transparent py-3 px-0 font-serif text-lg resize-none focus:outline-none"
            style={{
              borderBottom: '1px solid color-mix(in srgb, var(--oro) 50%, transparent)',
              color: 'var(--blu-notte)',
            }}
            onFocus={e => { e.target.style.borderBottomColor = 'var(--oro)' }}
            onBlur={e => { e.target.style.borderBottomColor = 'color-mix(in srgb, var(--oro) 50%, transparent)' }}
          />
          <p className="font-serif text-xs mt-1" style={{ color: 'var(--blu-grigio)', opacity: 0.6 }}>
            {sinossi.length} caratteri {sinossi.length < 50 ? `(minimo 50)` : '✓'}
          </p>
        </div>

        {/* Flag trasversali */}
        <div>
          <label className="block font-serif text-sm mb-3" style={{ color: 'var(--blu-grigio)' }}>
            Caratteristiche aggiuntive
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRaccolta}
                onChange={e => setIsRaccolta(e.target.checked)}
                style={{ accentColor: 'var(--blu-notte)' }}
              />
              <div>
                <span className="font-serif" style={{ color: 'var(--blu-notte)' }}>È una raccolta</span>
                <p className="font-serif text-xs" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
                  (di racconti, poesie, lettere, ecc.)
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isIncompiuto}
                onChange={e => setIsIncompiuto(e.target.checked)}
                style={{ accentColor: 'var(--blu-notte)' }}
              />
              <div>
                <span className="font-serif" style={{ color: 'var(--blu-notte)' }}>Il testo non è ancora concluso</span>
                <p className="font-serif text-xs" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
                  (work in progress — sarà indicato nella sinossi-anteprima)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Avviso privacy */}
        <div
          className="p-4"
          style={{
            background: 'color-mix(in srgb, var(--blu-notte) 4%, var(--avorio))',
            border: '1px solid color-mix(in srgb, var(--blu-notte) 15%, transparent)',
          }}
        >
          <p className="font-serif text-sm leading-relaxed" style={{ color: 'var(--blu-grigio)' }}>
            <strong style={{ color: 'var(--blu-notte)' }}>La piattaforma non vede mai il tuo testo.</strong>{' '}
            Melquíades raccoglie solo queste informazioni. Il manoscritto lo manderai tu direttamente al lettore, nel modo che preferisci, dopo il match.
          </p>
        </div>
      </div>

      {errore && (
        <p className="font-serif text-sm mt-6" style={{ color: '#8B3A3A' }}>{errore}</p>
      )}

      <div className="flex items-center gap-4 mt-10">
        <button
          onClick={invia}
          disabled={loading}
          className="btn-primario"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Un momento...' : 'Registra il manoscritto'}
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
