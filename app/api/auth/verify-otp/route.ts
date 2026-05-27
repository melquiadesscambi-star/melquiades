import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verificaOTP, creaSessione, impostaSessioneCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, codice } = await req.json()

  if (!email || !codice) {
    return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
  }

  const emailNorm = email.toLowerCase().trim()
  const valido = await verificaOTP(emailNorm, codice.trim())

  if (!valido) {
    return NextResponse.json({ error: 'Codice non valido o scaduto' }, { status: 401 })
  }

  // Recupera dati utente
  const { data: utente, error } = await supabaseAdmin
    .from('utenti')
    .select('nome, email, sbloccato')
    .eq('email', emailNorm)
    .single()

  if (error || !utente) {
    return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
  }

  // Crea e imposta sessione
  const token = await creaSessione({
    email: utente.email,
    nome: utente.nome,
    sbloccato: utente.sbloccato,
  })

  const response = NextResponse.json({
    success: true,
    utente: { email: utente.email, nome: utente.nome, sbloccato: utente.sbloccato },
  })

  response.cookies.set('melquiades_sessione', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
  })

  return response
}
