import { NextResponse } from 'next/server'
import { calcolaNudgeData } from '@/lib/nudge'

export async function GET() {
  const data = await calcolaNudgeData()
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
