import { supabaseAdmin } from './supabase'
import { FASCIA_ORDINE } from '@/types'
import type { Manoscritto, RichiestaLettura, FasciaPagine } from '@/types'

/**
 * Algoritmo di matching deterministico.
 * Priorità: richiesta/manoscritto più vecchio compatibile (FIFO).
 */

// Trova la richiesta più vecchia compatibile per un manoscritto appena inserito
export async function trovaCandidatoPerManoscritto(
  manoscritto: Manoscritto
): Promise<RichiestaLettura | null> {
  const { data: richieste, error } = await supabaseAdmin
    .from('richieste')
    .select('*')
    .eq('stato', 'in_attesa')
    .neq('email_lettore', manoscritto.email_scrittore)
    .order('data_registrazione', { ascending: true })

  if (error || !richieste?.length) return null

  const orineManoscritto = FASCIA_ORDINE[manoscritto.fascia_pagine as FasciaPagine]

  for (const r of richieste) {
    const generiAccettati: string[] = r.generi_accettati || []
    const macroAreeAccettate: string[] = r.macro_aree_accettate || []
    const ordineLunghezzaMax = FASCIA_ORDINE[r.lunghezza_massima as FasciaPagine]

    // Il genere principale del manoscritto deve essere in generi_accettati
    // OPPURE la macro-area è accettata (se il lettore ha selezionato tutta la macro-area)
    const genereCompatibile =
      generiAccettati.includes(manoscritto.genere) ||
      macroAreeAccettate.includes(manoscritto.macro_area)

    // La fascia pagine del manoscritto deve essere <= lunghezza_massima del lettore
    const lunghezzaCompatibile = orineManoscritto <= ordineLunghezzaMax

    if (genereCompatibile && lunghezzaCompatibile) {
      return r as RichiestaLettura
    }
  }

  return null
}

// Trova il manoscritto più vecchio compatibile per una richiesta appena inserita
export async function trovaCandidatoPerRichiesta(
  richiesta: RichiestaLettura
): Promise<Manoscritto | null> {
  const { data: manoscritti, error } = await supabaseAdmin
    .from('manoscritti')
    .select('*')
    .eq('stato', 'in_attesa')
    .neq('email_scrittore', richiesta.email_lettore)
    .order('data_registrazione', { ascending: true })

  if (error || !manoscritti?.length) return null

  const ordineLunghezzaMax = FASCIA_ORDINE[richiesta.lunghezza_massima as FasciaPagine]

  for (const m of manoscritti) {
    const ordineManoscritto = FASCIA_ORDINE[m.fascia_pagine as FasciaPagine]

    const genereCompatibile =
      richiesta.generi_accettati?.includes(m.genere) ||
      richiesta.macro_aree_accettate?.includes(m.macro_area)

    const lunghezzaCompatibile = ordineManoscritto <= ordineLunghezzaMax

    if (genereCompatibile && lunghezzaCompatibile) {
      return m as Manoscritto
    }
  }

  return null
}

// Esegui il match e aggiorna il DB
export async function eseguiMatch(
  idManoscritto: string,
  idRichiesta: string
): Promise<{ id: string; primoMatchLettore: boolean }> {
  // Leggi i dettagli
  const [{ data: manoscritto }, { data: richiesta }] = await Promise.all([
    supabaseAdmin.from('manoscritti').select('*').eq('id', idManoscritto).single(),
    supabaseAdmin.from('richieste').select('*').eq('id', idRichiesta).single(),
  ])

  if (!manoscritto || !richiesta) throw new Error('Entità non trovate')

  // Controlla se è il primo match del lettore
  const { data: utenteLettore } = await supabaseAdmin
    .from('utenti')
    .select('sbloccato')
    .eq('email', richiesta.email_lettore)
    .single()

  const primoMatchLettore = !utenteLettore?.sbloccato

  // Crea il record di match
  const { data: match, error: matchError } = await supabaseAdmin
    .from('match')
    .insert({
      email_scrittore: manoscritto.email_scrittore,
      email_lettore: richiesta.email_lettore,
      id_manoscritto: idManoscritto,
      id_richiesta: idRichiesta,
      primo_match_lettore: primoMatchLettore,
    })
    .select()
    .single()

  if (matchError || !match) throw new Error('Errore creazione match')

  // Aggiorna stati manoscritto e richiesta
  await Promise.all([
    supabaseAdmin
      .from('manoscritti')
      .update({ stato: 'matchato', id_match: match.id })
      .eq('id', idManoscritto),
    supabaseAdmin
      .from('richieste')
      .update({ stato: 'matchata', id_match: match.id })
      .eq('id', idRichiesta),
  ])

  // Se primo match, sblocca il lettore
  if (primoMatchLettore) {
    await supabaseAdmin
      .from('utenti')
      .update({ sbloccato: true })
      .eq('email', richiesta.email_lettore)
  }

  return { id: match.id, primoMatchLettore }
}
