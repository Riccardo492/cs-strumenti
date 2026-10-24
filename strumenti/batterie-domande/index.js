// Scheda della funzione «Batterie di domande».
// Quattro passi, uno per sezione: imposta la prova → genera le domande → secondo controllo → versioni e stampa.
import { icona, caricaCss } from '../comune.js';

export default {
  id: 'batterie-domande',
  nome: 'Batterie di domande',
  descrizione: 'Quiz a risposta multipla per materia e difficoltà, con un secondo controllo e le versioni da stampare.',
  tinta: 278,
  stato: 'pronto',
  icona: icona('<rect x="3.5" y="7" width="13" height="13.5" rx="2"/><path d="M7.5 4h10.5a2.5 2.5 0 0 1 2.5 2.5V17"/><path d="M8.3 11.3a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M10.1 17h.01"/>'),
  sezioni: [
    { id: 'imposta', nome: '1 · Imposta la prova', breve: 'Materie, difficoltà, programma del bando', descrizione: 'Indica le materie, quante domande per ciascuna e con quale difficoltà. Se vuoi, usa il programma del bando come base per gli argomenti.' },
    { id: 'genera', nome: '2 · Genera le domande', breve: 'Claude scrive i quesiti', descrizione: 'Claude scrive i quesiti a risposta multipla materia per materia. Fuori da Claude si copia la richiesta e si incolla la risposta.' },
    { id: 'controllo', nome: '3 · Secondo controllo', breve: 'Doppioni, attinenza, risposte esatte', descrizione: 'Ogni domanda viene ricontrollata da capo: doppioni, attinenza alla materia e al programma, risposta esatta giusta e unica.' },
    { id: 'esporta', nome: '4 · Versioni e stampa', breve: 'Word, Excel, griglie di correzione', descrizione: 'Prepara le versioni mescolate (A, B, C…), la batteria in Word, l\'Excel delle domande e le griglie di correzione.' },
  ],
  siti: [
    { nome: 'Normattiva', url: 'https://www.normattiva.it/', descrizione: 'Testi di legge vigenti, per verificare i riferimenti normativi delle domande' },
    { nome: 'Claude', url: 'https://claude.ai/new', descrizione: 'Per il copia e incolla, quando la pagina non è aperta dentro Claude' },
  ],
  guida: {
    imposta: [
      { titolo: 'Dai un titolo alla prova', punta: '#bt-prova',
        testo: '<p>Il titolo compare in testa a ogni pagina della batteria. Scegli anche quante risposte deve avere ogni domanda: di solito 3 o 4.</p>' },
      { titolo: 'Programma del bando (facoltativo)', punta: '#bt-programma',
        testo: "<p>Se vuoi che le domande seguano il programma del bando, attiva <b>Usa il programma del bando come base</b> e incolla la parte con le materie d'esame. Con <b>Ricava le materie</b> l'elenco si compila da solo.</p><p>Spento, contano solo le materie e gli argomenti che scrivi tu. In ogni caso ogni domanda riguarda solo la sua materia.</p>" },
      { titolo: 'Materie, quantità e difficoltà', punta: '#bt-materie',
        testo: "<p>Per ogni materia indica quante domande servono e la difficoltà. <b>Mista</b> divide le domande in 30% facili, 50% medie e 20% difficili.</p><p>Negli argomenti puoi indicare cosa privilegiare, per esempio una legge precisa.</p>" },
      { titolo: 'Passa alla generazione', punta: '#bt-avanti',
        testo: '<p>Quando le materie sono a posto, vai al passo 2.</p>' },
    ],
    genera: [
      { titolo: 'Come si collega a Claude', punta: '#bt-modo',
        testo: "<p>Se la pagina è aperta dentro Claude, le domande si generano direttamente: alla prima richiesta Claude chiede il permesso.</p><p>Altrimenti si copia la richiesta, la si incolla in una chat con Claude e si incolla qui la risposta.</p>" },
      { titolo: 'Genera le domande', punta: '#bt-genera-azioni', avanzaQuando: 'domande-generate',
        testo: "<p>Le domande arrivano materia per materia: per ogni materia vedi quante ne mancano. Puoi fermare in qualsiasi momento e riprendere dopo: si generano solo quelle mancanti.</p>" },
      { titolo: 'Domande già pronte?', punta: '#bt-importa',
        testo: "<p>Puoi anche caricare un Excel di domande, per esempio una batteria salvata in precedenza con questa pagina: verranno controllate come le altre.</p>" },
    ],
    controllo: [
      { titolo: 'Avvia il controllo', punta: '#bt-controllo-azioni', avanzaQuando: 'controllo-fatto',
        testo: "<p>Claude rilegge ogni domanda come un revisore che non l'ha scritta: verifica che sia attinente, che la risposta esatta sia giusta e l'unica corretta, e che non chieda la stessa cosa di un'altra.</p><p>I doppioni con testo quasi uguale li trova la pagina da sola, subito.</p>" },
      { titolo: 'Guarda le segnalazioni', punta: '#bt-filtri',
        testo: '<p>Con i filtri vedi solo le domande da rivedere: fuori tema, risposta da correggere, doppioni.</p>' },
      { titolo: 'Sistema le domande', punta: '#bt-lista',
        testo: "<p>Per ogni domanda segnalata puoi <b>usare la risposta suggerita</b>, <b>rigenerarla</b>, <b>modificarla</b> a mano o <b>toglierla</b>. Se secondo te va bene, scegli <b>Va bene così</b>.</p><p>Le domande nuove o modificate vanno ricontrollate.</p>" },
    ],
    esporta: [
      { titolo: 'Le versioni', punta: '#bt-versioni',
        testo: "<p>Scegli quante versioni preparare e come mescolarle. Con lo stesso <b>seme</b> si ottengono sempre le stesse versioni: tienilo da parte insieme alle griglie.</p>" },
      { titolo: 'La stampa', punta: '#bt-stampa',
        testo: "<p>Scrivi le istruzioni per i candidati. La <b>copia per la commissione</b> evidenzia le risposte esatte.</p>" },
      { titolo: 'Scarica', punta: '#bt-barra', avanzaQuando: 'scaricato',
        testo: "<p><b>Word</b>: una batteria per versione. <b>Excel delle domande</b>: tutte le domande con l'esito del controllo, ricaricabile in questa pagina. <b>Griglie</b>: la risposta esatta di ogni domanda, versione per versione.</p>" },
    ],
  },
  async monta(el, ctx) {
    await caricaCss(new URL('./batterie.css', import.meta.url));
    const v = await import('./vista.js');   // caricata solo quando serve
    return v.monta(el, ctx);
  },
};
