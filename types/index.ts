// Tassonomia generi
export const MACRO_AREE = [
  'Narrativa',
  'Poesia',
  'Saggistica',
  'Scrittura del sé',
  'Drammaturgia',
] as const

export type MacroArea = typeof MACRO_AREE[number]

export const GENERI: Record<MacroArea, string[]> = {
  'Narrativa': [
    'Contemporanea', 'Realismo magico', 'Storica', 'Di formazione',
    'Fantasy, fiaba e fantastico', 'Horror', 'Thriller e giallo', 'Noir',
    'Romance', 'Fantascienza', 'Distopico', 'Avventura',
    'Umorismo e satira', 'Erotico', 'Sperimentale'
  ],
  'Poesia': ['Poesia in versi', 'Prosa poetica', 'Sperimentale'],
  'Saggistica': ['Critica letteraria e culturale', 'Attualità e divulgazione', 'Ricerca interiore e crescita personale'],
  'Scrittura del sé': ['Diario', 'Memoir e autobiografia', 'Lettere ed epistolario', 'Aforismi e frammenti'],
  'Drammaturgia': ['Teatro', 'Sceneggiatura'],
}

export const FASCE_PAGINE = [
  '1-50',
  '51-100',
  '101-150',
  '151-200',
  '201-300',
  'oltre 300',
] as const

export type FasciaPagine = typeof FASCE_PAGINE[number]

// Ordinamento fasce per matching
export const FASCIA_ORDINE: Record<FasciaPagine, number> = {
  '1-50': 1,
  '51-100': 2,
  '101-150': 3,
  '151-200': 4,
  '201-300': 5,
  'oltre 300': 6,
}

// Database types
export interface Utente {
  email: string
  nome: string
  data_registrazione: string
  sbloccato: boolean
}

export interface Manoscritto {
  id: string
  email_scrittore: string
  macro_area: MacroArea
  genere: string
  sottogeneri?: string[]
  fascia_pagine: FasciaPagine
  sinossi: string
  stato: 'in_attesa' | 'in_proposta' | 'matchato' | 'ritirato'
  data_registrazione: string
  id_match?: string
  is_raccolta: boolean
  is_incompiuto: boolean
  titolo?: string
  nome_scrittore?: string
}

export interface RichiestaLettura {
  id: string
  email_lettore: string
  generi_accettati: string[]
  macro_aree_accettate: MacroArea[]
  lunghezza_massima: FasciaPagine
  stato: 'in_attesa' | 'in_proposta' | 'matchata' | 'ritirata'
  data_registrazione: string
  id_match?: string
  nome_lettore?: string
}

export interface Match {
  id: string
  email_scrittore: string
  email_lettore: string
  id_manoscritto: string
  id_richiesta: string
  data_match: string
  primo_match_lettore: boolean
  nome_scrittore?: string
  nome_lettore?: string
}

export interface Proposta {
  id: string
  id_manoscritto: string
  id_richiesta: string
  email_lettore: string
  email_scrittore: string
  stato: 'in_sospeso' | 'confermata' | 'rifiutata' | 'scaduta'
  creata_il: string
  scade_il: string
  risposta_il?: string
}

export interface NudgeData {
  [macroArea: string]: {
    totale: number
    generi: Record<string, number>
  }
}

// Session
export interface SessionData {
  email: string
  nome: string
  sbloccato: boolean
}
