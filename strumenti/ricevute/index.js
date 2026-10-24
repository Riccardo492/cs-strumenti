// Scheda della funzione «Ricevute di pagamento».
// Ogni funzione esporta un oggetto con questa forma: vedi README.md, sezione «Aggiungere una funzione».
import { icona, caricaCss } from '../comune.js';

export default {
  id: 'ricevute',
  nome: 'Ricevute di pagamento',
  descrizione: "Dall'Excel dei collaboratori alle ricevute Word, con la ritenuta del 20% già calcolata.",
  tinta: 214,
  stato: 'pronto',
  icona: icona('<path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>'),
  sezioni: [
    { id: 'genera', nome: 'Genera ricevute', breve: 'Dal file Excel ai documenti Word', descrizione: "Carica l'Excel: per ogni riga viene compilata una ricevuta Word sul modello. Il file viene letto solo nel browser e non viene inviato da nessuna parte." },
    { id: 'modello', nome: 'Modello Excel', breve: 'Il file da compilare e le sue colonne', descrizione: 'Il modello pronto da compilare e cosa va in ogni colonna.' },
    { id: 'calcoli', nome: 'Come si calcola', breve: 'Ritenuta, netto, lordo, bollo', descrizione: 'Le regole usate per gli importi, con una calcolatrice per provarle.' },
  ],
  siti: [
    { nome: 'Verifica codice fiscale', url: 'https://telematici.agenziaentrate.gov.it/VerificaCF', descrizione: "Agenzia delle Entrate: controlla che un codice fiscale esista" },
  ],
  guida: {
    genera: [
      { titolo: 'Carica il file Excel', punta: '#ric-file', avanzaQuando: 'file-caricato',
        testo: "<p>Trascina qui l'Excel con i collaboratori, oppure clicca per sceglierlo. Serve una riga per persona e una riga di intestazioni.</p><p>Non hai il file? Nella sezione «Modello Excel» trovi quello pronto da compilare.</p>" },
      { titolo: "Controlla l'abbinamento delle colonne", punta: '#ric-mappa', apri: '#ric-mappa',
        testo: "<p>Qui vedi quale colonna del tuo file è stata usata per ogni campo della ricevuta.</p><p>Se un campo è bordato di giallo non è stato trovato: scegli tu la colonna giusta dal menu a tendina.</p>" },
      { titolo: 'Valori comuni', punta: '#ric-comuni',
        testo: "<p>Se tutti hanno lavorato allo stesso concorso, scrivi qui una volta sola ente, data, mansione e compenso.</p><p>Vengono usati solo dove nel file la cella è vuota.</p>" },
      { titolo: 'Opzioni', punta: '#ric-opzioni',
        testo: "<p><b>Tutto in maiuscolo</b> riproduce lo stile del modello.</p><p><b>Una ricevuta per persona</b> unisce le righe con lo stesso codice fiscale in una sola ricevuta, con più attività nel report.</p>" },
      { titolo: "Controlla l'elenco", punta: '#ric-elenco',
        testo: "<ul><li><b>Pronta</b>: tutto a posto.</li><li><b>Avvisi</b>: si può generare, ma manca qualcosa o il codice fiscale/IBAN non torna.</li><li><b>Da sistemare</b>: manca il compenso o il nome; non verrà generata.</li><li><b>Bollo 2 €</b>: oltre 77,47 € serve la marca da bollo.</li></ul>" },
      { titolo: "Guarda l'anteprima", punta: '#ric-anteprima', avanzaQuando: 'ricevuta-scelta',
        testo: "<p>Clicca una riga dell'elenco per vedere la sua ricevuta. I campi mancanti sono sottolineati in giallo e sopra trovi l'elenco degli avvisi.</p>" },
      { titolo: 'Scarica le ricevute', punta: '#ric-barra', avanzaQuando: 'scaricato',
        testo: "<p><b>Scarica tutte (ZIP)</b>: un file Word per ogni ricevuta.</p><p><b>Unico file Word</b>: tutte le ricevute una dopo l'altra, comodo per stampare.</p><p>Le ricevute «Da sistemare» vengono escluse.</p>" },
    ],
    modello: [
      { titolo: 'Scarica il modello', punta: '#ric-scarica-modello', avanzaQuando: 'modello-scaricato',
        testo: '<p>Il file ha tre fogli: «Dati» da compilare, «Esempio» con tre righe inventate e «Istruzioni».</p>' },
      { titolo: 'Compila il foglio «Dati»', punta: '#ric-colonne',
        testo: "<p>Una riga per collaboratore. Le colonne obbligatorie sono cognome, nome e codice fiscale, più il compenso (lordo o netto).</p><p>Poi torna in «Genera ricevute» e carica il file.</p>" },
    ],
    calcoli: [
      { titolo: 'Prova un importo', punta: '#ric-calcolatrice',
        testo: '<p>Scrivi un importo e scegli se è il netto da pagare o il lordo concordato: vedi subito ritenuta e netto, come compariranno sulla ricevuta.</p>' },
    ],
  },
  async monta(el, ctx) {
    await caricaCss(new URL('./ricevute.css', import.meta.url));
    const { montaGenera, montaModello, montaCalcoli } = await import('./vista.js');   // caricata solo quando serve
    if (ctx.sezione === 'modello') return montaModello(el, ctx);
    if (ctx.sezione === 'calcoli') return montaCalcoli(el, ctx);
    return montaGenera(el, ctx);
  },
};
