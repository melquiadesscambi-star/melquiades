# CLAUDE.md — Melquíades

Piattaforma di incontro tra scrittori con manoscritti inediti e lettori curiosi. Niente editori, niente filtri, niente costi.

---

## Stack

| Layer | Tecnologia |
|-------|-----------|
| Framework | Next.js 14, App Router, TypeScript |
| Deploy | Vercel |
| Database | Supabase (PostgreSQL) |
| Auth | OTP via email + JWT (1 anno, cookie `httpOnly`) |
| Email | Nodemailer (SMTP) |
| Stile | Tailwind CSS + variabili CSS custom in `styles/globals.css` |

---

## Variabili d'ambiente

```
NEXT_PUBLIC_SUPABASE_URL       # Project URL da Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Chiave anon/public
SUPABASE_SERVICE_ROLE_KEY      # Chiave service_role (solo server)
JWT_SECRET                     # Stringa casuale ≥32 caratteri
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
```

In sviluppo: se SMTP non è configurato, l'OTP viene loggato in console.

---

## Struttura cartelle

```
app/
  page.tsx                  # Landing page
  layout.tsx                # Layout globale + navigazione
  auth/login/               # Login OTP (email → codice 6 cifre)
  dashboard/                # Area personale utente (server component)
  lettura/                  # Form richiesta lettura + nudge badge
  manoscritto/              # Form caricamento manoscritto
  manifesto/                # Pagina manifesto editoriale
  profilo/                  # Pagina profilo utente
  admin/                    # Dashboard admin (non protetta da middleware, attenzione)
  api/
    auth/send-otp            # POST → invia OTP via email
    auth/verify-otp          # POST → verifica OTP, imposta cookie JWT
    auth/logout              # POST → cancella cookie
    manoscritti/             # POST (crea) + GET (lista)
    manoscritti/[id]/        # PATCH → ritira (stato: ritirato)
    richieste/               # POST (crea) + GET (lista)
    richieste/[id]/          # PATCH → ritira (stato: ritirata)
    match/                   # GET → match dell'utente corrente
    nudge/                   # GET → conteggi manoscritti in attesa per genere
    me/                      # GET → dati utente corrente

components/
  BottoneRitira.tsx          # Client component: ritiro con conferma inline
  ui/Logo.tsx                # Logo + separatori decorativi
  layout/Navigazione.tsx     # Barra di navigazione

lib/
  supabase.ts                # supabaseClient (browser), supabaseServer (cookie), supabaseAdmin (service role)
  auth.ts                    # leggiSessione(), creaSessione(), OTP utils
  matching.ts                # Algoritmo FIFO: trova match compatibile
  email.ts                   # Template email OTP + notifica match
  nudge.ts                   # Calcola badge conteggi per il form lettura

types/index.ts               # MACRO_AREE, GENERI, FASCE_PAGINE, tipi DB
middleware.ts                # Protegge /dashboard, /manoscritto, /lettura, /profilo
supabase/schema.sql          # Schema DB completo (eseguire una volta in Supabase SQL Editor)
```

---

## Schema DB (Supabase/PostgreSQL)

### `utenti`
| colonna | tipo | note |
|---------|------|------|
| email | TEXT PK | |
| nome | TEXT | |
| data_registrazione | TIMESTAMPTZ | |
| sbloccato | BOOLEAN | TRUE dopo il primo match come lettore |

### `manoscritti`
| colonna | tipo | note |
|---------|------|------|
| id | UUID PK | |
| email_scrittore | TEXT FK → utenti | |
| titolo | TEXT | opzionale |
| macro_area | TEXT | Narrativa / Poesia / Saggistica / Scrittura del sé / Drammaturgia |
| genere | TEXT | voce della tassonomia |
| sottogeneri | TEXT[] | fino a 2, solo per Narrativa |
| fascia_pagine | TEXT | '1-50', '51-100', '101-150', '151-200', '201-300', 'oltre 300' |
| sinossi | TEXT | |
| stato | ENUM | `in_attesa` → `matchato` oppure `ritirato` |
| is_raccolta | BOOLEAN | |
| is_incompiuto | BOOLEAN | |
| id_match | UUID | FK → match (nullable) |

### `richieste`
| colonna | tipo | note |
|---------|------|------|
| id | UUID PK | |
| email_lettore | TEXT FK → utenti | |
| generi_accettati | TEXT[] | |
| macro_aree_accettate | TEXT[] | |
| lunghezza_massima | TEXT | fascia pagine massima accettata |
| stato | ENUM | `in_attesa` → `matchata` oppure `ritirata` |
| id_match | UUID | FK → match (nullable) |

### `match`
| colonna | tipo | note |
|---------|------|------|
| id | UUID PK | |
| email_scrittore | TEXT FK → utenti | |
| email_lettore | TEXT FK → utenti | |
| id_manoscritto | UUID FK → manoscritti | |
| id_richiesta | UUID FK → richieste | |
| data_match | TIMESTAMPTZ | |
| primo_match_lettore | BOOLEAN | se TRUE → sblocca lo scrittore |

### `otp_codes`
OTP a 6 cifre, scadenza 10 minuti, chiave primaria = email (one-per-user).

---

## Regole di business

1. **Ingresso obbligatorio come lettore**: ogni utente deve prima fare una richiesta di lettura. Il caricamento di manoscritti (`sbloccato = TRUE`) si sblocca solo dopo il primo match come lettore.
2. **Matching FIFO deterministico** (in `lib/matching.ts`): scorre le richieste/manoscritti in attesa dal più vecchio al più recente; verifica che `genere ∈ generi_accettati` e `fascia_pagine ≤ lunghezza_massima` (ordine numerico in `FASCIA_ORDINE`). Nessun ML.
3. **Ritiro**: un manoscritto o una richiesta può essere ritirato solo se in stato `in_attesa`. Il PATCH su `/api/manoscritti/[id]` o `/api/richieste/[id]` verifica ownership (email sessione = email_scrittore/email_lettore) e stato prima di aggiornare.
4. **Nudge**: `GET /api/nudge` restituisce i conteggi dei manoscritti `in_attesa` per macro-area e genere. Viene chiamato una volta al caricamento del form lettura, non ad ogni interazione.
5. **Email notifiche**: le email a scrittore e lettore post-match sono manuali (il gestore riceve una notifica con tutti i dettagli e provvede).

---

## Variabili CSS (globals.css)

```css
--blu-notte     # colore primario scuro (testi, bottoni)
--blu-grigio    # colore secondario (testi secondari, bottoni ghost)
--oro           # accento dorato (badge, bordi attivi, link)
--avorio        # sfondo caldo (background principale)
```

---

## Convenzioni di codice

- **Server components** di default per le pagine; `'use client'` solo dove serve interattività (form, bottoni con stato).
- **`supabaseAdmin`** (service role) per tutte le operazioni nelle API route e nelle pagine server. Mai esporre il service role key lato client.
- **`leggiSessione()`** in ogni API route e pagina protetta — restituisce `SessionData | null`.
- Tipi DB centralizzati in `types/index.ts`; non ridefinirli inline.
- Stile: Tailwind per layout/spaziatura, variabili CSS per colori del brand. Non introdurre nuovi colori hardcoded.
- I componenti in `components/` sono riutilizzabili e non contengono logica di business.
