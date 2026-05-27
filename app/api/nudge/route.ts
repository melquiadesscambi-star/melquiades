import { NextResponse } from 'next/server'
import { calcolaNudgeData } from '@/lib/nudge'

export async function GET() {
  const data = await calcolaNudgeData()
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
