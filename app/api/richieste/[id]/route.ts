import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: richiesta } = await supabaseAdmin
    .from('richieste')
    .select('email_lettore, stato')
    .eq('id', params.id)
    .single()

  if (!richiesta) return NextResponse.json({ error: 'Non trovata' }, { status: 404 })
  if (richiesta.email_lettore !== sessione.email)
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  if (!['in_attesa', 'in_proposta'].includes(richiesta.stato))
    return NextResponse.json({ error: 'Non puoi ritirare una richiesta già matchata.' }, { status: 400 })

  // Se in_proposta, chiudi la proposta attiva e rimetti in coda il manoscritto dello scrittore
  if (richiesta.stato === 'in_proposta') {
    const { data: proposta } = await supabaseAdmin
      .from('proposte')
      .select('id, id_manoscritto')
      .eq('id_richiesta', params.id)
      .eq('stato', 'in_sospeso')
      .single()

    if (proposta) {
      await supabaseAdmin
        .from('proposte')
        .update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
        .eq('id', proposta.id)

      await supabaseAdmin
        .from('manoscritti')
        .update({ stato: 'in_attesa' })
        .eq('id', proposta.id_manoscritto)
    }
  }

  await supabaseAdmin
    .from('richieste')
    .update({ stato: 'ritirata' })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
