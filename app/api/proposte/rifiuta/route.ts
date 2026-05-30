import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { rifiutaProposta } from '@/lib/matching'

export async function POST(req: NextRequest) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { id_proposta } = await req.json()
  if (!id_proposta) return NextResponse.json({ error: 'id_proposta mancante' }, { status: 400 })

  const esito = await rifiutaProposta(id_proposta, sessione.email)
  if (!esito.ok) return NextResponse.json({ error: esito.errore, motivo: esito.motivo }, { status: esito.status })

  return NextResponse.json({ ok: true })
}
