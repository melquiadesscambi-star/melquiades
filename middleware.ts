import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melquiades-secret-change-in-production'
)

const ROTTE_PROTETTE = ['/dashboard', '/manoscritto', '/lettura', '/profilo', '/admin']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const protetta = ROTTE_PROTETTE.some(r => pathname.startsWith(r))

  if (!protetta) return NextResponse.next()

  const token = req.cookies.get('melquiades_sessione')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  try {
    await jwtVerify(token, JWT_SECRET)
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/auth/login', req.url))
    response.cookies.delete('melquiades_sessione')
    return response
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/manoscritto/:path*', '/lettura/:path*', '/profilo/:path*', '/admin/:path*'],
}

