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
  if (richiesta.stato !== 'in_attesa')
    return NextResponse.json({ error: 'Non puoi ritirare una richiesta già matchata.' }, { status: 400 })

  await supabaseAdmin
    .from('richieste')
    .update({ stato: 'ritirata' })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
