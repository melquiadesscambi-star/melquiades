import { NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('match')
    .select(`
      *,
      manoscritti:id_manoscritto(genere, macro_area, fascia_pagine, sinossi, titolo),
      richieste:id_richiesta(generi_accettati, lunghezza_massima)
    `)
    .or(`email_scrittore.eq.${sessione.email},email_lettore.eq.${sessione.email}`)
    .order('data_match', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
