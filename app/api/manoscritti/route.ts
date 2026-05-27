import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { trovaCandidatoPerManoscritto, eseguiMatch } from '@/lib/matching'
import { notificaMatchGestore } from '@/lib/email'

// GET - manoscritti dell'utente corrente
export async function GET() {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('manoscritti')
    .select('*')
    .eq('email_scrittore', sessione.email)
    .order('data_registrazione', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - nuovo manoscritto
export async function POST(req: NextRequest) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Controlla sblocco
  const { data: utente } = await supabaseAdmin
    .from('utenti')
    .select('sbloccato, nome')
    .eq('email', sessione.email)
    .single()

  if (!utente?.sbloccato) {
    return NextResponse.json(
      { error: 'Devi prima ricevere un match come lettore prima di caricare un manoscritto.' },
      { status: 403 }
    )
  }

  // Controlla manoscritto attivo
  const { data: attivi } = await supabaseAdmin
    .from('manoscritti')
    .select('id')
    .eq('email_scrittore', sessione.email)
    .eq('stato', 'in_attesa')

  if (attivi && attivi.length > 0) {
    return NextResponse.json(
      { error: 'Hai già un manoscritto in attesa di lettore.' },
      { status: 409 }
    )
  }

  const body = await req.json()
  const { macro_area, genere, sottogeneri, fascia_pagine, sinossi, titolo, is_raccolta, is_incompiuto } = body

  if (!macro_area || !genere || !fascia_pagine || !sinossi) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
  }

  // Inserisci manoscritto
  const { data: manoscritto, error } = await supabaseAdmin
    .from('manoscritti')
    .insert({
      email_scrittore: sessione.email,
      nome_scrittore: utente.nome,
      macro_area,
      genere,
      sottogeneri: sottogeneri || [],
      fascia_pagine,
      sinossi,
      titolo: titolo || null,
      is_raccolta: is_raccolta || false,
      is_incompiuto: is_incompiuto || false,
      stato: 'in_attesa',
    })
    .select()
    .single()

  if (error || !manoscritto) {
    return NextResponse.json({ error: 'Errore inserimento' }, { status: 500 })
  }

  // Prova il matching
  const candidato = await trovaCandidatoPerManoscritto(manoscritto)
  if (candidato) {
    const { id: matchId, primoMatchLettore } = await eseguiMatch(manoscritto.id, candidato.id)
    
    // Notifica gestore
    try {
      await notificaMatchGestore(
        { ...manoscritto, nome_scrittore: utente.nome },
        { ...candidato, nome_lettore: candidato.nome_lettore },
        matchId,
        primoMatchLettore
      )
    } catch (e) {
      console.error('Errore notifica email:', e)
    }

    return NextResponse.json({ ...manoscritto, match_trovato: true })
  }

  return NextResponse.json({ ...manoscritto, match_trovato: false })
}
