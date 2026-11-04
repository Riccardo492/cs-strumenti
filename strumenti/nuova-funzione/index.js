// Posto pronto per la prossima funzione: nome, sezioni e contenuto arrivano quando la funzione è definita.
// Per completarla: cambia id (e cartella), nome, etichetta, tinta, icona e sezioni, poi sostituisci monta.
import { icona, montaInCostruzione } from '../comune.js';

export default {
  id: 'nuova-funzione',
  nome: 'Nuova funzione',
  etichetta: 'Nuova funzione',  // nome breve, nel menu laterale
  descrizione: 'Il posto per la prossima funzione: nome, sezioni e contenuto arrivano a breve.',
  tinta: 120,
  stato: 'in costruzione',
  icona: icona('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>'),
  sezioni: [
    { id: 'inizio', nome: 'In preparazione', breve: 'Arriva a breve', descrizione: 'Questa funzione è in preparazione: qui comparirà appena è pronta.' },
  ],
  siti: [],
  guida: {},
  progetto: {
    obiettivo: 'Da definire: qui andrà la prossima funzione di CS Strumenti.',
    cosaFara: ['Le sezioni e i passaggi si decidono quando la funzione è descritta.'],
    servira: ['Una descrizione di cosa deve fare, oppure il programma o i file che usate oggi.'],
  },
  monta: montaInCostruzione,
};
