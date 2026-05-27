import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// IMPORTANT: questo fallback DEVE essere identico a quello in lib/auth.ts,
// altrimenti il middleware non riesce a verificare i JWT firmati dal verify-otp
// e si crea un loop di redirect verso /auth/login.
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || '779168a8fef8387106a291b0135fa13cca139c9ee90527ab83f8556475353dfa5d2e93e5fef580bf00422ebda560176a'
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
