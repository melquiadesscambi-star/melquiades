'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  tipo: 'richiesta' | 'manoscritto'
  label: string
  messaggioConferma: string
  messaggioRitirato: string
}

export default function BottoneRitira({ id, tipo, label, messaggioConferma, messaggioRitirato }: Props) {
  const router = useRouter()
  const [stato, setStato] = useState<'idle' | 'conferma' | 'ritirato'>('idle')

  async function conferma() {
    const endpoint = tipo === 'richiesta'
      ? `/api/richieste/${id}`
      : `/api/manoscritti/${id}`
    const res = await fetch(endpoint, { method: 'PATCH' })
    if (res.ok) {
      setStato('ritirato')
      router.refresh()
    }
  }

  if (stato === 'ritirato') {
    return (
      <p className="font-serif text-sm italic" style={{ color: 'var(--blu-grigio)' }}>
        {messaggioRitirato}
      </p>
    )
  }

  return (
    <div>
      {stato === 'idle' && (
        <button
          onClick={() => setStato('conferma')}
          className="font-serif text-sm"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--blu-grigio)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: 'rgba(90,110,140,0.4)',
          }}
        >
          {label}
        </button>
      )}
      {stato === 'conferma' && (
        <div
          className="p-3"
          style={{
            background: 'color-mix(in srgb, var(--oro) 6%, var(--avorio))',
            border: '1px solid color-mix(in srgb, var(--oro) 25%, transparent)',
          }}
        >
          <p className="font-serif text-sm italic mb-3" style={{ color: 'var(--blu-notte)' }}>
            {messaggioConferma}
          </p>
          <div className="flex gap-3">
            <button
              onClick={conferma}
              className="font-serif text-sm"
              style={{
                background: 'var(--blu-notte)',
                color: 'var(--avorio)',
                border: 'none',
                padding: '6px 16px',
                cursor: 'pointer',
              }}
            >
              Sì, ritira
            </button>
            <button
              onClick={() => setStato('idle')}
              className="font-serif text-sm"
              style={{
                background: 'none',
                color: 'var(--blu-grigio)',
                border: '1px solid rgba(90,110,140,0.3)',
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
