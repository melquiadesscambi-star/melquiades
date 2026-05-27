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
            testo: `Ci sono scrittori con un manoscritto nel cassetto. Non cercano un editore, non vogliono diventare famosi, non hanno bisogno di validazione commerciale. Vogliono solo che qualcuno legga quello che hanno scritto. Dall'altra parte ci sono lettori che vorrebbero leggere qualcosa di non ancora pubblicato — una voce nuda, che non ti vende nulla, che non ha passato filtri editoriali. Queste due persone spesso non si incontrano mai.`,
          },
          {
            titolo: 'La soluzione',
            testo: `Melquíades è quel posto. Una piattaforma gratuita dove chi ha scritto incontra chi vuole leggere. Il matching è automatico e bidirezionale: ogni volta che arriva una nuova registrazione, il sistema cerca la corrispondenza più vecchia compatibile tra quelle in attesa. Quando la trova, scambia i contatti in entrambe le direzioni.`,
          },
          {
            titolo: 'La filosofia',
            testo: `Da quel momento la piattaforma esce di scena. Non ospita i testi, non monitora le letture, non chiede feedback, non impone scadenze. Lo scrittore manda il manoscritto direttamente al lettore, nel modo che preferisce. Quello che nasce dopo — un'impressione, un confronto, forse un'amicizia letteraria — appartiene a loro, non a noi.`,
          },
          {
            titolo: 'Il rito di passaggio',
            testo: `Su Melquíades si entra leggendo. Ogni nuovo utente deve prima fare una richiesta di lettura. Solo dopo aver ricevuto il proprio match come lettore potrà caricare un manoscritto. Non è una limitazione: è una scelta di design consapevole. Chi arriva con un manoscritto passa prima dall'esperienza del lettore. Questo garantisce anche un equilibrio strutturale tra scrittori e lettori.`,
          },
          {
            titolo: 'Il nome',
            testo: `Melquíades è il personaggio di Cent'anni di solitudine di García Márquez: lo straniero che percorre il mondo portando conoscenza rara, la consegna a chi sa cosa farsene, e poi scompare. Descrive esattamente quello che facciamo: creare l'incontro al momento giusto, e poi farsi da parte.`,
          },
          {
            titolo: 'Niente editori. Niente filtri. Niente costi.',
            testo: `Melquíades è gratuito e lo resterà. Non ci sono editori che selezionano, non ci sono algoritmi che raccomandano, non ci sono valutazioni o recensioni. Solo testi e lettori.`,
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
