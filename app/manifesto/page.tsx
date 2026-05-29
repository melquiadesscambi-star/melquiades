import Link from 'next/link'

export default function ManifestoPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <h1 className="font-serif font-normal text-4xl" style={{ color: 'var(--blu-notte)' }}>
          Manifesto
        </h1>
      </div>

      <div className="prose-melquiades space-y-8">
        {[
          {
            titolo: 'Il problema',
            testo: `Ci sono persone che custodiscono parole nel cassetto, speranzose che uno sguardo affine incontri il loro manoscritto. Ci sono persone che cercano parole autentiche in cui sia possibile riconoscersi, come una voce nuda, intima, che non vende nulla. Eppure, in una società alimentata e modellata da legami superficiali, queste due solitudini restano isolate, non incontrandosi in nessun dove.`,
          },
          {
            titolo: 'La soluzione',
            testo: `Melquíades vuole essere il luogo in cui queste solitudini cessano di vagare a vuoto. È uno spazio discreto e silenzioso, dove chi custodisce le parole incontra chi desidera riceverle. Dietro questo incontro si muove un meccanismo invisibile, volto a far combaciare le inclinazioni del lettore con la natura del manoscritto. Quando l'affinità si manifesta, Melquíades scambia i contatti in entrambe le direzioni.`,
          },
          {
            titolo: 'Il fulcro',
            testo: `Il cuore di Melquíades vive fuori da Melquíades: non risiede nello scambio in sé, ma nel legame che nasce un istante dopo, quando la piattaforma si ritira e lascia spazio all'incontro. Condividere un proprio manoscritto significa mettere a nudo la propria anima; leggerlo, allora, diventa un rito di accoglienza. Tutto ciò che fiorisce a partire da quell'istante — che sia un'impressione, un confronto o qualcosa in più — appartiene alle persone, non a Melquíades.`,
          },
          {
            titolo: 'Il rito di passaggio',
            testo: `Su Melquíades si entra leggendo. Prima di poter condividere le proprie pagine, si è chiamati ad accogliere quelle di un altro. Solo dopo che questo primo incontro si è compiuto, si apre lo spazio per offrire il proprio manoscritto. Non è un vincolo tecnico, ma una scelta d'anima consapevole. Chi arriva con un manoscritto deve prima farsi custode dell'anima altrui. Questo esercizio di empatia iniziale garantisce che Melquíades non diventi un aggregatore di ego, ma un tessuto equilibrato di sguardi attenti.`,
          },
          {
            titolo: 'Il nome',
            testo: `Melquíades è il leggendario gitano di Cent'anni di solitudine di García Márquez: colui che percorre il mondo portando conoscenza rara, la consegna a chi sa cosa farsene, e poi scompare. Descrive esattamente il nostro gesto: propiziare l'incontro profondo al momento giusto, e poi farsi da parte per non contaminarlo. In Melquíades non troverai intermediari che selezionano, non troverai algoritmi predittivi che raccomandano, non troverai valutazioni pubbliche, stelline o recensioni. Solo persone che si aprono attraverso le proprie pagine.`,
          },
        ].map(sezione => (
          <div key={sezione.titolo}>
            <h2
              className="font-serif font-normal text-xl mb-3"
              style={{ color: 'var(--blu-notte)' }}
            >
              {sezione.titolo}
            </h2>
            <p
              className="font-serif leading-relaxed text-lg"
              style={{ color: 'var(--blu-grigio)', lineHeight: '1.75' }}
            >
              {sezione.testo}
            </p>
          </div>
        ))}

        {/* Il simbolo — sezione separata per gestire la citazione */}
        <div>
          <h2
            className="font-serif font-normal text-xl mb-3"
            style={{ color: 'var(--blu-notte)' }}
          >
            Il simbolo
          </h2>
          <p
            className="font-serif leading-relaxed text-lg"
            style={{ color: 'var(--blu-grigio)', lineHeight: '1.75' }}
          >
            Il nostro emblema richiama i pesciolini d&apos;oro che il colonnello Aureliano Buendía, dopo aver attraversato le guerre e le disillusioni che segnano Cent&apos;anni di solitudine, fabbricava nel silenzio del suo laboratorio. Nel romanzo, quel gesto era un rito intimo e circolare: una volta finiti, i pesciolini venivano fusi per ricominciare da capo, per il puro bisogno di abitare la propria solitudine. Con tutto il rispetto per García Márquez, Melquíades nasce per spezzare quel cerchio: vogliamo che quel pezzo d&apos;oro, nato dopo tanto rumore, esca finalmente dal laboratorio e trovi qualcuno capace di decifrarne il disegno.
          </p>
          <blockquote
            className="font-serif italic mt-6 pl-4"
            style={{
              color: 'var(--blu-grigio)',
              borderLeft: '2px solid var(--oro)',
              lineHeight: '1.75',
            }}
          >
            <p className="text-base">
              «Se prendo il pesce d&apos;oro<br />
              Ve la farò vedere<br />
              Se prendo il pesce d&apos;oro<br />
              Mi sposerò all&apos;altare»
            </p>
            <footer className="mt-2 text-sm" style={{ color: 'var(--oro)' }}>
              — Fabrizio De André, <cite>Le acciughe fanno il pallone</cite>
            </footer>
          </blockquote>
        </div>
      </div>

      <div className="mt-16 text-center">
        <p className="text-xs tracking-widest mb-8" style={{ color: 'var(--oro)', letterSpacing: '0.5em' }}>✦ ✦ ✦</p>
        <Link href="/auth/login" className="btn-primario">
          Entra in Melquíades
        </Link>
      </div>
    </div>
  )
}
