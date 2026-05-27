import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { supabaseAdmin } from './supabase'
import type { SessionData } from '@/types'

const JWT_SECRET_VALUE = process.env.JWT_SECRET || '779168a8fef8387106a291b0135fa13cca139c9ee90527ab83f8556475353dfa5d2e93e5fef580bf00422ebda560176a'
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_VALUE)
const SESSION_COOKIE = 'melquiades_sessione'

export function generaOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function salvaOTP(email: string, otp: string): Promise<void> {
  const scadenza = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  await supabaseAdmin
    .from('otp_codes')
    .upsert({ email, codice: otp, scadenza }, { onConflict: 'email' })
}

export async function verificaOTP(email: string, codice: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('codice', codice)
    .gt('scadenza', new Date().toISOString())
    .single()

  if (error || !data) return false
  await supabaseAdmin.from('otp_codes').delete().eq('email', email)
  return true
}

export async function creaSessione(session: SessionData): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1y')
    .sign(JWT_SECRET)
}

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

export function rimuoviSessione() {
  cookies().delete(SESSION_COOKIE)
}
