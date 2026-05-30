import { supabaseAdmin } from './supabase'
import { FASCIA_ORDINE } from '@/types'
import type { Manoscritto, RichiestaLettura, FasciaPagine } from '@/types'

/**
 * Algoritmo di matching deterministico (FIFO).
 * Il matching NON chiude più direttamente il match: apre una proposta
 * al lettore, che ha 24 ore per confermare o rifiutare.
 */

// Trova la richiesta più vecchia compatibile per un manoscritto.
// Esclude i lettori a cui questo manoscritto è già stato proposto (qualsiasi stato).
export async function trovaCandidatoPerManoscritto(
  manoscritto: Manoscritto
): Promise<RichiestaLettura | null> {
  const { data: proposteEsistenti } = await supabaseAdmin
    .from('proposte')
    .select('email_lettore')
    .eq('id_manoscritto', manoscritto.id)
  const lettoriEsclusi = new Set((proposteEsistenti || []).map((p) => p.email_lettore))

  const { data: richieste, error } = await supabaseAdmin
    .from('richieste')
    .select('*')
    .eq('stato', 'in_attesa')
    .neq('email_lettore', manoscritto.email_scrittore)
    .order('data_registrazione', { ascending: true })

  if (error || !richieste?.length) return null

  const ordineManoscritto = FASCIA_ORDINE[manoscritto.fascia_pagine as FasciaPagine]

  for (const r of richieste) {
    if (lettoriEsclusi.has(r.email_lettore)) continue

    const generiAccettati: string[] = r.generi_accettati || []
    const macroAreeAccettate: string[] = r.macro_aree_accettate || []
    const ordineLunghezzaMax = FASCIA_ORDINE[r.lunghezza_massima as FasciaPagine]

    const genereCompatibile =
      generiAccettati.includes(manoscritto.genere) ||
      macroAreeAccettate.includes(manoscritto.macro_area)
    const lunghezzaCompatibile = ordineManoscritto <= ordineLunghezzaMax

    if (genereCompatibile && lunghezzaCompatibile) {
      return r as RichiestaLettura
    }
  }
  return null
}

// Trova il manoscritto più vecchio compatibile per una richiesta.
// Esclude i manoscritti già proposti a questo lettore (qualsiasi stato).
export async function trovaCandidatoPerRichiesta(
  richiesta: RichiestaLettura
): Promise<Manoscritto | null> {
  const { data: proposteEsistenti } = await supabaseAdmin
    .from('proposte')
    .select('id_manoscritto')
    .eq('email_lettore', richiesta.email_lettore)
  const manoscrittiEsclusi = new Set((proposteEsistenti || []).map((p) => p.id_manoscritto))

  const { data: manoscritti, error } = await supabaseAdmin
    .from('manoscritti')
    .select('*')
    .eq('stato', 'in_attesa')
    .neq('email_scrittore', richiesta.email_lettore)
    .order('data_registrazione', { ascending: true })

  if (error || !manoscritti?.length) return null

  const ordineLunghezzaMax = FASCIA_ORDINE[richiesta.lunghezza_massima as FasciaPagine]

  for (const m of manoscritti) {
    if (manoscrittiEsclusi.has(m.id)) continue

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

// Apre una proposta: crea il record in `proposte` e mette manoscritto e
// richiesta in stato 'in_proposta' (escono dalla coda finché non c'è risposta).
export async function apriProposta(
  idManoscritto: string,
  idRichiesta: string
): Promise<string> {
  const [{ data: m }, { data: r }] = await Promise.all([
    supabaseAdmin.from('manoscritti').select('email_scrittore').eq('id', idManoscritto).single(),
    supabaseAdmin.from('richieste').select('email_lettore').eq('id', idRichiesta).single(),
  ])
  if (!m || !r) throw new Error('Entità non trovate')

  const { data: proposta, error } = await supabaseAdmin
    .from('proposte')
    .insert({
      id_manoscritto: idManoscritto,
      id_richiesta: idRichiesta,
      email_lettore: r.email_lettore,
      email_scrittore: m.email_scrittore,
      stato: 'in_sospeso',
    })
    .select()
    .single()
  if (error || !proposta) throw new Error('Errore creazione proposta')

  await Promise.all([
    supabaseAdmin.from('manoscritti').update({ stato: 'in_proposta' }).eq('id', idManoscritto),
    supabaseAdmin.from('richieste').update({ stato: 'in_proposta' }).eq('id', idRichiesta),
  ])

  return proposta.id
}

// Esegue il match reale (chiamata solo alla conferma di una proposta).
export async function eseguiMatch(
  idManoscritto: string,
  idRichiesta: string
): Promise<{ id: string; primoMatchLettore: boolean }> {
  const [{ data: manoscritto }, { data: richiesta }] = await Promise.all([
    supabaseAdmin.from('manoscritti').select('*').eq('id', idManoscritto).single(),
    supabaseAdmin.from('richieste').select('*').eq('id', idRichiesta).single(),
  ])
  if (!manoscritto || !richiesta) throw new Error('Entità non trovate')

  const { data: utenteLettore } = await supabaseAdmin
    .from('utenti')
    .select('sbloccato')
    .eq('email', richiesta.email_lettore)
    .single()
  const primoMatchLettore = !utenteLettore?.sbloccato

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

  if (primoMatchLettore) {
    await supabaseAdmin
      .from('utenti')
      .update({ sbloccato: true })
      .eq('email', richiesta.email_lettore)
  }

  return { id: match.id, primoMatchLettore }
}

// Rimette manoscritto e richiesta in coda dopo rifiuto o scadenza.
// La data_registrazione NON viene toccata: la posizione FIFO è preservata.
// La proposta resta registrata (stato rifiutata/scaduta): così quel
// manoscritto non sarà mai più proposto a quel lettore.
export async function liberaProposta(
  proposta: { id: string; id_manoscritto: string; id_richiesta: string },
  nuovoStato: 'rifiutata' | 'scaduta'
): Promise<void> {
  await supabaseAdmin
    .from('proposte')
    .update({ stato: nuovoStato, risposta_il: new Date().toISOString() })
    .eq('id', proposta.id)
  await Promise.all([
    supabaseAdmin.from('manoscritti').update({ stato: 'in_attesa' }).eq('id', proposta.id_manoscritto),
    supabaseAdmin.from('richieste').update({ stato: 'in_attesa' }).eq('id', proposta.id_richiesta),
  ])
}

// Cerca tutte le proposte in_sospeso scadute e le libera.
// Per ognuna: segna come 'scaduta', rimette in coda manoscritto e richiesta,
// rilancia il matching per entrambi. Chiamata dal cron giornaliero.
export async function liberaProposteScadute(): Promise<{
  elaborate: number
  errori: number
}> {
  const { data: scadute, error } = await supabaseAdmin
    .from('proposte')
    .select('*')
    .eq('stato', 'in_sospeso')
    .lt('scade_il', new Date().toISOString())

  if (error || !scadute?.length) return { elaborate: 0, errori: 0 }

  let elaborate = 0
  let errori = 0

  for (const proposta of scadute) {
    try {
      await liberaProposta(proposta, 'scaduta')

      const { data: richiesta } = await supabaseAdmin
        .from('richieste')
        .select('*')
        .eq('id', proposta.id_richiesta)
        .single()
      if (richiesta && richiesta.stato === 'in_attesa') {
        const cand = await trovaCandidatoPerRichiesta(richiesta as RichiestaLettura)
        if (cand) await apriProposta(cand.id, richiesta.id)
      }

      const { data: manoscritto } = await supabaseAdmin
        .from('manoscritti')
        .select('*')
        .eq('id', proposta.id_manoscritto)
        .single()
      if (manoscritto && manoscritto.stato === 'in_attesa') {
        const cand = await trovaCandidatoPerManoscritto(manoscritto as Manoscritto)
        if (cand) await apriProposta(manoscritto.id, cand.id)
      }

      elaborate++
    } catch (err) {
      console.error('[liberaProposteScadute] Errore su proposta', proposta.id, err)
      errori++
    }
  }

  return { elaborate, errori }
}

type EsitoConferma =
  | { ok: true; matchId: string; primoMatchLettore: boolean; idManoscritto: string; idRichiesta: string }
  | { ok: false; errore: string; status: number; motivo?: 'ritirato' | 'scaduto' }

// Conferma di una proposta da parte del lettore.
export async function confermaProposta(
  idProposta: string,
  emailLettore: string
): Promise<EsitoConferma> {
  const { data: p } = await supabaseAdmin.from('proposte').select('*').eq('id', idProposta).single()
  if (!p) return { ok: false, errore: 'Proposta non trovata', status: 404 }
  if (p.email_lettore !== emailLettore) return { ok: false, errore: 'Non autorizzato', status: 403 }
  if (p.stato !== 'in_sospeso') {
    const { data: man } = await supabaseAdmin
      .from('manoscritti')
      .select('stato')
      .eq('id', p.id_manoscritto)
      .single()
    const motivo = man?.stato === 'ritirato' ? 'ritirato' : 'scaduto'
    return { ok: false, errore: 'Questa proposta non è più disponibile', status: 409, motivo }
  }
  if (new Date(p.scade_il) < new Date()) {
    await liberaProposta(p, 'scaduta')
    return { ok: false, errore: 'Il tempo per rispondere è scaduto', status: 410 }
  }

  const { id: matchId, primoMatchLettore } = await eseguiMatch(p.id_manoscritto, p.id_richiesta)
  await supabaseAdmin
    .from('proposte')
    .update({ stato: 'confermata', risposta_il: new Date().toISOString() })
    .eq('id', idProposta)

  return { ok: true, matchId, primoMatchLettore, idManoscritto: p.id_manoscritto, idRichiesta: p.id_richiesta }
}

type EsitoRifiuto = { ok: true } | { ok: false; errore: string; status: number; motivo?: 'ritirato' | 'scaduto' }

// Rifiuto di una proposta da parte del lettore.
// Dopo il rifiuto, rilancia il matching per richiesta e manoscritto.
export async function rifiutaProposta(
  idProposta: string,
  emailLettore: string
): Promise<EsitoRifiuto> {
  const { data: p } = await supabaseAdmin.from('proposte').select('*').eq('id', idProposta).single()
  if (!p) return { ok: false, errore: 'Proposta non trovata', status: 404 }
  if (p.email_lettore !== emailLettore) return { ok: false, errore: 'Non autorizzato', status: 403 }
  if (p.stato !== 'in_sospeso') {
    const { data: man } = await supabaseAdmin
      .from('manoscritti')
      .select('stato')
      .eq('id', p.id_manoscritto)
      .single()
    const motivo = man?.stato === 'ritirato' ? 'ritirato' : 'scaduto'
    return { ok: false, errore: 'Questa proposta non è più disponibile', status: 409, motivo }
  }

  await liberaProposta(p, 'rifiutata')

  // Re-matching: la richiesta torna attiva e cerca un altro manoscritto.
  const { data: richiesta } = await supabaseAdmin.from('richieste').select('*').eq('id', p.id_richiesta).single()
  if (richiesta && richiesta.stato === 'in_attesa') {
    const cand = await trovaCandidatoPerRichiesta(richiesta as RichiestaLettura)
    if (cand) await apriProposta(cand.id, richiesta.id)
  }

  // Il manoscritto, se ancora in attesa, cerca un'altra richiesta.
  const { data: manoscritto } = await supabaseAdmin.from('manoscritti').select('*').eq('id', p.id_manoscritto).single()
  if (manoscritto && manoscritto.stato === 'in_attesa') {
    const cand = await trovaCandidatoPerManoscritto(manoscritto as Manoscritto)
    if (cand) await apriProposta(manoscritto.id, cand.id)
  }

  return { ok: true }
}
