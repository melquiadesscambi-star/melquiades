'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'email' | 'nome' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [messsaggioInfo, setMessaggioInfo] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const inviaEmail = async () => {
    if (!email.includes('@')) {
      setErrore('Inserisci un indirizzo email valido.')
      return
    }

    setLoading(true)
    setErrore('')

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome: step === 'nome' ? nome : undefined }),
    })

    const data = await res.json()
    setLoading(false)

    if (data.nuovo_utente && step === 'email') {
      setStep('nome')
      return
    }

    if (!res.ok) {
      setErrore(data.error || 'Qualcosa è andato storto.')
      return
    }

    setStep('otp')
    setMessaggioInfo(`Abbiamo inviato un codice a ${email}. Controlla la posta.`)
  }

  const inviaOTP = async () => {
    const codice = otp.join('')
    if (codice.length < 6) {
      setErrore('Inserisci il codice completo.')
      return
    }

    setLoading(true)
    setErrore('')

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codice }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setErrore(data.error || 'Codice non valido.')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
    if (newOtp.every(d => d !== '') && index === 5) {
      setTimeout(inviaOTP, 100)
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus()
  }, [step])

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
          <Link href="/">
            <h1 className="font-serif text-4xl font-normal" style={{ color: 'var(--blu-notte)' }}>
              Melquíades
            </h1>
          </Link>
          <p className="font-serif italic mt-3 text-sm" style={{ color: 'var(--blu-grigio)' }}>
            {step === 'email' && 'Inserisci la tua email per accedere.'}
            {step === 'nome' && 'È la prima volta. Come ti chiami?'}
            {step === 'otp' && 'Controlla la tua posta.'}
          </p>
        </div>

        {/* Card con doppio bordo */}
        <div
          style={{
            border: '1px solid var(--oro)',
            padding: '2px',
          }}
        >
          <div
            style={{
              border: '1px solid color-mix(in srgb, var(--oro) 25%, transparent)',
              padding: '40px 36px',
              background: 'var(--avorio)',
            }}
          >
            {/* Step EMAIL */}
            {step === 'email' && (
              <div>
                <label className="block font-serif text-sm mb-2" style={{ color: 'var(--blu-grigio)' }}>
                  La tua email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && inviaEmail()}
                  placeholder="nome@esempio.it"
                  className="input-melquiades"
                  autoFocus
                />
                <p className="font-serif text-xs mt-3" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
                  Non serve creare un account. Ti mandiamo un codice di accesso.
                </p>
              </div>
            )}

            {/* Step NOME (nuovo utente) */}
            {step === 'nome' && (
              <div>
                <label className="block font-serif text-sm mb-2" style={{ color: 'var(--blu-grigio)' }}>
                  Email
                </label>
                <p className="font-serif mb-6" style={{ color: 'var(--blu-notte)' }}>{email}</p>

                <label className="block font-serif text-sm mb-2" style={{ color: 'var(--blu-grigio)' }}>
                  Il tuo nome
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && inviaEmail()}
                  placeholder="Come ti chiami?"
                  className="input-melquiades"
                  autoFocus
                />
                <p className="font-serif text-xs mt-3" style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}>
                  Su Melquíades si entra leggendo. Il tuo primo passo sarà fare una richiesta di lettura.
                </p>
              </div>
            )}

            {/* Step OTP */}
            {step === 'otp' && (
              <div>
                {messsaggioInfo && (
                  <p className="font-serif text-sm mb-6" style={{ color: 'var(--blu-grigio)' }}>
                    {messsaggioInfo}
                  </p>
                )}
                <label className="block font-serif text-sm mb-4" style={{ color: 'var(--blu-grigio)' }}>
                  Codice di accesso
                </label>
                <div className="flex gap-2 justify-between mb-4">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-2xl font-serif border transition-colors focus:outline-none"
                      style={{
                        background: 'transparent',
                        borderColor: digit ? 'var(--oro)' : 'color-mix(in srgb, var(--oro) 40%, transparent)',
                        color: 'var(--blu-notte)',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    setStep('email')
                    setOtp(['', '', '', '', '', ''])
                    setErrore('')
                    setMessaggioInfo('')
                  }}
                  className="font-serif text-xs"
                  style={{ color: 'var(--blu-grigio)', opacity: 0.7 }}
                >
                  ← Usa un'altra email
                </button>
              </div>
            )}

            {/* Errore */}
            {errore && (
              <p className="font-serif text-sm mt-4" style={{ color: '#8B3A3A' }}>
                {errore}
              </p>
            )}

            {/* Button */}
            {step !== 'otp' && (
              <button
                onClick={inviaEmail}
                disabled={loading || !email || (step === 'nome' && !nome)}
                className="w-full btn-primario justify-center mt-8"
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Un momento...' : step === 'email' ? 'Continua' : 'Entra in Melquíades'}
              </button>
            )}

            {step === 'otp' && (
              <button
                onClick={inviaOTP}
                disabled={loading || otp.join('').length < 6}
                className="w-full btn-primario justify-center mt-4"
                style={{ opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Verifica...' : 'Accedi'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center font-serif text-sm mt-8" style={{ color: 'var(--blu-grigio)', opacity: 0.6 }}>
          Niente editori. Niente filtri. Niente costi.
        </p>
      </div>
    </div>
  )
}
