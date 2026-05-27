import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { supabaseAdmin } from './supabase'
import type { SessionData } from '@/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melquiades-secret-change-in-production'
)
const SESSION_COOKIE = 'melquiades_sessione'
const SESSION_DURATION_SECS = 365 * 24 * 60 * 60 // 1 anno

// Genera OTP a 6 cifre
export function generaOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Salva OTP nel DB con scadenza 10 minuti
export async function salvaOTP(email: string, otp: string): Promise<void> {
  const scadenza = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await supabaseAdmin
    .from('otp_codes')
    .upsert({ email, codice: otp, scadenza }, { onConflict: 'email' })
}

// Verifica OTP
export async function verificaOTP(email: string, codice: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('codice', codice)
    .gt('scadenza', new Date().toISOString())
    .single()

  if (error || !data) return false

  // Invalida il codice usato
  await supabaseAdmin.from('otp_codes').delete().eq('email', email)
  return true
}

// Crea sessione JWT
export async function creaSessione(session: SessionData): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(JWT_SECRET)
}

// Leggi sessione dai cookie
export async function leggiSessione(): Promise<SessionData | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      email: payload.email as string,
      nome: payload.nome as string,
      sbloccato: payload.sbloccato as boolean,
    }
  } catch {
    return null
  }
}

// Imposta cookie sessione (chiamare da API route)
export function impostaSessioneCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_SECS,
    path: '/',
  })
}

// Rimuovi sessione
export function rimuoviSessione() {
  cookies().delete(SESSION_COOKIE)
}
