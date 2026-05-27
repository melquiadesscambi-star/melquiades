import { NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ utente: null })

  // Leggi dati aggiornati (sbloccato potrebbe essere cambiato)
  const { data: utente } = await supabaseAdmin
    .from('utenti')
    .select('email, nome, sbloccato, data_registrazione')
    .eq('email', sessione.email)
    .single()

  return NextResponse.json({ utente: utente || null })
}
