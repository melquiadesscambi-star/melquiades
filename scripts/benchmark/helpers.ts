/**
 * ============================================================================
 *  helpers.ts — utilità condivise del benchmark di matching Melquíades.
 * ----------------------------------------------------------------------------
 *  Contiene:
 *   - caricamento env (PRIMA di importare lib/supabase)
 *   - parsing flag CLI
 *   - RNG riproducibile con seed (mulberry32)
 *   - creazione fixture (utenti/manoscritti/richieste) con controllo timestamp
 *   - replica ESATTA delle route di ritiro (manoscritto/richiesta)
 *   - lettura stato scoped + "neutralizzazione" (UPDATE a stato terminale)
 *
 *  REGOLA FERREA: nessun DELETE, con nessun client. L'isolamento tra scenari
 *  avviene portando le righe vive a uno stato TERMINALE (ritirato/ritirata/
 *  scaduta), che il matching ignora. La pulizia (DELETE) è esterna, via SQL.
 * ============================================================================
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import type { supabaseAdmin } from '../../lib/supabase'
import type { MacroArea, FasciaPagine } from '../../types/index'

// Tipi condivisi (import type = erasi a runtime, non leggono env).
export type Supa = typeof supabaseAdmin
export type Matching = typeof import('../../lib/matching')

export const MARKER = '@fittizio.local'

// ----------------------------------------------------------------------------
// ENV — deve avvenire PRIMA dell'import dinamico di lib/supabase.
// ----------------------------------------------------------------------------

export function caricaEnv(): void {
  const envLocal = path.resolve(process.cwd(), '.env.local')
  const env = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal })
  } else if (fs.existsSync(env)) {
    dotenv.config({ path: env })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error(
      "\n❌ Variabili d'ambiente mancanti.\n" +
        '   Servono NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in\n' +
        '   .env.local nella cartella melquiades/ (lancia il benchmark da lì).\n'
    )
    process.exit(1)
  }
}

// ----------------------------------------------------------------------------
// FLAG CLI
// ----------------------------------------------------------------------------

export function flagNum(args: string[], nome: string, def: number): number {
  const a = args.find((x) => x.startsWith(`--${nome}=`))
  if (!a) return def
  const v = parseInt(a.split('=')[1], 10)
  return Number.isFinite(v) ? v : def
}

export function flagStr(args: string[], nome: string, def: string): string {
  const a = args.find((x) => x.startsWith(`--${nome}=`))
  if (!a) return def
  return a.split('=')[1] ?? def
}

export function hasFlag(args: string[], nome: string): boolean {
  return args.includes(`--${nome}`)
}

// ----------------------------------------------------------------------------
// RNG RIPRODUCIBILE (mulberry32) — stesso seed ⇒ stessa sequenza.
// ----------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next: () => number
  constructor(public readonly seed: number) {
    this.next = mulberry32(seed)
  }
  float(): number {
    return this.next()
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)]
  }
  subset<T>(arr: readonly T[], min: number, max: number): T[] {
    const n = this.int(min, Math.min(max, arr.length))
    const copia = [...arr]
    const out: T[] = []
    for (let i = 0; i < n; i++) {
      const idx = this.int(0, copia.length - 1)
      out.push(copia.splice(idx, 1)[0])
    }
    return out
  }
  // Selezione pesata: items con peso > 0; ritorna l'elemento scelto.
  weighted<T>(items: { item: T; peso: number }[]): T {
    const tot = items.reduce((s, x) => s + x.peso, 0)
    let r = this.float() * tot
    for (const x of items) {
      r -= x.peso
      if (r <= 0) return x.item
    }
    return items[items.length - 1].item
  }
}

export function seedCasuale(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
}

// ----------------------------------------------------------------------------
// PROMPT
// ----------------------------------------------------------------------------

export async function chiediConferma(domanda: string, force: boolean): Promise<boolean> {
  if (force) return true
  const rl = readline.createInterface({ input, output })
  try {
    const r = (await rl.question(`${domanda} [y/n] `)).trim().toLowerCase()
    return r === 'y' || r === 'yes' || r === 's' || r === 'si'
  } finally {
    rl.close()
  }
}

// ----------------------------------------------------------------------------
// EMAIL SCOPING
// ----------------------------------------------------------------------------

// Email univoca per scenario+ruolo: bench-<slug>-<ruolo>@fittizio.local
export function email(slug: string, ruolo: string): string {
  return `bench-${slug}-${ruolo}${MARKER}`
}

// ----------------------------------------------------------------------------
// FIXTURE — insert diretti, con timestamp controllabile per i test FIFO.
// ----------------------------------------------------------------------------

export async function creaUtente(
  supa: Supa,
  emailUtente: string,
  sbloccato: boolean,
  nome?: string
): Promise<void> {
  // upsert sull'email (PK) ⇒ rerun-safe e resetta `sbloccato` allo stato voluto.
  const { error } = await supa
    .from('utenti')
    .upsert(
      { email: emailUtente, nome: nome ?? `Utente ${emailUtente}`, sbloccato },
      { onConflict: 'email' }
    )
  if (error) throw new Error(`creaUtente(${emailUtente}): ${error.message}`)
}

export interface OpzManoscritto {
  email_scrittore: string
  macro_area: MacroArea
  genere: string
  fascia_pagine: FasciaPagine
  sottogeneri?: string[]
  data_registrazione?: string
  stato?: string
}

export async function creaManoscritto(supa: Supa, o: OpzManoscritto): Promise<any> {
  const row: Record<string, unknown> = {
    email_scrittore: o.email_scrittore,
    nome_scrittore: `Utente ${o.email_scrittore}`,
    titolo: `Titolo ${o.genere}`,
    macro_area: o.macro_area,
    genere: o.genere,
    sottogeneri: o.sottogeneri ?? [],
    fascia_pagine: o.fascia_pagine,
    sinossi: 'Sinossi di prova generata dal benchmark.',
    is_raccolta: false,
    is_incompiuto: false,
    stato: o.stato ?? 'in_attesa',
  }
  if (o.data_registrazione) row.data_registrazione = o.data_registrazione
  const { data, error } = await supa.from('manoscritti').insert(row).select().single()
  if (error || !data) throw new Error(`creaManoscritto: ${error?.message}`)
  return data
}

export interface OpzRichiesta {
  email_lettore: string
  generi_accettati: string[]
  lunghezza_massima: FasciaPagine
  macro_aree_accettate?: MacroArea[]
  data_registrazione?: string
  stato?: string
}

export async function creaRichiesta(supa: Supa, o: OpzRichiesta): Promise<any> {
  const row: Record<string, unknown> = {
    email_lettore: o.email_lettore,
    nome_lettore: `Utente ${o.email_lettore}`,
    generi_accettati: o.generi_accettati,
    macro_aree_accettate: o.macro_aree_accettate ?? [],
    lunghezza_massima: o.lunghezza_massima,
    stato: o.stato ?? 'in_attesa',
  }
  if (o.data_registrazione) row.data_registrazione = o.data_registrazione
  const { data, error } = await supa.from('richieste').insert(row).select().single()
  if (error || !data) throw new Error(`creaRichiesta: ${error?.message}`)
  return data
}

// ----------------------------------------------------------------------------
// LETTORI DI STATO PUNTUALE
// ----------------------------------------------------------------------------

export async function getManoscritto(supa: Supa, id: string): Promise<any> {
  const { data } = await supa.from('manoscritti').select('*').eq('id', id).single()
  return data
}
export async function getRichiesta(supa: Supa, id: string): Promise<any> {
  const { data } = await supa.from('richieste').select('*').eq('id', id).single()
  return data
}
export async function getProposta(supa: Supa, id: string): Promise<any> {
  const { data } = await supa.from('proposte').select('*').eq('id', id).single()
  return data
}
export async function getUtente(supa: Supa, emailUtente: string): Promise<any> {
  const { data } = await supa.from('utenti').select('*').eq('email', emailUtente).single()
  return data
}

// Proposta in_sospeso (l'unica, se esiste) per un manoscritto.
export async function propostaInSospesoDiManoscritto(supa: Supa, idM: string): Promise<any> {
  const { data } = await supa
    .from('proposte')
    .select('*')
    .eq('id_manoscritto', idM)
    .eq('stato', 'in_sospeso')
    .maybeSingle()
  return data
}

// Quante righe in `match` esistono per un dato manoscritto.
export async function contaMatchPerManoscritto(supa: Supa, idM: string): Promise<number> {
  const { count } = await supa
    .from('match')
    .select('*', { count: 'exact', head: true })
    .eq('id_manoscritto', idM)
  return count ?? 0
}

// Forza la scadenza di una proposta spostando scade_il nel passato.
export async function forzaScadenza(supa: Supa, idProposta: string): Promise<void> {
  const passato = new Date(Date.now() - 1000 * 60 * 60).toISOString()
  await supa.from('proposte').update({ scade_il: passato }).eq('id', idProposta)
}

// ----------------------------------------------------------------------------
// RITIRO — replica ESATTA delle route PATCH.
// ----------------------------------------------------------------------------

// Replica app/api/manoscritti/[id]/route.ts.
export async function ritiraManoscritto(supa: Supa, id: string): Promise<void> {
  const { data: manoscritto } = await supa
    .from('manoscritti')
    .select('email_scrittore, stato')
    .eq('id', id)
    .single()
  if (!manoscritto) return
  if (!['in_attesa', 'in_proposta'].includes(manoscritto.stato)) return

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

// Replica app/api/richieste/[id]/route.ts.
export async function ritiraRichiesta(supa: Supa, id: string): Promise<void> {
  const { data: richiesta } = await supa
    .from('richieste')
    .select('email_lettore, stato')
    .eq('id', id)
    .single()
  if (!richiesta) return
  if (!['in_attesa', 'in_proposta'].includes(richiesta.stato)) return

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

// ----------------------------------------------------------------------------
// NEUTRALIZZAZIONE — porta le righe vive a stato TERMINALE (niente DELETE).
// ----------------------------------------------------------------------------

// likePat usa il wildcard SQL `%`; orPat usa il wildcard PostgREST `*`.
export async function neutralizzaPerLike(
  supa: Supa,
  likePat: string,
  orPat: string
): Promise<void> {
  await supa
    .from('manoscritti')
    .update({ stato: 'ritirato' })
    .like('email_scrittore', likePat)
    .in('stato', ['in_attesa', 'in_proposta'])
  await supa
    .from('richieste')
    .update({ stato: 'ritirata' })
    .like('email_lettore', likePat)
    .in('stato', ['in_attesa', 'in_proposta'])
  await supa
    .from('proposte')
    .update({ stato: 'scaduta', risposta_il: new Date().toISOString() })
    .or(`email_lettore.like.${orPat},email_scrittore.like.${orPat}`)
    .eq('stato', 'in_sospeso')
}

// Neutralizza tutte le righe vive di uno scenario (prefisso bench-<slug>-).
export async function neutralizzaScenario(supa: Supa, slug: string): Promise<void> {
  await neutralizzaPerLike(supa, `bench-${slug}-%${MARKER}`, `bench-${slug}-*`)
}

// ----------------------------------------------------------------------------
// LETTURA STATO (scoped) — usata dal Monte Carlo.
// ----------------------------------------------------------------------------

export interface UtenteRow {
  email: string
  sbloccato: boolean
}
export interface StatoSequenza {
  utenti: UtenteRow[]
  manoscritti: any[]
  richieste: any[]
  proposte: any[]
  proposteInSospeso: any[]
}

export async function leggiStato(
  supa: Supa,
  likePrefix: string,
  orPrefix: string
): Promise<StatoSequenza> {
  const [utenti, manoscritti, richieste, proposte] = await Promise.all([
    supa.from('utenti').select('*').like('email', likePrefix),
    supa.from('manoscritti').select('*').like('email_scrittore', likePrefix),
    supa.from('richieste').select('*').like('email_lettore', likePrefix),
    supa
      .from('proposte')
      .select('*')
      .or(`email_lettore.like.${orPrefix},email_scrittore.like.${orPrefix}`),
  ])

  const props = proposte.data ?? []
  return {
    utenti: utenti.data ?? [],
    manoscritti: manoscritti.data ?? [],
    richieste: richieste.data ?? [],
    proposte: props,
    proposteInSospeso: props.filter((p: any) => p.stato === 'in_sospeso'),
  }
}

export function haRichiestaAttiva(emailUtente: string, stato: StatoSequenza): boolean {
  return stato.richieste.some(
    (r) => r.email_lettore === emailUtente && (r.stato === 'in_attesa' || r.stato === 'in_proposta')
  )
}
export function haManoscrittoAttivo(emailUtente: string, stato: StatoSequenza): boolean {
  return stato.manoscritti.some(
    (m) =>
      m.email_scrittore === emailUtente && (m.stato === 'in_attesa' || m.stato === 'in_proposta')
  )
}
