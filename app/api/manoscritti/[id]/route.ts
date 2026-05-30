import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH /api/manoscritti/[id] - ritira un manoscritto
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: manoscritto } = await supabaseAdmin
    .from('manoscritti')
    .select('email_scrittore, stato')
    .eq('id', params.id)
    .single()

  if (!manoscritto) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })
  if (manoscritto.email_scrittore !== sessione.email)
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  if (!['in_attesa', 'in_proposta'].includes(manoscritto.stato))
    return NextResponse.json({ error: 'Non puoi ritirare un manoscritto già matchato.' }, { status: 400 })

  // Se in_proposta, chiudi la proposta attiva e rimetti in coda la richiesta del lettore
  if (manoscritto.stato === 'in_proposta') {
    const { data: proposta } = await supabaseAdmin
      .from('proposte')
      .select('id, id_richiesta')
      .eq('id_manoscritto', params.id)
      .eq('stato', 'in_sospeso')
      .single()

    if (proposta) {
      await supabaseAdmin
        .from('proposte')
        .update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
        .eq('id', proposta.id)

      await supabaseAdmin
        .from('richieste')
        .update({ stato: 'in_attesa' })
        .eq('id', proposta.id_richiesta)
    }
  }

  await supabaseAdmin
    .from('manoscritti')
    .update({ stato: 'ritirato' })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
