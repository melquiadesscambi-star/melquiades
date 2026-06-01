import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { ritiraManoscritto } from '@/lib/matching'

// PATCH /api/manoscritti/[id] - ritira un manoscritto
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const esito = await ritiraManoscritto(params.id, sessione.email)
  if (!esito.ok) return NextResponse.json({ error: esito.errore }, { status: esito.status })
  return NextResponse.json({ success: true })
}
