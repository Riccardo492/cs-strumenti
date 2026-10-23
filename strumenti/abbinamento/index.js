import { icona, montaInCostruzione } from '../comune.js';

export default {
  id: 'abbinamento',
  nome: 'Abbinamento file per ID',
  descrizione: "Unisce l'elenco candidati e il prospetto anonimo delle correzioni tramite l'ID elaborato.",
  tinta: 168,
  stato: 'in costruzione',
  icona: icona('<rect x="3" y="4" width="7.5" height="9.5" rx="1.5"/><rect x="13.5" y="10.5" width="7.5" height="9.5" rx="1.5"/><path d="M10.5 8.5h3a2.5 2.5 0 0 1 2.5 2.5"/><path d="M6 7.5h2M6 10h2M16.5 14h2M16.5 16.5h2"/>'),
  sezioni: [
    { id: 'abbina', nome: 'Abbina i file', breve: 'Elenco candidati + prospetto correzioni', descrizione: "Carichi i due Excel e ottieni l'elenco finale con i voti." },
    { id: 'formato', nome: 'Formato finale', breve: 'Colonne e ordine del file prodotto', descrizione: "Le colonne dell'Excel finale, nell'ordine standard." },
  ],
  siti: [],
  guida: {},
  progetto: {
    obiettivo: "Abbinare l'elenco dei candidati (export della piattaforma, es. «Test_Code_….xlsx») al prospetto anonimo delle correzioni tramite l'ID elaborato, e produrre l'Excel finale nel formato standard.",
    cosaFara: [
      "Riconosce la colonna chiave: «ID elaborato» se c'è, altrimenti «External ID».",
      'Controlla che ogni ID del prospetto trovi corrispondenza e che non ci siano doppioni.',
      'Riporta le colonne voto del prospetto (es. PRIMA PROVA, SECONDA PROVA, VOTO FINALE) lasciando i valori come sono.',
      "Toglie i candidati senza corrispondenza e te li elenca.",
      'Produce un Excel con Test Code, Nome, Cognome, Codice fiscale, Codice INPA, ID Elaborato e i voti.',
    ],
    servira: ['Un elenco candidati e un prospetto correzioni di esempio (anche con dati finti).'],
    sezioni: {
      formato: { cosaFara: ['Test Code', 'Nome (da First Name)', 'Cognome (da Last Name)', 'Codice fiscale (da CF)', 'Codice INPA (da ID)', 'ID Elaborato (da External ID o ID elaborato)', 'Colonne voto del prospetto, nello stesso ordine'] },
    },
  },
  monta: montaInCostruzione,
};
