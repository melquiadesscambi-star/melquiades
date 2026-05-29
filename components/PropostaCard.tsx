'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Opera {
  id: string
  titolo?: string
  macro_area: string
  genere: string
  sottogeneri?: string[]
  fascia_pagine: string
  sinossi: string
  is_raccolta: boolean
  is_incompiuto: boolean
}

interface PropostaConOpera {
  id_proposta: string
  creata_il: string
  scade_il: string
  opera: Opera
}

function OrologioAntico({ scade_il }: { scade_il: string }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    const calcola = () => Math.max(0, new Date(scade_il).getTime() - Date.now())
    setTimeLeft(calcola())
    const id = setInterval(() => setTimeLeft(calcola()), 1000)
    return () => clearInterval(id)
  }, [scade_il])

  if (timeLeft === null) {
    return <div style={{ width: 160, height: 200, flexShrink: 0 }} />
  }

  const totalMs = 24 * 60 * 60 * 1000
  const ratio = Math.max(0, Math.min(1, timeLeft / totalMs))
  const ore = Math.floor(timeLeft / 3600000)
  const min = Math.floor((timeLeft % 3600000) / 60000)
  const expired = timeLeft === 0

  const cx = 100, cy = 100, r = 72
  const circ = 2 * Math.PI * r
  const dashoffset = circ * (1 - ratio)

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * 2 * Math.PI - Math.PI / 2
    const isMajor = i % 6 === 0
    const r1 = isMajor ? 80 : 85
    return {
      x1: cx + r1 * Math.cos(a),
      y1: cy + r1 * Math.sin(a),
      x2: cx + 90 * Math.cos(a),
      y2: cy + 90 * Math.sin(a),
      major: isMajor,
    }
  })

  const elapsedAngle = (1 - ratio) * 2 * Math.PI - Math.PI / 2
  const handX = cx + 52 * Math.cos(elapsedAngle)
  const handY = cy + 52 * Math.sin(elapsedAngle)
  const tailX = cx + 12 * Math.cos(elapsedAngle + Math.PI)
  const tailY = cy + 12 * Math.sin(elapsedAngle + Math.PI)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <svg viewBox="0 0 200 200" width={160} height={160} role="img" aria-label="Conto alla rovescia">
        <circle cx={cx} cy={cy} r={97} fill="none" stroke="var(--oro)" strokeWidth={0.5} opacity={0.3} />
        <circle cx={cx} cy={cy} r={93} fill="none" stroke="var(--oro)" strokeWidth={1.5} opacity={0.5} />
        <circle cx={cx} cy={cy} r={91} fill="var(--avorio)" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--oro)" strokeWidth={8} opacity={0.12} />
        {!expired && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="var(--oro)"
            strokeWidth={8}
            strokeDasharray={circ}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="var(--oro)"
            strokeWidth={t.major ? 2 : 1}
            opacity={t.major ? 0.7 : 0.35}
          />
        ))}
        {!expired && (
          <>
            <line x1={cx} y1={cy} x2={handX} y2={handY}
              stroke="var(--blu-notte)" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
            <line x1={cx} y1={cy} x2={tailX} y2={tailY}
              stroke="var(--blu-notte)" strokeWidth={2} strokeLinecap="round" opacity={0.35} />
          </>
        )}
        <circle cx={cx} cy={cy} r={5} fill="var(--oro)" />
        <circle cx={cx} cy={cy} r={7} fill="none" stroke="var(--oro)" strokeWidth={1} opacity={0.4} />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 18, color: 'var(--blu-notte)', margin: 0 }}>
          {expired ? 'Scaduta' : ore > 0 ? `${ore}h ${String(min).padStart(2, '0')}m` : `${min}m`}
        </p>
        <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 12, color: 'var(--blu-grigio)', fontStyle: 'italic', margin: '2px 0 0', opacity: 0.7 }}>
          {expired ? 'proposta scaduta' : 'rimanenti'}
        </p>
      </div>
    </div>
  )
}

export default function PropostaCard({ proposta }: { proposta: PropostaConOpera }) {
  const router = useRouter()
  const [fase, setFase] = useState<
    'idle' | 'conferma-prompt' | 'rifiuto-prompt' | 'loading' | 'confermata' | 'rifiutata'
  >('idle')

  async function eseguiConferma() {
    setFase('loading')
    const res = await fetch('/api/proposte/conferma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_proposta: proposta.id_proposta }),
    })
    if (res.ok) {
      setFase('confermata')
      setTimeout(() => router.refresh(), 2500)
    } else {
      setFase('idle')
    }
  }

  async function eseguiRifiuto() {
    setFase('loading')
    const res = await fetch('/api/proposte/rifiuta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_proposta: proposta.id_proposta }),
    })
    if (res.ok) {
      setFase('rifiutata')
      setTimeout(() => router.refresh(), 2500)
    } else {
      setFase('idle')
    }
  }

  const { opera } = proposta

  if (fase === 'confermata') {
    return (
      <div className="mb-10 p-10" style={{ border: '1px solid var(--oro)', background: 'color-mix(in srgb, var(--oro) 6%, var(--avorio))', textAlign: 'center' }}>
        <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 28, color: 'var(--blu-notte)', marginBottom: 8 }}>
          ✦ Incontro avvenuto.
        </p>
        <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 16, color: 'var(--blu-grigio)', fontStyle: 'italic' }}>
          Riceverai un'email con i contatti. Buona lettura.
        </p>
      </div>
    )
  }

  if (fase === 'rifiutata') {
    return (
      <div className="mb-10 p-8" style={{ border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)', textAlign: 'center' }}>
        <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 18, color: 'var(--blu-grigio)', fontStyle: 'italic' }}>
          Continueremo a cercare.
        </p>
      </div>
    )
  }

  return (
    <div className="mb-10 p-8" style={{ border: '1px solid var(--oro)', background: 'color-mix(in srgb, var(--oro) 4%, var(--avorio))', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 6, border: '1px solid color-mix(in srgb, var(--oro) 20%, transparent)', pointerEvents: 'none' }} />

      <div className="flex flex-col md:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 11, letterSpacing: '0.4em', color: 'var(--oro)', textTransform: 'uppercase', marginBottom: 16 }}>
            ✦ Una proposta ti attende
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            <span className="badge-oro">{opera.macro_area}</span>
            <span className="badge-oro">{opera.genere}</span>
            {opera.sottogeneri?.map(s => (
              <span key={s} style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 12, color: 'var(--blu-grigio)', border: '1px solid color-mix(in srgb, var(--blu-grigio) 40%, transparent)', padding: '2px 10px' }}>{s}</span>
            ))}
            {opera.is_raccolta && (
              <span style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 12, color: 'var(--blu-grigio)', border: '1px solid color-mix(in srgb, var(--blu-grigio) 30%, transparent)', padding: '2px 10px', fontStyle: 'italic' }}>Raccolta</span>
            )}
            {opera.is_incompiuto && (
              <span style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 12, color: 'var(--blu-grigio)', border: '1px solid color-mix(in srgb, var(--blu-grigio) 30%, transparent)', padding: '2px 10px', fontStyle: 'italic' }}>Incompiuto</span>
            )}
          </div>

          <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 14, color: 'var(--blu-grigio)', marginBottom: 10 }}>
            {opera.fascia_pagine} pagine
          </p>

          {opera.titolo && (
            <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 22, fontStyle: 'italic', color: 'var(--blu-notte)', marginBottom: 12 }}>
              {opera.titolo}
            </p>
          )}

          {opera.sinossi && (
            <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 16, color: 'var(--blu-notte)', lineHeight: 1.75, marginBottom: 24 }}>
              {opera.sinossi}
            </p>
          )}

          {fase === 'idle' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setFase('conferma-prompt')} className="btn-primario" style={{ fontSize: 16, padding: '10px 28px' }}>
                Accetta
              </button>
              <button onClick={() => setFase('rifiuto-prompt')} className="btn-secondario" style={{ fontSize: 16, padding: '10px 24px' }}>
                Declina
              </button>
            </div>
          )}

          {fase === 'conferma-prompt' && (
            <div style={{ padding: 16, background: 'color-mix(in srgb, var(--oro) 6%, var(--avorio))', border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)' }}>
              <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 15, color: 'var(--blu-notte)', fontStyle: 'italic', marginBottom: 14, lineHeight: 1.6 }}>
                Sei pronto a ricevere questo manoscritto? I contatti verranno scambiati in entrambe le direzioni.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={eseguiConferma} className="btn-primario" style={{ fontSize: 14, padding: '8px 20px' }}>
                  Sì, accetto
                </button>
                <button onClick={() => setFase('idle')} style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 14, color: 'var(--blu-grigio)', background: 'none', border: '1px solid color-mix(in srgb, var(--blu-grigio) 40%, transparent)', padding: '8px 16px', cursor: 'pointer' }}>
                  Annulla
                </button>
              </div>
            </div>
          )}

          {fase === 'rifiuto-prompt' && (
            <div style={{ padding: 16, background: 'color-mix(in srgb, var(--blu-grigio) 5%, var(--avorio))', border: '1px solid color-mix(in srgb, var(--blu-grigio) 25%, transparent)' }}>
              <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 15, color: 'var(--blu-notte)', fontStyle: 'italic', marginBottom: 14, lineHeight: 1.6 }}>
                Sei sicuro? Questo manoscritto non ti verrà più proposto.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={eseguiRifiuto} style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 14, color: 'var(--avorio)', background: 'var(--blu-grigio)', border: 'none', padding: '8px 20px', cursor: 'pointer' }}>
                  Sì, declino
                </button>
                <button onClick={() => setFase('idle')} style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 14, color: 'var(--blu-grigio)', background: 'none', border: '1px solid color-mix(in srgb, var(--blu-grigio) 40%, transparent)', padding: '8px 16px', cursor: 'pointer' }}>
                  Annulla
                </button>
              </div>
            </div>
          )}

          {fase === 'loading' && (
            <p style={{ fontFamily: 'EB Garamond, Georgia, serif', fontSize: 15, color: 'var(--blu-grigio)', fontStyle: 'italic' }}>
              Un momento...
            </p>
          )}
        </div>

        <OrologioAntico scade_il={proposta.scade_il} />
      </div>
    </div>
  )
}
