/**
 * ============================================================================
 *  scenarios.ts — STRATO 1: suite DETERMINISTICA di scenari (casi limite noti).
 * ----------------------------------------------------------------------------
 *  Ogni scenario costruisce una situazione precisa, esegue un'azione e verifica
 *  il comportamento INTESO (non "quello che fa il codice oggi"). Se il codice
 *  diverge dall'intento, l'assert FALLISCE: è esattamente ciò che il benchmark
 *  deve scoprire. Gli scenari sono isolati tra loro da email univoche
 *  (bench-<slug>-<ruolo>@fittizio.local) e dalla neutralizzazione finale.
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
  getUtente,
  propostaInSospesoDiManoscritto,
  contaMatchPerManoscritto,
  forzaScadenza,
  ritiraManoscritto,
  ritiraRichiesta,
  type Supa,
  type Matching,
} from './helpers'

export class AssertError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'AssertError'
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertError(msg)
}

export interface ScenarioCtx {
  supa: Supa
  matching: Matching
}

export interface Scenario {
  gruppo: string
  nome: string
  slug: string
  run(ctx: ScenarioCtx): Promise<string | void>
}

// Valori di tassonomia usati di frequente.
const MACRO = 'Narrativa' as const
const G1 = 'Contemporanea' // genere principale per i match
const F_MEDIA = '101-150' as const
const F_GRANDE = '151-200' as const

export const scenari: Scenario[] = [
  // ══════════════════════════════════════════════════════════════════════
  // GRUPPO A — Stati delle proposte
  // ══════════════════════════════════════════════════════════════════════
  {
    gruppo: 'A',
    nome: 'A1 ritiro_manoscritto_in_proposta',
    slug: 'A1',
    async run({ supa, matching }) {
      const S = email('A1', 'scrittore')
      const L = email('A1', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)

      const m1 = await getManoscritto(supa, M.id)
      const r1 = await getRichiesta(supa, R.id)
      const p1 = await getProposta(supa, pid)
      assert(
        m1.stato === 'in_proposta' && r1.stato === 'in_proposta' && p1.stato === 'in_sospeso',
        `setup atteso M,R in_proposta + P in_sospeso; visto M=${m1.stato} R=${r1.stato} P=${p1.stato}`
      )

      await ritiraManoscritto(supa, M.id)

      const m2 = await getManoscritto(supa, M.id)
      const r2 = await getRichiesta(supa, R.id)
      const p2 = await getProposta(supa, pid)
      assert(m2.stato === 'ritirato', `M deve essere 'ritirato', è '${m2.stato}'`)
      assert(p2.stato === 'scaduta', `P deve essere 'scaduta', è '${p2.stato}'`)
      assert(r2.stato === 'in_attesa', `R deve tornare 'in_attesa', è '${r2.stato}'`)
    },
  },
  {
    gruppo: 'A',
    nome: 'A2 ritiro_richiesta_in_proposta',
    slug: 'A2',
    async run({ supa, matching }) {
      const S = email('A2', 'scrittore')
      const L = email('A2', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)

      await ritiraRichiesta(supa, R.id)

      const m2 = await getManoscritto(supa, M.id)
      const r2 = await getRichiesta(supa, R.id)
      const p2 = await getProposta(supa, pid)
      assert(r2.stato === 'ritirata', `R deve essere 'ritirata', è '${r2.stato}'`)
      assert(p2.stato === 'scaduta', `P deve essere 'scaduta', è '${p2.stato}'`)
      assert(m2.stato === 'in_attesa', `M deve tornare 'in_attesa', è '${m2.stato}'`)
    },
  },
  {
    gruppo: 'A',
    nome: 'A3 scadenza_proposta',
    slug: 'A3',
    async run({ supa, matching }) {
      const S = email('A3', 'scrittore')
      const L = email('A3', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)
      await forzaScadenza(supa, pid)
      await matching.liberaProposteScadute()

      const m2 = await getManoscritto(supa, M.id)
      const r2 = await getRichiesta(supa, R.id)
      const p2 = await getProposta(supa, pid)
      assert(p2.stato === 'scaduta', `P deve essere 'scaduta', è '${p2.stato}'`)
      assert(m2.stato === 'in_attesa', `M deve tornare 'in_attesa', è '${m2.stato}'`)
      assert(r2.stato === 'in_attesa', `R deve tornare 'in_attesa', è '${r2.stato}'`)
    },
  },
  {
    gruppo: 'A',
    nome: 'A4 conferma_valida',
    slug: 'A4',
    async run({ supa, matching }) {
      const S = email('A4', 'scrittore')
      const L = email('A4', 'lettore')
      await creaUtente(supa, S, true)
      await creaUtente(supa, L, false) // non sbloccato ⇒ primo match come lettore
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
      const pid = await matching.apriProposta(M.id, R.id)

      const res = await matching.confermaProposta(pid, L)
      assert(res.ok === true, `conferma deve riuscire; esito=${JSON.stringify(res)}`)

      const m2 = await getManoscritto(supa, M.id)
      const r2 = await getRichiesta(supa, R.id)
      const p2 = await getProposta(supa, pid)
      const u = await getUtente(supa, L)
      const nMatch = await contaMatchPerManoscritto(supa, M.id)
      assert(p2.stato === 'confermata', `P deve essere 'confermata', è '${p2.stato}'`)
      assert(m2.stato === 'matchato', `M deve essere 'matchato', è '${m2.stato}'`)
      assert(r2.stato === 'matchata', `R deve essere 'matchata', è '${r2.stato}'`)
      assert(nMatch >= 1, `deve esistere un record in match per M (trovati ${nMatch})`)
      assert(u.sbloccato === true, `il lettore deve essere sbloccato=true dopo il primo match`)
    },
  },
  {
    gruppo: 'A',
    nome: 'A5 rifiuto_valido',
    slug: 'A5',
    async run({ supa, matching }) {
      const S = email('A5', 'scrittore')
      const L = email('A5', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)

      const res = await matching.rifiutaProposta(pid, L)
      assert(res.ok === true, `rifiuto deve riuscire; esito=${JSON.stringify(res)}`)

      const m2 = await getManoscritto(supa, M.id)
      const r2 = await getRichiesta(supa, R.id)
      const p2 = await getProposta(supa, pid)
      const u = await getUtente(supa, L)
      assert(p2.stato === 'rifiutata', `P deve essere 'rifiutata', è '${p2.stato}'`)
      assert(m2.stato === 'in_attesa', `M deve tornare 'in_attesa', è '${m2.stato}'`)
      assert(r2.stato === 'in_attesa', `R deve tornare 'in_attesa', è '${r2.stato}'`)
      assert(u.sbloccato === false, `il rifiuto NON deve sbloccare il lettore`)
    },
  },
  {
    gruppo: 'A',
    nome: 'A6 conferma_su_proposta_ritirata',
    slug: 'A6',
    async run({ supa, matching }) {
      const S = email('A6', 'scrittore')
      const L = email('A6', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)
      await ritiraManoscritto(supa, M.id) // M ritirato, P scaduta

      const res = await matching.confermaProposta(pid, L)
      assert(res.ok === false, `la conferma deve fallire; esito=${JSON.stringify(res)}`)
      if (!res.ok) {
        assert(res.status === 409, `status atteso 409, visto ${res.status}`)
        assert(res.motivo === 'ritirato', `motivo atteso 'ritirato', visto '${res.motivo}'`)
      }
    },
  },
  {
    gruppo: 'A',
    nome: 'A7 conferma_su_proposta_scaduta',
    slug: 'A7',
    async run({ supa, matching }) {
      const S = email('A7', 'scrittore')
      const L = email('A7', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)
      await forzaScadenza(supa, pid)
      await matching.liberaProposteScadute() // P scaduta, M e R in_attesa

      const res = await matching.confermaProposta(pid, L)
      assert(res.ok === false, `la conferma deve fallire; esito=${JSON.stringify(res)}`)
      if (!res.ok) {
        assert(res.status === 409, `status atteso 409, visto ${res.status}`)
        assert(res.motivo === 'scaduto', `motivo atteso 'scaduto', visto '${res.motivo}'`)
      }
    },
  },
  {
    gruppo: 'A',
    nome: 'A8 rifiuto_su_proposta_chiusa',
    slug: 'A8',
    async run({ supa, matching }) {
      const S = email('A8', 'scrittore')
      const L = email('A8', 'lettore')
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
      const pid = await matching.apriProposta(M.id, R.id)
      await forzaScadenza(supa, pid)
      await matching.liberaProposteScadute()

      const res = await matching.rifiutaProposta(pid, L)
      assert(res.ok === false, `il rifiuto deve fallire; esito=${JSON.stringify(res)}`)
      if (!res.ok) {
        assert(res.status === 409, `status atteso 409, visto ${res.status}`)
      }
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // GRUPPO B — Mai più a quel lettore
  // ══════════════════════════════════════════════════════════════════════
  {
    gruppo: 'B',
    nome: 'B1 rifiutato_non_riproposto_stesso_lettore',
    slug: 'B1',
    async run({ supa, matching }) {
      const S = email('B1', 'scrittore')
      const B = email('B1', 'lettoreB')
      await creaUtente(supa, S, true)
      await creaUtente(supa, B, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const RB = await creaRichiesta(supa, {
        email_lettore: B,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })
      const pid = await matching.apriProposta(M.id, RB.id)
      await matching.rifiutaProposta(pid, B) // M torna in_attesa, RB resta esclusa per M

      const cand = await matching.trovaCandidatoPerManoscritto(await getManoscritto(supa, M.id))
      assert(
        cand === null || cand.id !== RB.id,
        `il candidato NON deve essere la richiesta del lettore che ha già rifiutato (cand=${cand?.id})`
      )
    },
  },
  {
    gruppo: 'B',
    nome: 'B1b ma_proponibile_ad_altro',
    slug: 'B1b',
    async run({ supa, matching }) {
      const S = email('B1b', 'scrittore')
      const B = email('B1b', 'lettoreB')
      const C = email('B1b', 'lettoreC')
      await creaUtente(supa, S, true)
      await creaUtente(supa, B, false)
      await creaUtente(supa, C, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const RB = await creaRichiesta(supa, {
        email_lettore: B,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
        data_registrazione: new Date(Date.now() - 60_000).toISOString(),
      })
      const pid = await matching.apriProposta(M.id, RB.id)
      await matching.rifiutaProposta(pid, B)

      // Nuovo lettore C, richiesta compatibile (più recente di RB).
      const RC = await creaRichiesta(supa, {
        email_lettore: C,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })

      const cand = await matching.trovaCandidatoPerManoscritto(await getManoscritto(supa, M.id))
      assert(cand !== null, `deve trovare un candidato (il nuovo lettore C)`)
      assert(
        cand.id === RC.id,
        `il candidato deve essere la richiesta del nuovo lettore C (atteso ${RC.id}, visto ${cand.id})`
      )
    },
  },
  {
    gruppo: 'B',
    nome: 'B2 scaduto_non_riproposto_stesso_lettore',
    slug: 'B2',
    async run({ supa, matching }) {
      const S = email('B2', 'scrittore')
      const B = email('B2', 'lettoreB')
      await creaUtente(supa, S, true)
      await creaUtente(supa, B, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const RB = await creaRichiesta(supa, {
        email_lettore: B,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })
      const pid = await matching.apriProposta(M.id, RB.id)
      await forzaScadenza(supa, pid)
      await matching.liberaProposteScadute()

      const cand = await matching.trovaCandidatoPerManoscritto(await getManoscritto(supa, M.id))
      assert(
        cand === null || cand.id !== RB.id,
        `dopo la scadenza il candidato NON deve essere il lettore già proposto (cand=${cand?.id})`
      )
    },
  },
  {
    gruppo: 'B',
    nome: 'B3 catena_rifiuti_sempre_nuovo_lettore',
    slug: 'B3',
    async run({ supa, matching }) {
      const S = email('B3', 'scrittore')
      await creaUtente(supa, S, true)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: '1-50',
      })
      const base = Date.now()
      const ruoli = ['lettoreB', 'lettoreC', 'lettoreD']
      for (let i = 0; i < ruoli.length; i++) {
        const L = email('B3', ruoli[i])
        await creaUtente(supa, L, false)
        await creaRichiesta(supa, {
          email_lettore: L,
          generi_accettati: [G1],
          lunghezza_massima: 'oltre 300',
          data_registrazione: new Date(base + i * 1000).toISOString(),
        })
      }

      // Apri la prima proposta e poi rifiuta in catena: ogni rifiuto riapre
      // automaticamente verso il lettore successivo (re-matching interno).
      const primo = await matching.trovaCandidatoPerManoscritto(await getManoscritto(supa, M.id))
      assert(primo !== null, `deve esistere un primo candidato`)
      let pid = await matching.apriProposta(M.id, primo.id)
      const visti: string[] = [primo.email_lettore]

      while (true) {
        const p = await getProposta(supa, pid)
        if (p.stato !== 'in_sospeso') break
        await matching.rifiutaProposta(p.id, p.email_lettore)
        const nuova = await propostaInSospesoDiManoscritto(supa, M.id)
        if (!nuova) break
        visti.push(nuova.email_lettore)
        pid = nuova.id
      }

      assert(
        new Set(visti).size === visti.length,
        `ogni proposta deve andare a un lettore diverso; sequenza=[${visti.join(', ')}]`
      )
      assert(
        visti.length === 3,
        `devono esserci esattamente 3 proposte (B,C,D); sequenza=[${visti.join(', ')}]`
      )
      const finale = await matching.trovaCandidatoPerManoscritto(await getManoscritto(supa, M.id))
      assert(finale === null, `dopo i 3 rifiuti non deve esserci più alcun candidato`)
      return `catena lettori: ${visti.join(' → ')}`
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // GRUPPO C — FIFO e compatibilità
  // ══════════════════════════════════════════════════════════════════════
  {
    gruppo: 'C',
    nome: 'C1 fifo_sceglie_piu_vecchio',
    slug: 'C1',
    async run({ supa, matching }) {
      const S = email('C1', 'scrittore')
      const LV = email('C1', 'lettoreVecchio')
      const LN = email('C1', 'lettoreNuovo')
      await creaUtente(supa, S, true)
      await creaUtente(supa, LV, false)
      await creaUtente(supa, LN, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const base = Date.now()
      const Rvecchia = await creaRichiesta(supa, {
        email_lettore: LV,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
        data_registrazione: new Date(base - 60_000).toISOString(),
      })
      await creaRichiesta(supa, {
        email_lettore: LN,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
        data_registrazione: new Date(base).toISOString(),
      })

      const cand = await matching.trovaCandidatoPerManoscritto(M)
      assert(cand !== null, `deve trovare un candidato`)
      assert(
        cand.id === Rvecchia.id,
        `FIFO: deve scegliere la richiesta più vecchia (atteso ${Rvecchia.id}, visto ${cand.id})`
      )
    },
  },
  {
    gruppo: 'C',
    nome: 'C2 fifo_date_identiche_deterministico',
    slug: 'C2',
    async run({ supa, matching }) {
      const S = email('C2', 'scrittore')
      const L1 = email('C2', 'lettore1')
      const L2 = email('C2', 'lettore2')
      await creaUtente(supa, S, true)
      await creaUtente(supa, L1, false)
      await creaUtente(supa, L2, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const stessoIstante = new Date().toISOString()
      const R1 = await creaRichiesta(supa, {
        email_lettore: L1,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
        data_registrazione: stessoIstante,
      })
      const R2 = await creaRichiesta(supa, {
        email_lettore: L2,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
        data_registrazione: stessoIstante,
      })

      const scelte: string[] = []
      for (let i = 0; i < 3; i++) {
        const c = await matching.trovaCandidatoPerManoscritto(M)
        assert(c !== null, `deve sempre trovare un candidato`)
        scelte.push(c.id)
      }
      assert(
        scelte.every((s) => s === scelte[0]),
        `la scelta su date identiche deve essere stabile; viste=[${scelte.join(', ')}]`
      )
      const vincente = scelte[0] === R1.id ? 'R1' : scelte[0] === R2.id ? 'R2' : '???'
      return `date identiche → spareggio stabile su ${vincente} (${scelte[0]}); criterio emergente: ordinamento fisico/PostgREST a parità di data_registrazione`
    },
  },
  {
    gruppo: 'C',
    nome: 'C3 fascia_pagine_limite',
    slug: 'C3',
    async run({ supa, matching }) {
      const S = email('C3', 'scrittore')
      const Lok = email('C3', 'lettoreOk')
      const LkO = email('C3', 'lettoreKo')
      await creaUtente(supa, S, true)
      await creaUtente(supa, Lok, false)
      await creaUtente(supa, LkO, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: '101-150',
      })
      const base = Date.now()
      // La richiesta NON compatibile è la PIÙ VECCHIA: se il limite di fascia
      // non fosse rispettato, FIFO la sceglierebbe per prima.
      await creaRichiesta(supa, {
        email_lettore: LkO,
        generi_accettati: [G1],
        lunghezza_massima: '51-100', // < 101-150 ⇒ NON compatibile
        data_registrazione: new Date(base - 60_000).toISOString(),
      })
      const Rok = await creaRichiesta(supa, {
        email_lettore: Lok,
        generi_accettati: [G1],
        lunghezza_massima: '101-150', // == ⇒ compatibile
        data_registrazione: new Date(base).toISOString(),
      })

      const cand = await matching.trovaCandidatoPerManoscritto(M)
      assert(cand !== null, `deve trovare la richiesta compatibile`)
      assert(
        cand.id === Rok.id,
        `deve scegliere la richiesta con lunghezza_massima >= fascia del manoscritto (atteso ${Rok.id}, visto ${cand.id})`
      )
    },
  },
  {
    gruppo: 'C',
    nome: 'C4 match_via_genere_principale',
    slug: 'C4',
    async run({ supa, matching }) {
      const S = email('C4', 'scrittore')
      const L = email('C4', 'lettore')
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
        generi_accettati: [G1], // contiene il genere principale di M
        macro_aree_accettate: [], // nessuna macro-area
        lunghezza_massima: F_GRANDE,
      })

      const cand = await matching.trovaCandidatoPerManoscritto(M)
      assert(
        cand !== null && cand.id === R.id,
        `il match deve passare per il genere principale (cand=${cand?.id}, atteso ${R.id})`
      )
    },
  },
  {
    gruppo: 'C',
    nome: 'C5 match_via_macro_area',
    slug: 'C5',
    async run({ supa, matching }) {
      const S = email('C5', 'scrittore')
      const L = email('C5', 'lettore')
      await creaUtente(supa, S, true)
      await creaUtente(supa, L, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      // generi_accettati NON include il genere di M, ma macro_aree_accettate
      // include la sua macro-area. INTESO: compatibile (match via sola macro-area).
      const R = await creaRichiesta(supa, {
        email_lettore: L,
        generi_accettati: ['Noir'],
        macro_aree_accettate: [MACRO],
        lunghezza_massima: F_GRANDE,
      })

      const cand = await matching.trovaCandidatoPerManoscritto(M)
      assert(
        cand !== null && cand.id === R.id,
        `INTESO: il match deve passare anche per la sola macro-area (cand=${cand?.id}, atteso ${R.id})`
      )
    },
  },
  {
    gruppo: 'C',
    nome: 'C6 sottogeneri_non_contano',
    slug: 'C6',
    async run({ supa, matching }) {
      const S = email('C6', 'scrittore')
      const L = email('C6', 'lettore')
      await creaUtente(supa, S, true)
      await creaUtente(supa, L, false)
      // M: genere principale G1, con sottogeneri [Storica, Noir].
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        sottogeneri: ['Storica', 'Noir'],
        fascia_pagine: F_MEDIA,
      })
      // R accetta solo 'Storica' (un sottogenere di M, NON il principale) e una
      // macro-area diversa. INTESO: NON compatibile (i sottogeneri non contano).
      const R = await creaRichiesta(supa, {
        email_lettore: L,
        generi_accettati: ['Storica'],
        macro_aree_accettate: ['Poesia'],
        lunghezza_massima: F_GRANDE,
      })

      const cand = await matching.trovaCandidatoPerManoscritto(M)
      assert(
        cand === null || cand.id !== R.id,
        `INTESO: i sottogeneri di M non devono generare match (cand=${cand?.id})`
      )
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // GRUPPO D — Sblocco e ruoli
  // ══════════════════════════════════════════════════════════════════════
  {
    gruppo: 'D',
    nome: 'D1 sblocco_solo_su_conferma (apertura non sblocca)',
    slug: 'D1',
    async run({ supa, matching }) {
      const S = email('D1', 'scrittore')
      const L = email('D1', 'lettore')
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
      await matching.apriProposta(M.id, R.id)

      const u = await getUtente(supa, L)
      assert(
        u.sbloccato === false,
        `la SOLA apertura di una proposta NON deve sbloccare il lettore (sbloccato=${u.sbloccato})`
      )
    },
  },
  {
    gruppo: 'D',
    nome: 'D2 stesso_utente_lettore_e_scrittore',
    slug: 'D2',
    async run({ supa }) {
      const U = email('D2', 'utente')
      await creaUtente(supa, U, true)
      const M = await creaManoscritto(supa, {
        email_scrittore: U,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const R = await creaRichiesta(supa, {
        email_lettore: U,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })

      const m = await getManoscritto(supa, M.id)
      const r = await getRichiesta(supa, R.id)
      assert(
        m.stato === 'in_attesa' && r.stato === 'in_attesa',
        `manoscritto e richiesta dello stesso utente devono coesistere attivi (M=${m.stato} R=${r.stato})`
      )
      // Le invarianti complete vengono verificate dal runner dopo lo scenario.
    },
  },
  {
    gruppo: 'D',
    nome: 'D3 mai_proposto_a_se_stesso',
    slug: 'D3',
    async run({ supa, matching }) {
      const U = email('D3', 'utente')
      await creaUtente(supa, U, true)
      const M = await creaManoscritto(supa, {
        email_scrittore: U,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const R = await creaRichiesta(supa, {
        email_lettore: U,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })

      const cand = await matching.trovaCandidatoPerManoscritto(M)
      assert(
        cand === null || cand.id !== R.id,
        `non si deve mai proporre un manoscritto al suo stesso autore (cand=${cand?.id})`
      )
    },
  },

  // ══════════════════════════════════════════════════════════════════════
  // GRUPPO E — Unicità
  // ══════════════════════════════════════════════════════════════════════
  {
    gruppo: 'E',
    nome: 'E1 un_solo_manoscritto_in_proposta_per_proposta',
    slug: 'E1',
    async run({ supa, matching }) {
      const S = email('E1', 'scrittore')
      const L = email('E1', 'lettore')
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
      await matching.apriProposta(M.id, R.id)

      const { count } = await supa
        .from('proposte')
        .select('*', { count: 'exact', head: true })
        .eq('id_manoscritto', M.id)
        .eq('stato', 'in_sospeso')
      assert(
        count === 1,
        `un manoscritto in_proposta deve avere esattamente UNA proposta in_sospeso (trovate ${count})`
      )
    },
  },
  {
    gruppo: 'E',
    nome: 'E2 manoscritto_mai_due_proposte_aperte',
    slug: 'E2',
    async run({ supa, matching }) {
      const S = email('E2', 'scrittore')
      const L1 = email('E2', 'lettore1')
      const L2 = email('E2', 'lettore2')
      await creaUtente(supa, S, true)
      await creaUtente(supa, L1, false)
      await creaUtente(supa, L2, false)
      const M = await creaManoscritto(supa, {
        email_scrittore: S,
        macro_area: MACRO,
        genere: G1,
        fascia_pagine: F_MEDIA,
      })
      const R1 = await creaRichiesta(supa, {
        email_lettore: L1,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })
      await matching.apriProposta(M.id, R1.id) // M ⇒ in_proposta

      // Seconda richiesta compatibile: il manoscritto, ormai in_proposta, NON è
      // più eleggibile dal matching, quindi non può aprirsi una seconda proposta.
      const R2 = await creaRichiesta(supa, {
        email_lettore: L2,
        generi_accettati: [G1],
        lunghezza_massima: F_GRANDE,
      })
      const cand = await matching.trovaCandidatoPerRichiesta(R2)
      assert(
        cand === null || cand.id !== M.id,
        `un manoscritto in_proposta non deve essere eleggibile per una seconda proposta (cand=${cand?.id})`
      )

      const { count } = await supa
        .from('proposte')
        .select('*', { count: 'exact', head: true })
        .eq('id_manoscritto', M.id)
        .eq('stato', 'in_sospeso')
      assert(count === 1, `deve restare una sola proposta in_sospeso su M (trovate ${count})`)
    },
  },
]
