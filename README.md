# Melquíades

> *«Il nome dice già tutto quello che siamo.»*

Piattaforma gratuita di incontro tra scrittori con manoscritti inediti e lettori curiosi.  
Niente editori. Niente filtri. Niente costi.

---

## Stack

- **Frontend + API**: Next.js 14 (App Router) su Vercel
- **Database**: Supabase (PostgreSQL)
- **Auth**: OTP via email, sessioni JWT (1 anno)
- **Email**: Nodemailer (SMTP)

---

## Setup in 5 passi

### 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) e crea un nuovo progetto
2. Apri l'**SQL Editor** e incolla il contenuto di `supabase/schema.sql`
3. Esegui — crea tutte le tabelle, indici e funzioni necessarie

### 2. Configura le variabili d'ambiente

Copia `.env.example` in `.env.local` e compila:

```bash
cp .env.example .env.local
```

Valori da Supabase:
- `NEXT_PUBLIC_SUPABASE_URL` → Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Project Settings > API > anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` → Project Settings > API > service_role key

JWT Secret: genera una stringa casuale sicura (almeno 32 caratteri).

Email SMTP: usa Gmail con App Password, o qualsiasi provider SMTP.

### 3. Sviluppo locale

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

> **Nota sviluppo**: Se l'email non è configurata, l'OTP viene loggato nella console del server.

### 4. Deploy su Vercel

```bash
# Installa Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configura le variabili d'ambiente nel dashboard Vercel
# oppure via CLI:
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

### 5. Dominio personalizzato

Configura il dominio in Vercel Dashboard > Project > Settings > Domains.

---

## Struttura del progetto

```
melquiades/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Layout globale con navigazione
│   ├── auth/login/           # Pagina login OTP
│   ├── dashboard/            # Area personale utente
│   ├── lettura/              # Form richiesta lettura (con nudge)
│   ├── manoscritto/          # Form caricamento manoscritto
│   └── api/
│       ├── auth/             # send-otp, verify-otp, logout
│       ├── manoscritti/      # CRUD manoscritti + matching
│       ├── richieste/        # CRUD richieste + matching
│       ├── match/            # Lista match utente
│       └── nudge/            # Conteggi manoscritti in attesa
├── components/
│   ├── ui/Logo.tsx           # Logo, separatori, doppio bordo
│   └── layout/Navigazione.tsx
├── lib/
│   ├── supabase.ts           # Client Supabase (client/server/admin)
│   ├── auth.ts               # OTP, JWT, sessioni
│   ├── matching.ts           # Algoritmo di matching FIFO
│   ├── email.ts              # Template email (OTP + notifica match)
│   └── nudge.ts              # Calcolo conteggi per nudge lettore
├── types/index.ts            # Tassonomia generi + tipi DB
├── middleware.ts             # Protezione rotte
├── supabase/schema.sql       # Schema DB completo
└── .env.example
```

---

## Come funziona il matching

**Algoritmo FIFO deterministico** — nessun machine learning, solo regole chiare:

1. Arriva un nuovo manoscritto/richiesta
2. Il sistema scorre le richieste/manoscritti in attesa dal più vecchio al più recente
3. Verifica compatibilità: genere ∈ generi_accettati, fascia_pagine ≤ lunghezza_massima
4. Se trovata: crea il match, aggiorna gli stati, notifica il gestore via email
5. Se il lettore era al primo match: `sbloccato = TRUE` → può ora caricare manoscritti

**Regola di ingresso**: ogni nuovo utente entra come lettore. Prima azione obbligatoria: richiesta di lettura. Il caricamento di manoscritti si sblocca dopo il primo match.

---

## Tassonomia generi

Sei macro-aree: **Narrativa**, **Poesia**, **Saggistica**, **Scrittura del sé**, **Drammaturgia**.

Per la Narrativa: genere principale (vincolante per il match) + fino a 2 sottogeneri facoltativi (visibili nella sinossi).

Per tutte le altre: voce unica.

Flag trasversali: `is_raccolta`, `is_incompiuto`.

---

## Nudge lettore

Nel form di richiesta lettura, accanto a ogni macro-area e genere compare il numero di manoscritti attualmente in attesa (badge dorato). Una singola chiamata API al caricamento — nessuna query ad ogni click.

---

## Email post-match

Le notifiche al gestore sono automatiche. Le email a scrittore e lettore sono **manuali** nella fase iniziale — il gestore riceve tutti i dettagli nella notifica e provvede manualmente.

---

*Niente editori. Niente filtri. Niente costi.*
