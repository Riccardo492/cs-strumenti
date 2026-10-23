// Scheda della funzione «Rinomina file PDF».
import { icona, caricaCss } from '../comune.js';
import { montaRinomina, montaRegole } from './vista.js';

export default {
  id: 'rinomina-pdf',
  nome: 'Rinomina file PDF',
  descrizione: 'Rinomina in blocco molti PDF con un modello, i dati di un Excel o il testo letto dentro i documenti, e li restituisce in uno ZIP.',
  tinta: 350,
  stato: 'pronto',
  icona: icona('<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M13.5 3v4.5H18"/><path d="M18 7.5V11"/><path d="m14 21 .5-2.5 5-5 2 2-5 5z"/>'),
  sezioni: [
    { id: 'rinomina', nome: 'Rinomina', breve: 'Scegli i PDF e come chiamarli', descrizione: 'Carichi i PDF, componi il nuovo nome e scarichi lo ZIP con i file rinominati. I file restano nel tuo browser: non vengono inviati da nessuna parte.' },
    { id: 'regole', nome: 'Regole di nome', breve: 'Modelli pronti e salvati', descrizione: 'Modelli di nome pronti, quelli che hai salvato e l\'elenco dei segnaposto.' },
  ],
  siti: [],
  guida: {
    rinomina: [
      { titolo: 'Carica i PDF', punta: '#rp-file', avanzaQuando: 'file-caricati',
        testo: "<p>Trascina qui i PDF da rinominare. Puoi trascinare anche una <b>cartella intera</b> o un <b>file .zip</b>: i PDF dentro vengono presi tutti, gli altri file ignorati.</p>" },
      { titolo: 'Componi il nuovo nome', punta: '#rp-nome', avanzaQuando: 'modello-cambiato',
        testo: "<p>Il modello è il testo del nuovo nome. Le parti tra parentesi graffe cambiano da file a file: clicca un segnaposto per inserirlo.</p><p>Per esempio <span class=\"mono\">ELABORATO_{n}</span> numera i file in ordine.</p>" },
      { titolo: 'Prendi i dati da un Excel', punta: '#rp-excel',
        testo: "<p>Se i nomi stanno in un elenco, collega l'Excel. Scegli la colonna che identifica il file (per esempio l'ID elaborato) e come si abbina: le altre colonne diventano segnaposto, come <span class=\"mono\">{COGNOME}</span>.</p><p>Sotto vedi quanti file sono stati abbinati e quali righe non hanno un PDF.</p>" },
      { titolo: 'Oppure leggi dentro i PDF', punta: '#rp-pdf',
        testo: "<p>Se il codice fiscale o un numero è scritto nel documento, attiva la lettura: diventa disponibile <span class=\"mono\">{pdf:cf}</span> o <span class=\"mono\">{pdf:testo}</span>.</p><p>Funziona solo con i PDF che contengono testo, non con le scansioni.</p>" },
      { titolo: "Controlla l'elenco", punta: '#rp-elenco',
        testo: "<ul><li><b>Doppione</b>: due file avrebbero lo stesso nome, al secondo viene aggiunto _2.</li><li><b>Nome vuoto</b>: mancano i dati, il file tiene il nome attuale.</li><li>Puoi correggere a mano un nome scrivendo nella sua casella, ed escludere un file togliendo la spunta.</li></ul>" },
      { titolo: 'Scarica lo ZIP', punta: '#rp-barra', avanzaQuando: 'scaricato',
        testo: "<p><b>Scarica ZIP rinominato</b> crea un archivio con i PDF e i nuovi nomi; gli originali sul tuo computer non vengono toccati.</p><p><b>Elenco (CSV)</b> ti dà la tabella vecchio nome → nuovo nome da tenere agli atti.</p>" },
    ],
    regole: [
      { titolo: 'Usa una regola pronta', punta: '#rp-pronte',
        testo: '<p>Ogni regola imposta il modello del nome e le opzioni. Clicca «Usa»: torni in «Rinomina» con la regola già applicata.</p>' },
      { titolo: 'I segnaposto', punta: '#rp-segnaposto',
        testo: '<p>Qui trovi tutte le parti variabili che puoi mettere nel nome, da scrivere tra parentesi graffe.</p>' },
    ],
  },
  async monta(el, ctx) {
    await caricaCss(new URL('./rinomina.css', import.meta.url));
    if (ctx.sezione === 'regole') return montaRegole(el, ctx);
    return montaRinomina(el, ctx);
  },
};
