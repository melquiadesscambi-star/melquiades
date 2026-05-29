import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { confermaProposta } from '@/lib/matching'
import { notificaMatchGestore } from '@/lib/email'

export async function POST(req: NextRequest) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { id_proposta } = await req.json()
  if (!id_proposta) return NextResponse.json({ error: 'id_proposta mancante' }, { status: 400 })

  const esito = await confermaProposta(id_proposta, sessione.email)
  if (!esito.ok) return NextResponse.json({ error: esito.errore }, { status: esito.status })

  // Match reale avvenuto → notifica il gestore.
  try {
    const [{ data: manoscritto }, { data: richiesta }] = await Promise.all([
      supabaseAdmin.from('manoscritti').select('*').eq('id', esito.idManoscritto).single(),
      supabaseAdmin.from('richieste').select('*').eq('id', esito.idRichiesta).single(),
    ])
    await notificaMatchGestore(manoscritto, richiesta, esito.matchId, esito.primoMatchLettore)
  } catch (e) {
    console.error('Errore notifica email:', e)
  }

  return NextResponse.json({ ok: true, primo_match: esito.primoMatchLettore })
}
