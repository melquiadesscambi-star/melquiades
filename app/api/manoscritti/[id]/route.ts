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
  if (manoscritto.stato !== 'in_attesa')
    return NextResponse.json({ error: 'Non puoi ritirare un manoscritto già matchato.' }, { status: 400 })

  await supabaseAdmin
    .from('manoscritti')
    .update({ stato: 'ritirato' })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
