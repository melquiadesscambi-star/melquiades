import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-lg">
        <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <h1 className="font-serif font-normal text-5xl mb-4" style={{ color: 'var(--blu-notte)' }}>
          404
        </h1>
        <p className="font-serif text-xl mb-2" style={{ color: 'var(--blu-notte)' }}>
          Questa pagina non esiste.
        </p>
        <p className="font-serif italic mb-10" style={{ color: 'var(--blu-grigio)' }}>
          Come Melquíades, è passata e non si trova più.
        </p>
        <Link href="/" className="btn-primario">
          Torna all'inizio
        </Link>
      </div>
    </div>
  )
}
