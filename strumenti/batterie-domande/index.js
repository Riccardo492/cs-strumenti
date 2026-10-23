import { icona, montaInCostruzione } from '../comune.js';

export default {
  id: 'batterie-domande',
  nome: 'Batterie di domande',
  descrizione: 'Genera batterie di quiz da una banca domande, con più versioni e griglie di correzione.',
  tinta: 278,
  stato: 'in costruzione',
  icona: icona('<rect x="3.5" y="7" width="13" height="13.5" rx="2"/><path d="M7.5 4h10.5a2.5 2.5 0 0 1 2.5 2.5V17"/><path d="M8.3 11.3a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4M10.1 17h.01"/>'),
  sezioni: [
    { id: 'banca', nome: 'Banca domande', breve: 'Le domande da cui pescare', descrizione: 'Carichi o tieni aggiornata la banca delle domande per materia.' },
    { id: 'genera', nome: 'Genera batteria', breve: 'Quante domande, materie, versioni', descrizione: 'Scegli quante domande per materia e quante versioni preparare.' },
    { id: 'correzione', nome: 'Griglie di correzione', breve: 'Risposte esatte per versione', descrizione: 'Le chiavi di correzione di ogni versione.' },
  ],
  siti: [],
  guida: {},
  progetto: {
    obiettivo: 'Preparare batterie di domande per le prove scritte o preselettive, in più versioni, con le relative griglie di correzione.',
    cosaFara: [
      'Legge una banca domande in Excel (domanda, risposte, risposta esatta, materia, difficoltà).',
      'Estrae le domande secondo le quote per materia, senza ripetizioni.',
      'Mescola domande e risposte per creare versioni diverse (A, B, C…).',
      'Esporta le batterie in Word o PDF e le griglie di correzione in Excel.',
    ],
    servira: ['Una banca domande di esempio', 'Il modello grafico delle batterie che usate oggi'],
  },
  monta: montaInCostruzione,
};
