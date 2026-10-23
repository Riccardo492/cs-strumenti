import { icona, montaInCostruzione } from '../comune.js';

export default {
  id: 'controllo-domande',
  nome: 'Controllo domande di concorso',
  descrizione: 'Verifica le domande di partecipazione: dati mancanti, requisiti, documenti, doppioni.',
  tinta: 28,
  stato: 'in costruzione',
  icona: icona('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="m8.8 12.8 2.2 2.2 4.4-4.6"/>'),
  sezioni: [
    { id: 'carica', nome: 'Carica le domande', breve: 'Export delle domande ricevute', descrizione: 'Carichi il file con le domande arrivate.' },
    { id: 'regole', nome: 'Regole di controllo', breve: 'Requisiti da verificare', descrizione: 'Le regole da applicare a ogni domanda.' },
    { id: 'esito', nome: 'Esito', breve: 'Ammessi, esclusi, da verificare', descrizione: "L'elenco con l'esito di ogni controllo." },
  ],
  siti: [
    { nome: 'inPA', url: 'https://www.inpa.gov.it/', descrizione: 'Portale del reclutamento della PA' },
  ],
  guida: {},
  progetto: {
    obiettivo: 'Controllare in blocco le domande di partecipazione a un concorso e preparare gli elenchi di ammessi, esclusi e domande da verificare a mano.',
    cosaFara: [
      'Legge il file delle domande (Excel o CSV esportato dalla piattaforma).',
      'Controlla codice fiscale, dati anagrafici e campi obbligatori.',
      'Segnala doppioni (stessa persona più volte).',
      'Applica i requisiti del bando: età, titolo di studio, scadenza di presentazione…',
      "Produce l'Excel con l'esito e il motivo di ogni esclusione.",
    ],
    servira: ["Un export di domande d'esempio", 'I requisiti di un bando tipo', 'Il formato in cui vi serve l\'esito'],
  },
  monta: montaInCostruzione,
};
