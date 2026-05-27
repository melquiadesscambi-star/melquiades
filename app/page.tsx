import Link from 'next/link'
import { leggiSessione } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const sessione = await leggiSessione()
  if (sessione) redirect('/dashboard')

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        {/* Decorazione superiore */}
        <div className="mb-12 animate-fade-in">
          <div
            className="inline-block px-8 py-3 mb-8"
            style={{
              border: '1px solid var(--oro)',
              boxShadow: 'inset 0 0 0 3px var(--avorio), inset 0 0 0 4px color-mix(in srgb, var(--oro) 30%, transparent)',
            }}
          >
            <span className="font-serif italic text-sm" style={{ color: 'var(--blu-grigio)' }}>
              Manoscritti inediti cercano lettori
            </span>
          </div>

          <h1 className="font-serif font-normal mb-6" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', lineHeight: '1.1', color: 'var(--blu-notte)' }}>
            Ci sono parole che<br />
            <em>cercano uno sguardo</em>
          </h1>

          <div className="my-8">
            <span className="tracking-widest text-sm" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</span>
          </div>

          <p className="font-serif text-xl leading-relaxed max-w-2xl mx-auto mb-4" style={{ color: 'var(--blu-grigio)' }}>
            Hai scritto qualcosa che non ha mai letto nessuno? O vorresti leggere qualcosa che non troverai mai in libreria?
          </p>
          <p className="font-serif text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--blu-notte)' }}>
            Melquíades è il posto dove questi due incontri finalmente avvengono.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12 animate-fade-up" style={{ animationDelay: '200ms', opacity: 0, animationFillMode: 'forwards' }}>
          <Link href="/auth/login" className="btn-primario">
            Entra nella piattaforma
          </Link>
          <a href="#come-funziona" className="btn-secondario">
            Scopri come funziona
          </a>
        </div>
      </section>

      {/* Decorazione visiva - linea oro */}
      <div className="max-w-4xl mx-auto px-6">
        <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, var(--oro), transparent)' }} />
      </div>

      {/* Come funziona */}
      <section id="come-funziona" className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="font-serif font-normal text-3xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            Come funziona
          </h2>
          <span className="tracking-widest text-xs" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</span>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              n: '01',
              titolo: 'Entri come lettore',
              testo: 'Su Melquíades si entra leggendo. Il primo passo è indicare che tipo di testi vorresti leggere — genere, lunghezza — e aspettare che il sistema trovi una corrispondenza.',
            },
            {
              n: '02',
              titolo: 'Il sistema trova la corrispondenza',
              testo: 'Quando tra i manoscritti in attesa ce n\'è uno compatibile con la tua richiesta, il sistema scambia i contatti in entrambe le direzioni. Senza intermediari.',
            },
            {
              n: '03',
              titolo: 'Da quel momento, siete liberi',
              testo: 'La piattaforma esce di scena. Non ospita i testi, non monitora le letture, non chiede feedback. Lo scrittore ti manda il manoscritto come preferisce.',
            },
          ].map((step) => (
            <div key={step.n} className="relative">
              <div
                className="text-6xl font-serif font-normal mb-4"
                style={{ color: 'color-mix(in srgb, var(--oro) 25%, transparent)' }}
              >
                {step.n}
              </div>
              <h3 className="font-serif text-xl mb-3" style={{ color: 'var(--blu-notte)' }}>
                {step.titolo}
              </h3>
              <p className="font-serif leading-relaxed" style={{ color: 'var(--blu-grigio)' }}>
                {step.testo}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Sezione filosofia */}
      <section
        className="py-20 px-6"
        style={{ background: 'var(--blu-notte)' }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <p className="font-serif italic text-2xl leading-relaxed mb-8" style={{ color: 'var(--avorio)' }}>
            «Melquíades è il personaggio di Cent'anni di solitudine di García Márquez: lo straniero che percorre il mondo portando conoscenza rara, la consegna a chi sa cosa farsene, e poi scompare.»
          </p>
          <span className="tracking-widest text-xs" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</span>
          <p className="font-serif mt-6 text-lg" style={{ color: 'var(--blu-grigio)' }}>
            Niente editori. Niente filtri. Niente costi.
          </p>
        </div>
      </section>

      {/* Generi */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="font-serif font-normal text-3xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            Cosa puoi leggere
          </h2>
          <p className="font-serif" style={{ color: 'var(--blu-grigio)' }}>
            Romanzi, poesie, diari, saggi, drammi. Testi incompiuti. Raccolte. Tutto ciò che non si trova in libreria.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {['Narrativa', 'Poesia', 'Saggistica', 'Scrittura del sé', 'Drammaturgia'].map((genere) => (
            <div
              key={genere}
              className="p-5 text-center font-serif transition-all"
              style={{
                border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)',
                color: 'var(--blu-notte)',
              }}
            >
              {genere}
            </div>
          ))}
          <div
            className="p-5 text-center font-serif italic"
            style={{
              border: '1px solid color-mix(in srgb, var(--oro) 30%, transparent)',
              color: 'var(--blu-grigio)',
            }}
          >
            e molto altro
          </div>
        </div>
      </section>

      {/* CTA finale */}
      <section className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div
          className="p-12"
          style={{
            border: '1px solid var(--oro)',
            boxShadow: 'inset 0 0 0 4px var(--avorio), inset 0 0 0 5px color-mix(in srgb, var(--oro) 25%, transparent)',
          }}
        >
          <h2 className="font-serif font-normal text-2xl mb-4" style={{ color: 'var(--blu-notte)' }}>
            Le tue pagine aspettano lo sguardo giusto.
          </h2>
          <p className="font-serif mb-8" style={{ color: 'var(--blu-grigio)' }}>
            Siamo agli inizi. I match potrebbero richiedere qualche settimana. Ma chi si iscrive ora fa parte di qualcosa che sta nascendo.
          </p>
          <Link href="/auth/login" className="btn-primario">
            Unisciti a Melquíades
          </Link>
        </div>
      </section>
    </div>
  )
}
