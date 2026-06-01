import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { ritiraRichiesta } from '@/lib/matching'

// PATCH /api/richieste/[id] - ritira una richiesta
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const esito = await ritiraRichiesta(params.id, sessione.email)
  if (!esito.ok) return NextResponse.json({ error: esito.errore }, { status: esito.status })
  return NextResponse.json({ success: true })
}
