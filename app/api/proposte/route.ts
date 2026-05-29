import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { confermaProposta, rifiutaProposta } from '@/lib/matching'
import { notificaMatchGestore } from '@/lib/email'

// GET — proposte in sospeso del lettore corrente.
// Restituisce SOLO i dati dell'opera, MAI l'autore (lettura alla cieca).
export async function GET() {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: proposte } = await supabaseAdmin
    .from('proposte')
    .select('id, id_manoscritto, creata_il, scade_il')
    .eq('email_lettore', sessione.email)
    .eq('stato', 'in_sospeso')
    .order('creata_il', { ascending: true })

  if (!proposte?.length) return NextResponse.json([])

  const ids = proposte.map((p) => p.id_manoscritto)
  const { data: manoscritti } = await supabaseAdmin
    .from('manoscritti')
    .select('id, titolo, macro_area, genere, sottogeneri, fascia_pagine, sinossi, is_raccolta, is_incompiuto')
    .in('id', ids)

  const mappa = Object.fromEntries((manoscritti || []).map((m) => [m.id, m]))
  const risultato = proposte.map((p) => ({
    id_proposta: p.id,
    creata_il: p.creata_il,
    scade_il: p.scade_il,
    opera: mappa[p.id_manoscritto] || null,
  }))
  return NextResponse.json(risultato)
}
