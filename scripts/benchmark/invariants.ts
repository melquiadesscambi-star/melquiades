/**
 * ============================================================================
 *  invariants.ts — le 12 invarianti della logica di matching + il check FIFO.
 * ----------------------------------------------------------------------------
 *  Riuso fedele della logica del vecchio stress-test-matching.ts. Le invarianti
 *  sono verificate dopo OGNI azione/scenario su tutto il dataset @fittizio.local.
 *  Se una si rompe viene lanciata una InvariantViolation con il dettaglio.
 * ============================================================================
 */

import { FASCIA_ORDINE } from '../../types/index'
import type { FasciaPagine } from '../../types/index'
import type { Supa } from './helpers'

export class InvariantViolation extends Error {
  constructor(
    public numero: number,
    public descrizione: string,
    public dettagli: string
  ) {
    super(`Invariante #${numero} violata: ${descrizione}`)
    this.name = 'InvariantViolation'
  }
}

// Compatibilità: genere principale del manoscritto ∈ generi_accettati OPPURE
// macro_area del manoscritto ∈ macro_aree_accettate; e fascia ≤ lunghezza_massima.
export function compatibile(m: any, r: any): boolean {
  const genereOk =
    (r.generi_accettati?.includes(m.genere) ?? false) ||
    (r.macro_aree_accettate?.includes(m.macro_area) ?? false)
  const lunghezzaOk =
    FASCIA_ORDINE[m.fascia_pagine as FasciaPagine] <=
    FASCIA_ORDINE[r.lunghezza_massima as FasciaPagine]
  return genereOk && lunghezzaOk
}

/**
 * Ricalcola in modo INDIPENDENTE il candidato più vecchio compatibile e
 * verifica che quello effettivamente scelto sia il più vecchio (per
 * data_registrazione). Replica le STESSE esclusioni della logica reale:
 *  - mai sé stessi (scrittore ≠ lettore);
 *  - mai una coppia (manoscritto, lettore) già proposta in passato.
 * Confronta sul minimo della data per essere robusto agli ex-aequo.
 */
export async function verificaFIFO(
  supa: Supa,
  lato: 'manoscritto' | 'richiesta',
  manoscritto: any,
  richiesta: any
): Promise<void> {
  let pool: any[]
  let scelto: any

  if (lato === 'manoscritto') {
    const { data: proposteEsistenti } = await supa
      .from('proposte')
      .select('email_lettore')
      .eq('id_manoscritto', manoscritto.id)
    const lettoriEsclusi = new Set((proposteEsistenti ?? []).map((p: any) => p.email_lettore))

    const { data } = await supa.from('richieste').select('*').eq('stato', 'in_attesa')
    pool = (data ?? []).filter(
      (r: any) =>
        r.email_lettore !== manoscritto.email_scrittore &&
        !lettoriEsclusi.has(r.email_lettore) &&
        compatibile(manoscritto, r)
    )
    scelto = richiesta
  } else {
    const { data: proposteEsistenti } = await supa
      .from('proposte')
      .select('id_manoscritto')
      .eq('email_lettore', richiesta.email_lettore)
    const manoscrittiEsclusi = new Set(
      (proposteEsistenti ?? []).map((p: any) => p.id_manoscritto)
    )

    const { data } = await supa.from('manoscritti').select('*').eq('stato', 'in_attesa')
    pool = (data ?? []).filter(
      (m: any) =>
        m.email_scrittore !== richiesta.email_lettore &&
        !manoscrittiEsclusi.has(m.id) &&
        compatibile(m, richiesta)
    )
    scelto = manoscritto
  }

  if (pool.length === 0) return

  const minData = pool.reduce(
    (acc, x) => (x.data_registrazione < acc ? x.data_registrazione : acc),
    pool[0].data_registrazione
  )

  if (scelto.data_registrazione !== minData) {
    throw new InvariantViolation(
      12,
      'FIFO: il candidato scelto non è il più vecchio compatibile disponibile',
      `lato=${lato}, scelto.id=${scelto.id} (data=${scelto.data_registrazione}), ` +
        `min disponibile=${minData}, pool=${pool
          .map((x) => `${x.id}@${x.data_registrazione}`)
          .join(' ; ')}`
    )
  }
}

// ----------------------------------------------------------------------------
// INVARIANTI 1–11 — verificate su tutto il dataset @fittizio.local.
// ----------------------------------------------------------------------------

export async function verificaInvarianti(
  supa: Supa,
  likePrefix: string,
  orPrefix: string
): Promise<void> {
  const [uRes, mRes, rRes, pRes, maRes] = await Promise.all([
    supa.from('utenti').select('*').like('email', likePrefix),
    supa.from('manoscritti').select('*').like('email_scrittore', likePrefix),
    supa.from('richieste').select('*').like('email_lettore', likePrefix),
    supa
      .from('proposte')
      .select('*')
      .or(`email_lettore.like.${orPrefix},email_scrittore.like.${orPrefix}`),
    supa
      .from('match')
      .select('*')
      .or(`email_lettore.like.${orPrefix},email_scrittore.like.${orPrefix}`),
  ])

  const U: any[] = uRes.data ?? []
  const M: any[] = mRes.data ?? []
  const R: any[] = rRes.data ?? []
  const P: any[] = pRes.data ?? []
  const MA: any[] = maRes.data ?? []

  const mById = new Map<string, any>(M.map((m) => [m.id, m]))
  const rById = new Map<string, any>(R.map((r) => [r.id, r]))
  const uByEmail = new Map<string, any>(U.map((u) => [u.email, u]))

  const getM = async (id: string) => {
    if (mById.has(id)) return mById.get(id)
    const { data } = await supa.from('manoscritti').select('*').eq('id', id).single()
    return data
  }
  const getR = async (id: string) => {
    if (rById.has(id)) return rById.get(id)
    const { data } = await supa.from('richieste').select('*').eq('id', id).single()
    return data
  }

  const inSospeso = P.filter((p) => p.stato === 'in_sospeso')

  // 1 — ogni manoscritto in_proposta ha ESATTAMENTE una proposta in_sospeso.
  for (const m of M) {
    if (m.stato === 'in_proposta') {
      const n = inSospeso.filter((p) => p.id_manoscritto === m.id).length
      if (n !== 1) {
        throw new InvariantViolation(
          1,
          'Manoscritto in_proposta deve avere esattamente UNA proposta in_sospeso',
          `manoscritto=${m.id} ha ${n} proposte in_sospeso`
        )
      }
    }
  }

  // 2 — ogni proposta in_sospeso punta a manoscritto E richiesta in_proposta.
  for (const p of inSospeso) {
    const m = await getM(p.id_manoscritto)
    const r = await getR(p.id_richiesta)
    if (!m || m.stato !== 'in_proposta') {
      throw new InvariantViolation(
        2,
        'Proposta in_sospeso deve puntare a un manoscritto in stato in_proposta',
        `proposta=${p.id}, manoscritto=${p.id_manoscritto} stato=${m ? m.stato : 'INESISTENTE'}`
      )
    }
    if (!r || r.stato !== 'in_proposta') {
      throw new InvariantViolation(
        2,
        'Proposta in_sospeso deve puntare a una richiesta in stato in_proposta',
        `proposta=${p.id}, richiesta=${p.id_richiesta} stato=${r ? r.stato : 'INESISTENTE'}`
      )
    }
  }

  // 3 — ogni manoscritto matchato ha record in `match` E proposta confermata.
  for (const m of M) {
    if (m.stato === 'matchato') {
      const haMatch = MA.some((x) => x.id_manoscritto === m.id)
      const haConf = P.some((p) => p.id_manoscritto === m.id && p.stato === 'confermata')
      if (!haMatch || !haConf) {
        throw new InvariantViolation(
          3,
          'Manoscritto matchato deve avere record match + proposta confermata',
          `manoscritto=${m.id} haMatch=${haMatch} haPropostaConfermata=${haConf}`
        )
      }
    }
  }

  // 4 — in_proposta ⟺ esiste proposta in_sospeso (manoscritti e richieste).
  for (const m of M) {
    const has = inSospeso.some((p) => p.id_manoscritto === m.id)
    if ((m.stato === 'in_proposta') !== has) {
      throw new InvariantViolation(
        4,
        'Manoscritto: in_proposta ⟺ esiste proposta in_sospeso',
        `manoscritto=${m.id} stato=${m.stato} haPropostaInSospeso=${has}`
      )
    }
  }
  for (const r of R) {
    const has = inSospeso.some((p) => p.id_richiesta === r.id)
    if ((r.stato === 'in_proposta') !== has) {
      throw new InvariantViolation(
        4,
        'Richiesta: in_proposta ⟺ esiste proposta in_sospeso',
        `richiesta=${r.id} stato=${r.stato} haPropostaInSospeso=${has}`
      )
    }
  }

  // 5 — stesso manoscritto mai in due proposte diverse con lo stesso lettore.
  {
    const visti = new Map<string, string>()
    for (const p of P) {
      const k = `${p.id_manoscritto}|${p.email_lettore}`
      if (visti.has(k)) {
        throw new InvariantViolation(
          5,
          'Stesso manoscritto proposto due volte allo stesso lettore',
          `manoscritto=${p.id_manoscritto} lettore=${p.email_lettore} proposte=${visti.get(k)} , ${p.id}`
        )
      }
      visti.set(k, p.id)
    }
  }

  // 6 — nessuna proposta con email_lettore == email_scrittore.
  for (const p of P) {
    if (p.email_lettore === p.email_scrittore) {
      throw new InvariantViolation(
        6,
        'Proposta con lettore == scrittore (proporre a sé stessi)',
        `proposta=${p.id} email=${p.email_lettore}`
      )
    }
  }

  // 7 — nessun utente sbloccato=false possiede un manoscritto attivo/matchato.
  for (const m of M) {
    if (['in_attesa', 'in_proposta', 'matchato'].includes(m.stato)) {
      const u = uByEmail.get(m.email_scrittore)
      if (u && u.sbloccato === false) {
        throw new InvariantViolation(
          7,
          'Utente non sbloccato possiede un manoscritto attivo/matchato',
          `manoscritto=${m.id} stato=${m.stato} utente=${m.email_scrittore} sbloccato=false`
        )
      }
    }
  }

  // 8 — compatibilità di ogni proposta in_sospeso/confermata.
  for (const p of P) {
    if (p.stato === 'in_sospeso' || p.stato === 'confermata') {
      const m = await getM(p.id_manoscritto)
      const r = await getR(p.id_richiesta)
      if (m && r && !compatibile(m, r)) {
        throw new InvariantViolation(
          8,
          'Proposta viva/confermata su coppia NON compatibile',
          `proposta=${p.id} ms(${m.genere}/${m.macro_area}/${m.fascia_pagine}) ric(generi=[${r.generi_accettati}] macro=[${r.macro_aree_accettate}] max=${r.lunghezza_massima})`
        )
      }
    }
  }

  // 9 — max 1 manoscritto attivo e max 1 richiesta attiva per utente.
  {
    const cM = new Map<string, number>()
    for (const m of M) {
      if (m.stato === 'in_attesa' || m.stato === 'in_proposta') {
        cM.set(m.email_scrittore, (cM.get(m.email_scrittore) ?? 0) + 1)
      }
    }
    for (const [e, n] of cM) {
      if (n > 1) {
        throw new InvariantViolation(
          9,
          'Utente con più di un manoscritto attivo',
          `utente=${e} manoscritti_attivi=${n}`
        )
      }
    }
    const cR = new Map<string, number>()
    for (const r of R) {
      if (r.stato === 'in_attesa' || r.stato === 'in_proposta') {
        cR.set(r.email_lettore, (cR.get(r.email_lettore) ?? 0) + 1)
      }
    }
    for (const [e, n] of cR) {
      if (n > 1) {
        throw new InvariantViolation(
          9,
          'Utente con più di una richiesta attiva',
          `utente=${e} richieste_attive=${n}`
        )
      }
    }
  }

  // 10 — nessun manoscritto matchato a 2 lettori; nessuna richiesta a 2 ms.
  {
    const perMs = new Map<string, Set<string>>()
    const perRic = new Map<string, Set<string>>()
    for (const x of MA) {
      if (!perMs.has(x.id_manoscritto)) perMs.set(x.id_manoscritto, new Set())
      perMs.get(x.id_manoscritto)!.add(x.email_lettore)
      if (!perRic.has(x.id_richiesta)) perRic.set(x.id_richiesta, new Set())
      perRic.get(x.id_richiesta)!.add(x.id_manoscritto)
    }
    for (const [ms, lettori] of perMs) {
      if (lettori.size > 1) {
        throw new InvariantViolation(
          10,
          'Manoscritto matchato a più lettori diversi',
          `manoscritto=${ms} lettori=[${[...lettori].join(',')}]`
        )
      }
    }
    for (const [ric, ms] of perRic) {
      if (ms.size > 1) {
        throw new InvariantViolation(
          10,
          'Richiesta matchata a più manoscritti diversi',
          `richiesta=${ric} manoscritti=[${[...ms].join(',')}]`
        )
      }
    }
  }

  // 11 — ogni proposta scaduta/rifiutata ha ms e richiesta NON più in_proposta,
  //      a meno che non siano stati riabbinati a una NUOVA proposta in_sospeso.
  for (const p of P) {
    if (p.stato === 'scaduta' || p.stato === 'rifiutata') {
      const m = await getM(p.id_manoscritto)
      if (m && m.stato === 'in_proposta' && !inSospeso.some((x) => x.id_manoscritto === m.id)) {
        throw new InvariantViolation(
          11,
          'Manoscritto "appeso" in_proposta dopo proposta non più in_sospeso',
          `proposta=${p.id} (${p.stato}) manoscritto=${m.id} in_proposta senza proposta viva`
        )
      }
      const r = await getR(p.id_richiesta)
      if (r && r.stato === 'in_proposta' && !inSospeso.some((x) => x.id_richiesta === r.id)) {
        throw new InvariantViolation(
          11,
          'Richiesta "appesa" in_proposta dopo proposta non più in_sospeso',
          `proposta=${p.id} (${p.stato}) richiesta=${r.id} in_proposta senza proposta viva`
        )
      }
    }
  }
}
