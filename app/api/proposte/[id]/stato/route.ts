import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: proposta } = await supabaseAdmin
    .from('proposte')
    .select('stato, email_lettore')
    .eq('id', params.id)
    .single()

  if (!proposta || proposta.email_lettore !== sessione.email) {
    return NextResponse.json({ valida: false })
  }

  return NextResponse.json({ valida: proposta.stato === 'in_sospeso' })
}
