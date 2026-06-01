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
// Rivendica ENTRAMBE le righe (manoscritto e richiesta) via compare-and-swap
// PRIMA di creare il match, con rollback se qualcosa è stato ritirato nel frattempo.
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
    .from('utenti').select('sbloccato').eq('email', richiesta.email_lettore).single()
  const primoMatchLettore = !utenteLettore?.sbloccato

  // CLAIM 1: rivendica il manoscritto solo se ancora in_proposta.
  const { data: mClaim } = await supabaseAdmin
    .from('manoscritti').update({ stato: 'matchato' })
    .eq('id', idManoscritto).eq('stato', 'in_proposta').select()
  if (!mClaim || mClaim.length === 0) {
    throw new Error('CONFLITTO_RITIRO: il manoscritto non è più disponibile')
  }

  // CLAIM 2: rivendica la richiesta solo se ancora in_proposta.
  const { data: rClaim } = await supabaseAdmin
    .from('richieste').update({ stato: 'matchata' })
    .eq('id', idRichiesta).eq('stato', 'in_proposta').select()
  if (!rClaim || rClaim.length === 0) {
    // Rollback del manoscritto e abort.
    await supabaseAdmin.from('manoscritti').update({ stato: 'in_proposta' }).eq('id', idManoscritto)
    throw new Error('CONFLITTO_RITIRO: la richiesta non è più disponibile')
  }

  // Entrambi rivendicati: crea il match.
  const { data: match, error: matchError } = await supabaseAdmin
    .from('match').insert({
      email_scrittore: manoscritto.email_scrittore,
      email_lettore: richiesta.email_lettore,
      id_manoscritto: idManoscritto,
      id_richiesta: idRichiesta,
      primo_match_lettore: primoMatchLettore,
    }).select().single()
  if (matchError || !match) {
    // Rollback di entrambi.
    await Promise.all([
      supabaseAdmin.from('manoscritti').update({ stato: 'in_proposta' }).eq('id', idManoscritto),
      supabaseAdmin.from('richieste').update({ stato: 'in_proposta' }).eq('id', idRichiesta),
    ])
    throw new Error('Errore creazione match')
  }

  // Aggancia id_match e sblocca il lettore se è il primo match.
  await Promise.all([
    supabaseAdmin.from('manoscritti').update({ id_match: match.id }).eq('id', idManoscritto),
    supabaseAdmin.from('richieste').update({ id_match: match.id }).eq('id', idRichiesta),
  ])
  if (primoMatchLettore) {
    await supabaseAdmin.from('utenti').update({ sbloccato: true }).eq('email', richiesta.email_lettore)
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

  // Compare-and-swap atomico: vince la proposta solo chi la trova ancora 'in_sospeso'.
  const { data: vinte } = await supabaseAdmin
    .from('proposte')
    .update({ stato: 'confermata', risposta_il: new Date().toISOString() })
    .eq('id', idProposta)
    .eq('stato', 'in_sospeso') // ← la guardia: aggiorna solo se ancora in sospeso
    .select()

  if (!vinte || vinte.length === 0) {
    // Un'altra esecuzione simultanea ha già chiuso questa proposta.
    return { ok: false, errore: 'Questa proposta non è più disponibile', status: 409 }
  }

  // Solo ora, dopo aver vinto atomicamente la proposta, esegue il match.
  try {
    const { id: matchId, primoMatchLettore } = await eseguiMatch(p.id_manoscritto, p.id_richiesta)
    return { ok: true, matchId, primoMatchLettore, idManoscritto: p.id_manoscritto, idRichiesta: p.id_richiesta }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('CONFLITTO_RITIRO')) {
      await supabaseAdmin
        .from('proposte').update({ stato: 'scaduta' })
        .eq('id', idProposta).eq('stato', 'confermata')
      // Libera solo la parte ancora appesa in_proposta; quella ritirata resta com'è.
      await Promise.all([
        supabaseAdmin.from('manoscritti').update({ stato: 'in_attesa' })
          .eq('id', p.id_manoscritto).eq('stato', 'in_proposta'),
        supabaseAdmin.from('richieste').update({ stato: 'in_attesa' })
          .eq('id', p.id_richiesta).eq('stato', 'in_proposta'),
      ])
      return { ok: false, errore: 'Questa proposta non è più disponibile', status: 409, motivo: 'ritirato' }
    }
    throw err
  }
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

  // Compare-and-swap atomico: vince il rifiuto solo chi trova la proposta ancora 'in_sospeso'.
  const { data: vinte } = await supabaseAdmin
    .from('proposte')
    .update({ stato: 'rifiutata', risposta_il: new Date().toISOString() })
    .eq('id', idProposta)
    .eq('stato', 'in_sospeso')
    .select()

  if (!vinte || vinte.length === 0) {
    // Un'altra esecuzione simultanea ha già chiuso questa proposta.
    return { ok: false, errore: 'Questa proposta non è più disponibile', status: 409 }
  }

  // La proposta è già stata segnata 'rifiutata' dal compare-and-swap: rimette solo
  // manoscritto e richiesta in coda (senza richiamare liberaProposta per non duplicare l'update).
  await Promise.all([
    supabaseAdmin.from('manoscritti').update({ stato: 'in_attesa' }).eq('id', p.id_manoscritto),
    supabaseAdmin.from('richieste').update({ stato: 'in_attesa' }).eq('id', p.id_richiesta),
  ])

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

// ----------------------------------------------------------------------------
// RITIRO ATOMICO — singola fonte di verità per route e benchmark.
// ----------------------------------------------------------------------------

export type EsitoRitiro = { ok: true } | { ok: false; errore: string; status: number }

export async function ritiraManoscritto(
  id: string,
  emailScrittore?: string
): Promise<EsitoRitiro> {
  const { data: m } = await supabaseAdmin
    .from('manoscritti').select('email_scrittore, stato').eq('id', id).single()
  if (!m) return { ok: false, errore: 'Non trovato', status: 404 }
  if (emailScrittore && m.email_scrittore !== emailScrittore)
    return { ok: false, errore: 'Non autorizzato', status: 403 }
  if (!['in_attesa', 'in_proposta'].includes(m.stato))
    return { ok: false, errore: 'Non puoi ritirare un manoscritto già matchato.', status: 400 }

  // CAS: rivendica il manoscritto per il ritiro solo se ancora ritirabile.
  const { data: vinti } = await supabaseAdmin
    .from('manoscritti').update({ stato: 'ritirato' })
    .eq('id', id).in('stato', ['in_attesa', 'in_proposta']).select()
  if (!vinti || vinti.length === 0) {
    return { ok: false, errore: 'Non puoi ritirare un manoscritto già matchato.', status: 400 }
  }

  // Chiudi l'eventuale proposta in sospeso (CAS) e libera la richiesta del lettore.
  const { data: proposta } = await supabaseAdmin
    .from('proposte').select('id, id_richiesta')
    .eq('id_manoscritto', id).eq('stato', 'in_sospeso').maybeSingle()
  if (proposta) {
    const { data: chiusa } = await supabaseAdmin
      .from('proposte').update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
      .eq('id', proposta.id).eq('stato', 'in_sospeso').select()
    if (chiusa && chiusa.length > 0) {
      await supabaseAdmin.from('richieste').update({ stato: 'in_attesa' })
        .eq('id', proposta.id_richiesta).eq('stato', 'in_proposta')
    }
  }
  return { ok: true }
}

export async function ritiraRichiesta(
  id: string,
  emailLettore?: string
): Promise<EsitoRitiro> {
  const { data: r } = await supabaseAdmin
    .from('richieste').select('email_lettore, stato').eq('id', id).single()
  if (!r) return { ok: false, errore: 'Non trovata', status: 404 }
  if (emailLettore && r.email_lettore !== emailLettore)
    return { ok: false, errore: 'Non autorizzato', status: 403 }
  if (!['in_attesa', 'in_proposta'].includes(r.stato))
    return { ok: false, errore: 'Non puoi ritirare una richiesta già matchata.', status: 400 }

  const { data: vinte } = await supabaseAdmin
    .from('richieste').update({ stato: 'ritirata' })
    .eq('id', id).in('stato', ['in_attesa', 'in_proposta']).select()
  if (!vinte || vinte.length === 0) {
    return { ok: false, errore: 'Non puoi ritirare una richiesta già matchata.', status: 400 }
  }

  const { data: proposta } = await supabaseAdmin
    .from('proposte').select('id, id_manoscritto')
    .eq('id_richiesta', id).eq('stato', 'in_sospeso').maybeSingle()
  if (proposta) {
    const { data: chiusa } = await supabaseAdmin
      .from('proposte').update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
      .eq('id', proposta.id).eq('stato', 'in_sospeso').select()
    if (chiusa && chiusa.length > 0) {
      await supabaseAdmin.from('manoscritti').update({ stato: 'in_attesa' })
        .eq('id', proposta.id_manoscritto).eq('stato', 'in_proposta')
    }
  }
  return { ok: true }
}
