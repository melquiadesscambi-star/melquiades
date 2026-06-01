/**
 * ============================================================================
 *  BENCHMARK MATCHING — Melquíades
 * ----------------------------------------------------------------------------
 *  Benchmark permanente a TRE STRATI da rilanciare a ogni modifica della logica
 *  di matching:
 *    Strato 1 — scenari DETERMINISTICI (casi limite noti, ognuno con nome)
 *    Strato 2 — Monte Carlo MIGLIORATO (casuale ma riproducibile con seed)
 *    Strato 3 — prove di CONCORRENZA (best effort)
 *
 *  Gira in LOCALE e importa direttamente le funzioni di lib/matching.ts.
 *  ATTENZIONE: scrive sul database Supabase di PRODUZIONE. Tutti i dati creati
 *  hanno email che terminano con "@fittizio.local".
 *
 *  Avvio (dalla cartella melquiades/):
 *    npx tsx scripts/benchmark/index.ts
 *    npx tsx scripts/benchmark/index.ts --solo=scenari
 *    npx tsx scripts/benchmark/index.ts --solo=montecarlo --seed=12345 --azioni=500
 *    npx tsx scripts/benchmark/index.ts --solo=concorrenza
 *    (flag: --utenti=N --azioni=N --seed=N --force)
 *
 *  Nessun DELETE: la pulizia finale è esterna (Claude Chat via SQL).
 * ============================================================================
 */

import {
  MARKER,
  caricaEnv,
  flagNum,
  flagStr,
  hasFlag,
  chiediConferma,
  seedCasuale,
  neutralizzaScenario,
  type Supa,
  type Matching,
} from './helpers'
import { InvariantViolation, verificaInvarianti } from './invariants'
import { scenari, AssertError } from './scenarios'
import { eseguiMonteCarlo, type RisultatoMonteCarlo } from './montecarlo'
import { eseguiConcorrenza, type RisultatoProva } from './concurrency'

const SEP = '═'.repeat(72)

type Strato = 'scenari' | 'montecarlo' | 'concorrenza'

interface EsitoScenario {
  gruppo: string
  nome: string
  esito: 'PASS' | 'FAIL'
  dettaglio: string
}

async function main() {
  caricaEnv()
  const args = process.argv.slice(2)

  const solo = flagStr(args, 'solo', '') as Strato | ''
  const force = hasFlag(args, 'force')
  const utenti = Math.max(2, flagNum(args, 'utenti', 50))
  const azioni = Math.max(1, flagNum(args, 'azioni', 500))
  const seedArg = args.find((x) => x.startsWith('--seed='))
  const seed = seedArg ? flagNum(args, 'seed', seedCasuale()) >>> 0 : seedCasuale()

  const stratiDaEseguire: Strato[] =
    solo === 'scenari' || solo === 'montecarlo' || solo === 'concorrenza'
      ? [solo]
      : ['scenari', 'montecarlo', 'concorrenza']

  console.log(SEP)
  console.log('  BENCHMARK MATCHING — Melquíades')
  console.log(SEP)
  console.log(`  Strati:        ${stratiDaEseguire.join(', ')}`)
  console.log(`  Utenti (MC):   ${utenti}`)
  console.log(`  Azioni (MC):   ${azioni}`)
  console.log(`  Seed (MC):     ${seed}${seedArg ? ' (fornito)' : ' (casuale)'}`)
  console.log(`  --force:       ${force}`)
  console.log(SEP)

  // Import DINAMICI: dopo caricaEnv(), così lib/supabase legge le env corrette.
  const { supabaseAdmin } = await import('../../lib/supabase')
  const matching = await import('../../lib/matching')
  const supa = supabaseAdmin as Supa

  // ---- Controllo di sicurezza all'avvio -----------------------------------
  const { count: nonFittiziUtenti } = await supa
    .from('utenti')
    .select('*', { count: 'exact', head: true })
    .not('email', 'like', `%${MARKER}`)
  const { count: msVivi } = await supa
    .from('manoscritti')
    .select('*', { count: 'exact', head: true })
    .not('email_scrittore', 'like', `%${MARKER}`)
    .in('stato', ['in_attesa', 'in_proposta'])
  const { count: richVive } = await supa
    .from('richieste')
    .select('*', { count: 'exact', head: true })
    .not('email_lettore', 'like', `%${MARKER}`)
    .in('stato', ['in_attesa', 'in_proposta'])

  console.log('\nDati esistenti NON @fittizio.local:')
  console.log(`  Utenti non-fittizi:               ${nonFittiziUtenti ?? '?'}`)
  console.log(`  Manoscritti non-fittizi "vivi":   ${msVivi ?? '?'}`)
  console.log(`  Richieste non-fittizie "vive":    ${richVive ?? '?'}`)
  if ((msVivi ?? 0) > 0 || (richVive ?? 0) > 0) {
    console.log(
      '\n  ⚠️  ATTENZIONE: esistono manoscritti/richieste NON fittizi in stato\n' +
        '      in_attesa/in_proposta. Il matching interroga TUTTO il database e\n' +
        '      possono accoppiarsi coi dati fittizi, inquinando invarianti e FIFO.\n' +
        '      Per una corsa pulita svuota prima quelle tabelle via Claude Chat.'
    )
  }

  const procedi = await chiediConferma('\nProcedo con il benchmark?', force)
  if (!procedi) {
    console.log("Annullato dall'utente. Niente è stato scritto.")
    stampaPulizia()
    return
  }

  let esitiScenari: EsitoScenario[] | null = null
  let risMonteCarlo: RisultatoMonteCarlo | null = null
  let risConcorrenza: RisultatoProva[] | null = null

  try {
    if (stratiDaEseguire.includes('scenari')) {
      esitiScenari = await eseguiStrato1(supa, matching)
    }
    if (stratiDaEseguire.includes('montecarlo')) {
      console.log('\n[Strato 2] Monte Carlo in corso...')
      risMonteCarlo = await eseguiMonteCarlo(supa, matching, { utenti, azioni, seed })
      console.log(`  ...completato: ${risMonteCarlo.azioniTotali} azioni eseguite.`)
    }
    if (stratiDaEseguire.includes('concorrenza')) {
      console.log('\n[Strato 3] Prove di concorrenza in corso (best effort)...')
      risConcorrenza = await eseguiConcorrenza(supa, matching, 10)
      console.log('  ...completate.')
    }
  } catch (err) {
    console.error('\n💥 Errore inatteso durante il benchmark:', err)
  } finally {
    stampaReport(esitiScenari, risMonteCarlo, risConcorrenza, stratiDaEseguire)
    stampaPulizia()
  }
}

// ----------------------------------------------------------------------------
// STRATO 1 — esecuzione scenari deterministici
// ----------------------------------------------------------------------------

async function eseguiStrato1(supa: Supa, matching: Matching): Promise<EsitoScenario[]> {
  console.log('\n[Strato 1] Scenari deterministici in corso...')
  const likePrefix = `%${MARKER}`
  const orPrefix = `*${MARKER}`
  const esiti: EsitoScenario[] = []

  for (const s of scenari) {
    let esito: 'PASS' | 'FAIL' = 'PASS'
    let dettaglio = ''
    try {
      const nota = await s.run({ supa, matching })
      // Dopo OGNI scenario: tutte le 12 invarianti su tutto il dataset fittizio.
      await verificaInvarianti(supa, likePrefix, orPrefix)
      if (nota) dettaglio = nota
    } catch (err) {
      esito = 'FAIL'
      if (err instanceof AssertError) dettaglio = `assert: ${err.message}`
      else if (err instanceof InvariantViolation)
        dettaglio = `invariante #${err.numero}: ${err.descrizione} — ${err.dettagli}`
      else dettaglio = `eccezione: ${(err as Error).message}`
    } finally {
      // Neutralizzazione: porta a stato terminale le righe vive dello scenario.
      try {
        await neutralizzaScenario(supa, s.slug)
      } catch {
        /* best effort */
      }
    }
    esiti.push({ gruppo: s.gruppo, nome: s.nome, esito, dettaglio })
    console.log(`  [${esito === 'PASS' ? ' OK ' : 'FAIL'}] ${s.nome}${dettaglio && esito === 'PASS' ? `  (${dettaglio})` : ''}`)
  }
  return esiti
}

// ----------------------------------------------------------------------------
// REPORT FINALE
// ----------------------------------------------------------------------------

function stampaReport(
  esitiScenari: EsitoScenario[] | null,
  rmc: RisultatoMonteCarlo | null,
  conc: RisultatoProva[] | null,
  strati: Strato[]
): void {
  console.log('\n' + SEP)
  console.log('  REPORT FINALE')
  console.log(SEP)

  let strato1Ok = true
  let strato2Ok = true
  let strato3Ok = true

  // ---- Strato 1 ----
  if (esitiScenari) {
    const pass = esitiScenari.filter((e) => e.esito === 'PASS').length
    const tot = esitiScenari.length
    strato1Ok = pass === tot
    console.log(`\n  STRATO 1 — Scenari deterministici: ${pass}/${tot} PASS`)
    const fail = esitiScenari.filter((e) => e.esito === 'FAIL')
    if (fail.length) {
      console.log('  FAIL:')
      for (const f of fail) console.log(`    ✗ ${f.nome}\n        ${f.dettaglio}`)
    }
    // Note degli scenari PASS (es. spareggio FIFO documentato).
    const note = esitiScenari.filter((e) => e.esito === 'PASS' && e.dettaglio)
    if (note.length) {
      console.log('  Note:')
      for (const n of note) console.log(`    • ${n.nome}: ${n.dettaglio}`)
    }
  } else if (strati.includes('scenari')) {
    strato1Ok = false
    console.log('\n  STRATO 1 — non completato.')
  }

  // ---- Strato 2 ----
  if (rmc) {
    strato2Ok = rmc.violazione === null
    const conf = rmc.distribuzione['CONFERMA'] ?? 0
    const rif = rmc.distribuzione['RIFIUTA'] ?? 0
    console.log(`\n  STRATO 2 — Monte Carlo: ${rmc.azioniTotali} azioni (seed=${rmc.seed})`)
    console.log('  Distribuzione azioni:')
    for (const [k, v] of Object.entries(rmc.distribuzione).sort()) {
      console.log(`    ${k.padEnd(22)} ${v}`)
    }
    console.log(`  CONFERMA + RIFIUTA = ${conf + rif} (obiettivo > 80)`)
    if (rmc.violazione) {
      console.log(`\n  ❌ INVARIANTE ROTTA — riproduci con --seed=${rmc.seed}`)
      console.log(`  Invariante #${rmc.violazione.numero}: ${rmc.violazione.descrizione}`)
      console.log(`  Dettagli: ${rmc.violazione.dettagli}`)
      console.log('\n  Sequenza completa di azioni fino alla rottura:')
      for (const v of rmc.logAzioni) {
        console.log(
          `   [${String(v.indice).padStart(3, '0')}] ${v.utente.padEnd(26)} ${v.azione.padEnd(20)} | ${v.dettagli}`
        )
      }
    } else {
      console.log('  ✅ Tutte le 12 invarianti hanno retto.')
    }
  } else if (strati.includes('montecarlo')) {
    strato2Ok = false
    console.log('\n  STRATO 2 — non completato.')
  }

  // ---- Strato 3 ----
  if (conc) {
    console.log('\n  STRATO 3 — Concorrenza (best effort, esiti possibilmente "ballerini"):')
    for (const prova of conc) {
      const tutto = prova.coerenti === prova.ripetizioni
      if (!tutto) strato3Ok = false
      console.log(`    ${prova.nome}: ${prova.coerenti}/${prova.ripetizioni} esiti coerenti`)
      console.log(`        ${prova.descrizione}`)
      for (const d of prova.dettagli) console.log(`        ${d}`)
    }
  } else if (strati.includes('concorrenza')) {
    strato3Ok = false
    console.log('\n  STRATO 3 — non completato.')
  }

  // ---- Riga di sintesi ----
  const rilevante = {
    scenari: strati.includes('scenari') ? strato1Ok : true,
    montecarlo: strati.includes('montecarlo') ? strato2Ok : true,
    concorrenza: strati.includes('concorrenza') ? strato3Ok : true,
  }
  const superato = rilevante.scenari && rilevante.montecarlo && rilevante.concorrenza
  console.log('\n' + SEP)
  console.log(superato ? '  ✅ BENCHMARK SUPERATO' : '  ❌ BENCHMARK FALLITO')
  console.log(SEP)
}

// ----------------------------------------------------------------------------
// PULIZIA — esterna, via SQL. Nessuna DELETE nello script.
// ----------------------------------------------------------------------------

function stampaPulizia(): void {
  console.log(
    '\n[PULIZIA] Chiedi a Claude Chat di eseguire la pulizia SQL su @fittizio.local.'
  )
}

main().catch((err) => {
  console.error('\n💥 Errore fatale:', err)
  stampaPulizia()
  process.exit(1)
})
