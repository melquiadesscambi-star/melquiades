-- ============================================================
-- Melquíades — Schema Supabase (PostgreSQL)
-- Esegui questo SQL nell'editor SQL di Supabase
-- ============================================================

-- Abilita UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELLA: utenti
-- ============================================================
CREATE TABLE utenti (
  email TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  data_registrazione TIMESTAMPTZ DEFAULT NOW(),
  sbloccato BOOLEAN DEFAULT FALSE NOT NULL
);

-- ============================================================
-- TABELLA: otp_codes (per autenticazione)
-- ============================================================
CREATE TABLE otp_codes (
  email TEXT PRIMARY KEY,
  codice TEXT NOT NULL,
  scadenza TIMESTAMPTZ NOT NULL,
  creato_il TIMESTAMPTZ DEFAULT NOW()
);

-- Pulizia automatica OTP scaduti (via pg_cron, opzionale)
-- SELECT cron.schedule('cleanup-otp', '*/10 * * * *', 'DELETE FROM otp_codes WHERE scadenza < NOW()');

-- ============================================================
-- TABELLA: manoscritti
-- ============================================================
CREATE TYPE stato_manoscritto AS ENUM ('in_attesa', 'matchato', 'ritirato');

CREATE TABLE manoscritti (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_scrittore TEXT NOT NULL REFERENCES utenti(email),
  nome_scrittore TEXT,
  titolo TEXT,
  macro_area TEXT NOT NULL,
  genere TEXT NOT NULL,
  sottogeneri TEXT[] DEFAULT '{}',
  fascia_pagine TEXT NOT NULL,
  sinossi TEXT NOT NULL,
  stato stato_manoscritto DEFAULT 'in_attesa' NOT NULL,
  is_raccolta BOOLEAN DEFAULT FALSE,
  is_incompiuto BOOLEAN DEFAULT FALSE,
  data_registrazione TIMESTAMPTZ DEFAULT NOW(),
  id_match UUID
);

-- Indici per il matching
CREATE INDEX idx_manoscritti_stato ON manoscritti(stato);
CREATE INDEX idx_manoscritti_genere ON manoscritti(genere);
CREATE INDEX idx_manoscritti_macro_area ON manoscritti(macro_area);
CREATE INDEX idx_manoscritti_data ON manoscritti(data_registrazione);
CREATE INDEX idx_manoscritti_scrittore ON manoscritti(email_scrittore);

-- ============================================================
-- TABELLA: richieste
-- ============================================================
CREATE TYPE stato_richiesta AS ENUM ('in_attesa', 'matchata', 'ritirata');

CREATE TABLE richieste (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_lettore TEXT NOT NULL REFERENCES utenti(email),
  nome_lettore TEXT,
  generi_accettati TEXT[] NOT NULL,
  macro_aree_accettate TEXT[] DEFAULT '{}',
  lunghezza_massima TEXT NOT NULL,
  stato stato_richiesta DEFAULT 'in_attesa' NOT NULL,
  data_registrazione TIMESTAMPTZ DEFAULT NOW(),
  id_match UUID
);

-- Indici
CREATE INDEX idx_richieste_stato ON richieste(stato);
CREATE INDEX idx_richieste_data ON richieste(data_registrazione);
CREATE INDEX idx_richieste_lettore ON richieste(email_lettore);

-- ============================================================
-- TABELLA: match
-- ============================================================
CREATE TABLE match (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_scrittore TEXT NOT NULL REFERENCES utenti(email),
  email_lettore TEXT NOT NULL REFERENCES utenti(email),
  id_manoscritto UUID NOT NULL REFERENCES manoscritti(id),
  id_richiesta UUID NOT NULL REFERENCES richieste(id),
  data_match TIMESTAMPTZ DEFAULT NOW(),
  primo_match_lettore BOOLEAN DEFAULT FALSE
);

-- Indici
CREATE INDEX idx_match_scrittore ON match(email_scrittore);
CREATE INDEX idx_match_lettore ON match(email_lettore);
CREATE INDEX idx_match_data ON match(data_match);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Usiamo il service role per le operazioni — RLS è per sicurezza aggiuntiva
-- ============================================================

-- Disabilita RLS per le tabelle (usiamo service role chiave nell'app)
-- In produzione, potresti voler configurare policy specifiche

-- ============================================================
-- FUNZIONE: get_stats (per dashboard admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totale_utenti', (SELECT COUNT(*) FROM utenti),
    'utenti_sbloccati', (SELECT COUNT(*) FROM utenti WHERE sbloccato = TRUE),
    'manoscritti_in_attesa', (SELECT COUNT(*) FROM manoscritti WHERE stato = 'in_attesa'),
    'richieste_in_attesa', (SELECT COUNT(*) FROM richieste WHERE stato = 'in_attesa'),
    'match_totali', (SELECT COUNT(*) FROM match),
    'match_oggi', (SELECT COUNT(*) FROM match WHERE data_match >= CURRENT_DATE)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- NOTE DI CONFIGURAZIONE
-- ============================================================
-- 1. Dopo aver eseguito questo schema, recupera i valori:
--    - NEXT_PUBLIC_SUPABASE_URL: Project Settings > API > Project URL
--    - NEXT_PUBLIC_SUPABASE_ANON_KEY: Project Settings > API > anon/public
--    - SUPABASE_SERVICE_ROLE_KEY: Project Settings > API > service_role
--
-- 2. Configura le variabili d'ambiente in Vercel:
--    Vercel Dashboard > Project > Settings > Environment Variables
--
-- 3. Il matching avviene lato server (Next.js API routes),
--    non direttamente nel DB, per semplicità e controllo.
