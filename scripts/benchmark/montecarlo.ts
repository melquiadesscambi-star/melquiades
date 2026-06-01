/**
 * ============================================================================
 *  montecarlo.ts — STRATO 2: Monte Carlo MIGLIORATO.
 * ----------------------------------------------------------------------------
 *  Migliorie rispetto al vecchio stress test:
 *   - SEME RIPRODUCIBILE (RNG mulberry32): stesso seed ⇒ stessa corsa. Il seed
 *     viene stampato e, in caso di invariante rotta, mostrato per riprodurre.
 *   - VARIETÀ RIDOTTA del pool fittizio (poche macro-aree/generi, lunghezze
 *     ampie) così le proposte scattano spesso.
 *   - AZIONI PESATE: quando esiste almeno una proposta in_sospeso, CONFERMA/
 *     RIFIUTA/SCADENZA hanno priorità ⇒ molte più conferme e rifiuti.
 *  Dopo OGNI azione verifica le 12 invarianti; su rottura si ferma e riporta
 *  seed + sequenza completa + ID coinvolti.
 * ============================================================================
 */

import {
  MARKER,
  Rng,
  leggiStato,
  haRichiestaAttiva,
  haManoscrittoAttivo,
  neutralizzaPerLike,
  type Supa,
  type Matching,
  type StatoSequenza,
} from './helpers'
import { InvariantViolation, verificaFIFO, verificaInvarianti } from './invariants'
import type { MacroArea, FasciaPagine } from '../../types/index'

// ----------------------------------------------------------------------------
// Pool a bassa varietà: massimizza le coincidenze di genere ⇒ più proposte.
// ----------------------------------------------------------------------------
const MC_MACRO: MacroArea = 'Narrativa'
const MC_GENERI = ['Contemporanea', 'Storica', 'Thriller e giallo', 'Romance']
// I manoscritti tendono a essere brevi, le richieste accettano lunghezze ampie:
// la compatibilità di fascia è quasi sempre soddisfatta.
const MC_FASCE_MS: FasciaPagine[] = ['1-50', '51-100', '101-150']
const MC_LUNGHEZZE: FasciaPagine[] = ['101-150', '151-200', '201-300', 'oltre 300']

const VETERANI_PERC = 40 // % di utenti che nascono già sbloccati (bootstrap)

type AzioneTipo =
  | 'REGISTRA'
  | 'CREA_RICHIESTA'
  | 'CARICA_MANOSCRITTO'
  | 'CONFERMA'
  | 'RIFIUTA'
  | 'RITIRA_MANOSCRITTO'
  | 'RITIRA_RICHIESTA'
  | 'SCADENZA'

interface VoceLog {
  indice: number
  utente: string
  azione: string
  dettagli: string
}

export interface RisultatoMonteCarlo {
  seed: number
  azioniTotali: number
  distribuzione: Record<string, number>
  violazione: InvariantViolation | null
  logAzioni: VoceLog[]
}

export interface OpzMonteCarlo {
  utenti: number
  azioni: number
  seed: number
}

// Pesi delle azioni. Quando c'è almeno una proposta in_sospeso, CONFERMA e
// RIFIUTA dominano: è la chiave per superare 80 conferme+rifiuti su 500 azioni.
function pesoAzione(a: AzioneTipo, cPropSospese: number): number {
  if (cPropSospese > 0) {
    switch (a) {
      case 'CONFERMA':
        return 6
      case 'RIFIUTA':
        return 6
      case 'SCADENZA':
        return 1
      case 'REGISTRA':
        return 2
      case 'CREA_RICHIESTA':
        return 3
      case 'CARICA_MANOSCRITTO':
        return 3
      default:
        return 1 // RITIRA_*
    }
  }
  // Nessuna proposta viva: spingi la creazione per generarne.
  switch (a) {
    case 'REGISTRA':
      return 3
    case 'CREA_RICHIESTA':
      return 5
    case 'CARICA_MANOSCRITTO':
      return 5
    default:
      return 1
  }
}

export async function eseguiMonteCarlo(
  supa: Supa,
  matching: Matching,
  opz: OpzMonteCarlo
): Promise<RisultatoMonteCarlo> {
  const rng = new Rng(opz.seed)
  const likePrefix = `mc-%${MARKER}`
  const orPrefix = `mc-*`

  let violazione: InvariantViolation | null = null
  const logAzioni: VoceLog[] = []
  let azioniTotali = 0
  const distribuzione: Record<string, number> = {}
  let prossimoUtente = 0

  // Stato fittizio di questo strato (prefisso mc-). Letto fresco a ogni giro.
  const leggi = (): Promise<StatoSequenza> => leggiStato(supa, likePrefix, orPrefix)

  for (let i = 0; i < opz.azioni; i++) {
    const stato = await leggi()

    const possibili: AzioneTipo[] = []
    if (prossimoUtente < opz.utenti) possibili.push('REGISTRA')
    if (stato.utenti.some((u) => !haRichiestaAttiva(u.email, stato)))
      possibili.push('CREA_RICHIESTA')
    if (stato.utenti.some((u) => u.sbloccato && !haManoscrittoAttivo(u.email, stato)))
      possibili.push('CARICA_MANOSCRITTO')
    if (stato.proposteInSospeso.length > 0) {
      possibili.push('CONFERMA')
      possibili.push('RIFIUTA')
      possibili.push('SCADENZA')
    }
    if (stato.manoscritti.some((m) => m.stato === 'in_attesa' || m.stato === 'in_proposta'))
      possibili.push('RITIRA_MANOSCRITTO')
    if (stato.richieste.some((r) => r.stato === 'in_attesa' || r.stato === 'in_proposta'))
      possibili.push('RITIRA_RICHIESTA')

    if (possibili.length === 0) break

    const azione = rng.weighted(
      possibili.map((a) => ({ item: a, peso: pesoAzione(a, stato.proposteInSospeso.length) }))
    )
    distribuzione[azione] = (distribuzione[azione] ?? 0) + 1

    let utenteCoinvolto = '-'
    let dettagli = ''
    let azioneFallita = false

    try {
      switch (azione) {
        case 'REGISTRA': {
          const n = prossimoUtente++
          const emailU = `mc-${n}${MARKER}`
          utenteCoinvolto = emailU
          const sbloccato = rng.int(1, 100) <= VETERANI_PERC
          await supa.from('utenti').insert({ email: emailU, nome: `Utente mc-${n}`, sbloccato })
          dettagli = `registrato (sbloccato=${sbloccato})`
          break
        }

        case 'CREA_RICHIESTA': {
          const u = rng.pick(stato.utenti.filter((x) => !haRichiestaAttiva(x.email, stato)))
          utenteCoinvolto = u.email
          const generi = rng.subset(MC_GENERI, 1, 3)
          // Metà delle volte accetta anche l'intera macro-area ⇒ più match.
          const macroAree: MacroArea[] = rng.int(0, 1) === 0 ? [MC_MACRO] : []
          const lunghezzaMassima = rng.pick(MC_LUNGHEZZE)

          const { data: richiesta } = await supa
            .from('richieste')
            .insert({
              email_lettore: u.email,
              nome_lettore: `Utente ${u.email}`,
              generi_accettati: generi,
              macro_aree_accettate: macroAree,
              lunghezza_massima: lunghezzaMassima,
              stato: 'in_attesa',
            })
            .select()
            .single()

          dettagli = `richiesta ${richiesta.id} (generi=[${generi.join('|')}] macro=[${macroAree.join('|')}] max=${lunghezzaMassima})`

          const candidato = await matching.trovaCandidatoPerRichiesta(richiesta)
          if (candidato) {
            await verificaFIFO(supa, 'richiesta', candidato, richiesta)
            await matching.apriProposta(candidato.id, richiesta.id)
            dettagli += ` → proposta aperta con manoscritto ${candidato.id}`
          }
          break
        }

        case 'CARICA_MANOSCRITTO': {
          const u = rng.pick(
            stato.utenti.filter((x) => x.sbloccato && !haManoscrittoAttivo(x.email, stato))
          )
          utenteCoinvolto = u.email
          const genere = rng.pick(MC_GENERI)
          const fascia = rng.pick(MC_FASCE_MS)

          const { data: manoscritto } = await supa
            .from('manoscritti')
            .insert({
              email_scrittore: u.email,
              nome_scrittore: `Utente ${u.email}`,
              titolo: `Titolo mc-${i}`,
              macro_area: MC_MACRO,
              genere,
              sottogeneri: [],
              fascia_pagine: fascia,
              sinossi: `Sinossi di prova generata dal benchmark (${i}).`,
              is_raccolta: false,
              is_incompiuto: false,
              stato: 'in_attesa',
            })
            .select()
            .single()

          dettagli = `manoscritto ${manoscritto.id} (genere=${genere} macro=${MC_MACRO} fascia=${fascia})`

          const candidato = await matching.trovaCandidatoPerManoscritto(manoscritto)
          if (candidato) {
            await verificaFIFO(supa, 'manoscritto', manoscritto, candidato)
            await matching.apriProposta(manoscritto.id, candidato.id)
            dettagli += ` → proposta aperta con richiesta ${candidato.id}`
          }
          break
        }

        case 'CONFERMA': {
          const p = rng.pick(stato.proposteInSospeso)
          utenteCoinvolto = p.email_lettore
          const res = await matching.confermaProposta(p.id, p.email_lettore)
          dettagli = `conferma proposta ${p.id} (ms=${p.id_manoscritto} ric=${p.id_richiesta}) → ${
            res.ok ? `match ${res.matchId} (primoMatch=${res.primoMatchLettore})` : `KO: ${res.errore}`
          }`
          break
        }

        case 'RIFIUTA': {
          const p = rng.pick(stato.proposteInSospeso)
          utenteCoinvolto = p.email_lettore
          const res = await matching.rifiutaProposta(p.id, p.email_lettore)
          dettagli = `rifiuta proposta ${p.id} (ms=${p.id_manoscritto} ric=${p.id_richiesta}) → ${
            res.ok ? 'ok' : `KO: ${res.errore}`
          }`
          break
        }

        case 'RITIRA_MANOSCRITTO': {
          const m = rng.pick(
            stato.manoscritti.filter((x) => x.stato === 'in_attesa' || x.stato === 'in_proposta')
          )
          utenteCoinvolto = m.email_scrittore
          await ritiraManoscrittoMC(supa, m.id)
          dettagli = `ritirato manoscritto ${m.id} (era ${m.stato})`
          break
        }

        case 'RITIRA_RICHIESTA': {
          const r = rng.pick(
            stato.richieste.filter((x) => x.stato === 'in_attesa' || x.stato === 'in_proposta')
          )
          utenteCoinvolto = r.email_lettore
          await ritiraRichiestaMC(supa, r.id)
          dettagli = `ritirata richiesta ${r.id} (era ${r.stato})`
          break
        }

        case 'SCADENZA': {
          const p = rng.pick(stato.proposteInSospeso)
          utenteCoinvolto = p.email_lettore
          const passato = new Date(Date.now() - 1000 * 60 * 60).toISOString()
          await supa.from('proposte').update({ scade_il: passato }).eq('id', p.id)
          const res = await matching.liberaProposteScadute()
          dettagli = `scadenza forzata proposta ${p.id} → liberaProposteScadute(): elaborate=${res.elaborate} errori=${res.errori}`
          break
        }
      }
    } catch (err) {
      logAzioni.push({ indice: i, utente: utenteCoinvolto, azione, dettagli: dettagli || '(durante)' })
      violazione =
        err instanceof InvariantViolation
          ? err
          : new InvariantViolation(
              0,
              "Eccezione runtime durante un'azione (la logica di matching ha lanciato un errore)",
              `${(err as Error).message}\n${(err as Error).stack ?? ''}`
            )
      azioneFallita = true
    }

    if (azioneFallita) break

    logAzioni.push({ indice: i, utente: utenteCoinvolto, azione, dettagli })
    azioniTotali++

    try {
      await verificaInvarianti(supa, likePrefix, orPrefix)
    } catch (err) {
      if (err instanceof InvariantViolation) {
        violazione = err
        break
      }
      throw err
    }
  }

  // Pulizia di isolamento: porta a stato terminale le righe mc- ancora vive,
  // così gli strati successivi partono puliti (nessun DELETE).
  try {
    await neutralizzaPerLike(supa, likePrefix, orPrefix)
  } catch {
    /* best effort */
  }

  return { seed: opz.seed, azioniTotali, distribuzione, violazione, logAzioni }
}

// Replica delle route di ritiro (versione per il Monte Carlo).
async function ritiraManoscrittoMC(supa: Supa, id: string): Promise<void> {
  const { data: manoscritto } = await supa
    .from('manoscritti')
    .select('stato')
    .eq('id', id)
    .single()
  if (!manoscritto || !['in_attesa', 'in_proposta'].includes(manoscritto.stato)) return
  if (manoscritto.stato === 'in_proposta') {
    const { data: proposta } = await supa
      .from('proposte')
      .select('id, id_richiesta')
      .eq('id_manoscritto', id)
      .eq('stato', 'in_sospeso')
      .single()
    if (proposta) {
      await supa
        .from('proposte')
        .update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
        .eq('id', proposta.id)
      await supa.from('richieste').update({ stato: 'in_attesa' }).eq('id', proposta.id_richiesta)
    }
  }
  await supa.from('manoscritti').update({ stato: 'ritirato' }).eq('id', id)
}

async function ritiraRichiestaMC(supa: Supa, id: string): Promise<void> {
  const { data: richiesta } = await supa.from('richieste').select('stato').eq('id', id).single()
  if (!richiesta || !['in_attesa', 'in_proposta'].includes(richiesta.stato)) return
  if (richiesta.stato === 'in_proposta') {
    const { data: proposta } = await supa
      .from('proposte')
      .select('id, id_manoscritto')
      .eq('id_richiesta', id)
      .eq('stato', 'in_sospeso')
      .single()
    if (proposta) {
      await supa
        .from('proposte')
        .update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
        .eq('id', proposta.id)
      await supa.from('manoscritti').update({ stato: 'in_attesa' }).eq('id', proposta.id_manoscritto)
    }
  }
  await supa.from('richieste').update({ stato: 'ritirata' }).eq('id', id)
}
