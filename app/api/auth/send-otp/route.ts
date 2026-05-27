import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generaOTP, salvaOTP } from '@/lib/auth'
import { inviaOTP } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email, nome } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email non valida' }, { status: 400 })
  }

  // Controlla se l'utente esiste già
  const { data: utente } = await supabaseAdmin
    .from('utenti')
    .select('nome, email')
    .eq('email', email.toLowerCase().trim())
    .single()

  // Se nuovo utente e non ha fornito il nome, richiedilo
  if (!utente && !nome) {
    return NextResponse.json({ nuovo_utente: true }, { status: 200 })
  }

  // Se nuovo utente, crealo
  if (!utente && nome) {
    const { error } = await supabaseAdmin.from('utenti').insert({
      email: email.toLowerCase().trim(),
      nome: nome.trim(),
      sbloccato: false,
    })
    if (error) {
      return NextResponse.json({ error: 'Errore registrazione' }, { status: 500 })
    }
  }

  // Genera e invia OTP
  const otp = generaOTP()
  await salvaOTP(email.toLowerCase().trim(), otp)
  
  try {
    await inviaOTP(
      email.toLowerCase().trim(),
      otp,
      utente?.nome || nome
    )
  } catch (err) {
    console.error('Errore invio email:', err)
    // In dev, logga l'OTP
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] OTP per ${email}: ${otp}`)
    }
  }

  return NextResponse.json({ success: true })
}
