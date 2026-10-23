import { icona, montaInCostruzione } from '../comune.js';

export default {
  id: 'rinomina-pdf',
  nome: 'Rinomina file PDF',
  descrizione: 'Rinomina in blocco molti PDF secondo una regola o un elenco Excel, e li restituisce in uno ZIP.',
  tinta: 350,
  stato: 'in costruzione',
  icona: icona('<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M13.5 3v4.5H18"/><path d="M18 7.5V11"/><path d="m14 21 .5-2.5 5-5 2 2-5 5z"/>'),
  sezioni: [
    { id: 'rinomina', nome: 'Rinomina', breve: 'Scegli i PDF e la regola', descrizione: 'Carichi i PDF, scegli come chiamarli e scarichi lo ZIP.' },
    { id: 'regole', nome: 'Regole di nome', breve: 'Modelli di nome riutilizzabili', descrizione: 'I modelli di nome file che usate più spesso.' },
  ],
  siti: [],
  guida: {},
  progetto: {
    obiettivo: 'Rinominare in un colpo solo decine o centinaia di PDF (elaborati, domande, verbali) senza farlo a mano uno per uno.',
    cosaFara: [
      'Carica molti PDF insieme, trascinandoli nella pagina.',
      'Rinomina secondo un modello, es. «COGNOME_NOME_CF.pdf» o «ID_ELABORATO.pdf».',
      'Può prendere i nomi da un Excel (vecchio nome → nuovo nome) o leggere un codice dentro il PDF.',
      "Mostra l'anteprima dei nuovi nomi prima di procedere e segnala i doppioni.",
      'Restituisce tutto in un unico ZIP; i file non lasciano il computer.',
    ],
    servira: ['Qualche PDF di esempio', 'Le regole di nome che usate'],
  },
  monta: montaInCostruzione,
};
