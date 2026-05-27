'use client'

import Link from 'next/link'

export function LogoMelquiades({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { text: 'text-xl', star: 'text-xs' },
    md: { text: 'text-3xl', star: 'text-sm' },
    lg: { text: 'text-5xl', star: 'text-base' },
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`${sizes[size].star} tracking-widest`} style={{ color: 'var(--oro)' }}>
        ✦ ✦ ✦
      </span>
      <span
        className={`${sizes[size].text} font-serif font-normal tracking-wide`}
        style={{ color: 'var(--blu-notte)' }}
      >
        Melquíades
      </span>
    </div>
  )
}

export function Separatore() {
  return (
    <div className="my-8 text-center">
      <span className="tracking-widest text-xs" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>
        ✦ ✦ ✦
      </span>
    </div>
  )
}

export function DoppioBordo({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        border: '1px solid var(--oro)',
        padding: '1px',
      }}
    >
      <div
        style={{
          border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)',
          padding: '0',
        }}
      >
        {children}
      </div>
    </div>
  )
}
