/**
 * ============================================================================
 *  concurrency.ts — STRATO 3: prove di CONCORRENZA (best effort).
 * ----------------------------------------------------------------------------
 *  ATTENZIONE: questi esiti possono essere "ballerini". La logica di matching
 *  NON usa transazioni/lock, quindi due operazioni simultanee possono produrre
 *  stati incoerenti. Il benchmark NON adatta l'aspettativa al codice: definisce
 *  l'esito COERENTE atteso e conta su N ripetizioni quante volte si verifica.
 * ============================================================================
 */

import {
  email,
  creaUtente,
  creaManoscritto,
  creaRichiesta,
  getManoscritto,
  getRichiesta,
  getProposta,
  contaMatchPerManoscritto,
  ritiraManoscritto,
  neutralizzaScenario,
  type Supa,
  type Matching,
} from './helpers'

const MACRO = 'Narrativa' as const
const G1 = 'Contemporanea'
const F_MEDIA = '101-150' as const
const F_GRANDE = '151-200' as const

export interface RisultatoProva {
  nome: string
  descrizione: string
  ripetizioni: number
  coerenti: number
  dettagli: string[]
}

// Crea una proposta in_sospeso fresca e ritorna gli id coinvolti.
async function setupProposta(
  supa: Supa,
  matching: Matching,
  slug: string
): Promise<{ idM: string; idR: string; idP: string; lettore: string }> {
  const S = email(slug, 'scrittore')
  const L = email(slug, 'lettore')
  await creaUtente(supa, S, true)
  await creaUtente(supa, L, false)
  const M = await creaManoscritto(supa, {
    email_scrittore: S,
    macro_area: MACRO,
    genere: G1,
    fascia_pagine: F_MEDIA,
  })
  const R = await creaRichiesta(supa, {
    email_lettore: L,
    generi_accettati: [G1],
    lunghezza_massima: F_GRANDE,
  })
  const idP = await matching.apriProposta(M.id, R.id)
  return { idM: M.id, idR: R.id, idP, lettore: L }
}

// ----------------------------------------------------------------------------
// F1 — doppia conferma simultanea.
// Atteso COERENTE: esattamente una conferma ok=true, l'altra ok=false; P
// confermata una sola volta; UN SOLO record in match; nessuno stato impossibile.
// ----------------------------------------------------------------------------
export async function provaF1(
  supa: Supa,
  matching: Matching,
  ripetizioni: number
): Promise<RisultatoProva> {
  const dettagli: string[] = []
  let coerenti = 0

  for (let rep = 0; rep < ripetizioni; rep++) {
    const slug = `F1-${rep}`
    const { idM, idP, lettore } = await setupProposta(supa, matching, slug)

    const [a, b] = await Promise.all([
      matching.confermaProposta(idP, lettore),
      matching.confermaProposta(idP, lettore),
    ])

    const okCount = [a, b].filter((x) => x.ok === true).length
    const m = await getManoscritto(supa, idM)
    const p = await getProposta(supa, idP)
    const nMatch = await contaMatchPerManoscritto(supa, idM)

    const coerente =
      okCount === 1 && nMatch === 1 && m.stato === 'matchato' && p.stato === 'confermata'
    if (coerente) coerenti++
    dettagli.push(
      `rep ${rep}: ok=${okCount} match=${nMatch} M=${m.stato} P=${p.stato} → ${coerente ? 'COERENTE' : 'INCOERENTE'}`
    )

    await neutralizzaScenario(supa, slug)
  }

  return {
    nome: 'F1 doppia_conferma_simultanea',
    descrizione:
      'Due confermaProposta() simultanee sulla stessa proposta: attesa UNA sola conferma e UN solo match.',
    ripetizioni,
    coerenti,
    dettagli,
  }
}

// ----------------------------------------------------------------------------
// F2 — ritiro e conferma simultanei.
// Atteso COERENTE: O match avvenuto O proposta chiusa, mai entrambi; M non può
// essere contemporaneamente 'ritirato' e 'matchato'.
// ----------------------------------------------------------------------------
export async function provaF2(
  supa: Supa,
  matching: Matching,
  ripetizioni: number
): Promise<RisultatoProva> {
  const dettagli: string[] = []
  let coerenti = 0

  for (let rep = 0; rep < ripetizioni; rep++) {
    const slug = `F2-${rep}`
    const { idM, idR, idP, lettore } = await setupProposta(supa, matching, slug)

    await Promise.all([
      ritiraManoscritto(supa, idM),
      matching.confermaProposta(idP, lettore),
    ])

    const m = await getManoscritto(supa, idM)
    const r = await getRichiesta(supa, idR)
    const p = await getProposta(supa, idP)
    const nMatch = await contaMatchPerManoscritto(supa, idM)

    let coerente = false
    if (m.stato === 'matchato') {
      // Match avvenuto: niente ritiro, esattamente un match, P confermata.
      coerente = nMatch === 1 && p.stato === 'confermata' && r.stato === 'matchata'
    } else if (m.stato === 'ritirato') {
      // Proposta chiusa: nessun match, P scaduta, R rimessa in coda.
      coerente = nMatch === 0 && p.stato === 'scaduta' && r.stato === 'in_attesa'
    }
    if (coerente) coerenti++
    dettagli.push(
      `rep ${rep}: M=${m.stato} R=${r.stato} P=${p.stato} match=${nMatch} → ${coerente ? 'COERENTE' : 'INCOERENTE'}`
    )

    await neutralizzaScenario(supa, slug)
  }

  return {
    nome: 'F2 ritiro_e_conferma_simultanei',
    descrizione:
      'ritiraManoscritto() e confermaProposta() simultanei: o match o proposta chiusa, mai entrambi.',
    ripetizioni,
    coerenti,
    dettagli,
  }
}

export async function eseguiConcorrenza(
  supa: Supa,
  matching: Matching,
  ripetizioni = 10
): Promise<RisultatoProva[]> {
  const f1 = await provaF1(supa, matching, ripetizioni)
  const f2 = await provaF2(supa, matching, ripetizioni)
  return [f1, f2]
}
