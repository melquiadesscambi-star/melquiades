import { NextRequest, NextResponse } from 'next/server'
import { liberaProposteScadute } from '@/lib/matching'

/**
 * GET /api/cron/scadenze
 * Chiamata ogni notte a mezzanotte UTC da Vercel Cron.
 * Cerca tutte le proposte in_sospeso scadute, le libera e rilancia il matching.
 * Protetta da CRON_SECRET (env var su Vercel).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  try {
    const { elaborate, errori } = await liberaProposteScadute()
    console.log(`[cron/scadenze] Proposte elaborate: ${elaborate}, errori: ${errori}`)
    return NextResponse.json({ ok: true, elaborate, errori })
  } catch (err) {
    console.error('[cron/scadenze] Errore generale:', err)
    return NextResponse.json({ ok: false, error: 'Errore interno' }, { status: 500 })
  }
}
