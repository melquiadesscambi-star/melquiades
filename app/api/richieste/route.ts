import { NextRequest, NextResponse } from 'next/server'
import { leggiSessione } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { trovaCandidatoPerRichiesta, apriProposta } from '@/lib/matching'

// GET - richieste dell'utente corrente
export async function GET() {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('richieste')
    .select('*')
    .eq('email_lettore', sessione.email)
    .order('data_registrazione', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST - nuova richiesta lettura
export async function POST(req: NextRequest) {
  const sessione = await leggiSessione()
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Controlla richiesta attiva
  const { data: attive } = await supabaseAdmin
    .from('richieste')
    .select('id')
    .eq('email_lettore', sessione.email)
    .in('stato', ['in_attesa', 'in_proposta'])

  if (attive && attive.length > 0) {
    return NextResponse.json(
      { error: 'Hai già una richiesta di lettura in attesa.' },
      { status: 409 }
    )
  }

  const body = await req.json()
  const { generi_accettati, macro_aree_accettate, lunghezza_massima } = body

  if (!generi_accettati?.length || !lunghezza_massima) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
  }

  // Recupera nome lettore
  const { data: utente } = await supabaseAdmin
    .from('utenti')
    .select('nome')
    .eq('email', sessione.email)
    .single()

  // Inserisci richiesta
  const { data: richiesta, error } = await supabaseAdmin
    .from('richieste')
    .insert({
      email_lettore: sessione.email,
      nome_lettore: utente?.nome,
      generi_accettati,
      macro_aree_accettate: macro_aree_accettate || [],
      lunghezza_massima,
      stato: 'in_attesa',
    })
    .select()
    .single()

  if (error || !richiesta) {
    return NextResponse.json({ error: 'Errore inserimento' }, { status: 500 })
  }

  // Prova il matching. Qui il lettore PUÒ sapere di avere una proposta:
  // è lui che dovrà confermarla o rifiutarla.
  const candidato = await trovaCandidatoPerRichiesta(richiesta)
  if (candidato) {
    await apriProposta(candidato.id, richiesta.id)
    return NextResponse.json({ ...richiesta, proposta_aperta: true })
  }
  return NextResponse.json({ ...richiesta, proposta_aperta: false })
}
