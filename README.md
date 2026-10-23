# CS Strumenti

Raccolta di strumenti per la gestione dei concorsi, in un'unica pagina web.

Il menu è circolare: al centro c'è il cerchio principale, intorno le funzioni. Quando ne scegli una, il suo cerchio si sposta in alto a sinistra e sotto si apre a cascata il sottomenu. Ogni sezione può avere un **assistente passo passo** («Guidami passo passo») e dei **siti collegati**.

L'interfaccia è animata: sullo sfondo vagano particelle che reagiscono al puntatore, dal cerchio centrale partono impulsi verso le funzioni e, se nessuno tocca il menu per qualche secondo, il centro presenta da solo le funzioni una alla volta. Chi ha attivato nel sistema «riduci movimento» vede tutto fermo.

Tutto gira nel browser: i file che caricate (Excel, PDF…) non vengono inviati a nessun server.

## Funzioni

| Funzione | Stato |
|---|---|
| Ricevute di pagamento | pronta |
| Abbinamento file per ID | in costruzione |
| Controllo domande di concorso | in costruzione |
| Batterie di domande | in costruzione |
| Rinomina file PDF | pronta |

## Struttura

```
index.html                  la pagina
css/
  tokens.css                colori, caratteri, misure (tema chiaro e scuro)
  base.css                  bottoni, campi, schede, etichette, tabelle
  menu.css                  menu circolare, colonna laterale, sottomenu
  assistente.css            pannello dell'assistente
js/
  app.js                    avvio e navigazione (#funzione.sezione)
  menu.js                   disegno del menu e animazioni
  assistente.js             guida passo passo
  eventi.js                 eventi tra le funzioni e l'assistente
  vivo.js                   campo animato di sfondo, onde sui bottoni, luce sulle schede, numeri che scorrono
  movimento.js              rispetta l'impostazione di sistema «riduci movimento»
lib/                        utilità condivise da tutte le funzioni
  excel.js                  lettura di .xlsx e .csv, riconoscimento colonne
  formati.js                importi, date, testi
  controlli.js              codice fiscale, IBAN
  salva.js                  download dei file, avvisi
  file.js                   raccolta di file trascinati, anche cartelle e archivi .zip
  risorse.js                caricamento dei modelli che accompagnano le funzioni
strumenti/
  elenco.js                 l'elenco delle funzioni nel menu
  comune.js                 icone, caricamento CSS, pagina «in costruzione»
  ricevute/                 una cartella per funzione
    index.js                la scheda della funzione
    dati.js · word.js · vista.js · ricevute.css
    modello-ricevuta.docx   il modello Word con i segnaposto
    modello-ricevute.xlsx   il modello Excel da compilare
  rinomina-pdf/
    index.js · vista.js · regole.js · pdftesto.js · esempio.js · rinomina.css
  abbinamento/ · controllo-domande/ · batterie-domande/
```

Non serve nessuna installazione né compilazione: sono file HTML, CSS e JavaScript (moduli ES). L'unica libreria esterna è [JSZip](https://stuk.github.io/jszip/), caricata da cdnjs, che serve ad aprire e creare i file .docx, .xlsx e .zip.

## Aggiungere una funzione

1. Crea la cartella `strumenti/<nome>/` con un file `index.js` che esporta la scheda:

```js
import { icona, caricaCss } from '../comune.js';

export default {
  id: 'rinomina-pdf',                 // compare nell'indirizzo: #rinomina-pdf
  nome: 'Rinomina file PDF',
  descrizione: 'Testo breve mostrato nel cerchio centrale.',
  tinta: 350,                         // colore del cerchio (tonalità 0–360)
  stato: 'pronto',                    // oppure 'in costruzione'
  icona: icona('<path d="…"/>'),      // tracciati SVG su griglia 24×24
  sezioni: [                          // il sottomenu a cascata
    { id: 'rinomina', nome: 'Rinomina', breve: 'Sotto la voce nel sottomenu', descrizione: 'Sotto il titolo della sezione' },
  ],
  siti: [                             // siti esterni collegati (facoltativo)
    { nome: 'Nome del sito', url: 'https://…', descrizione: 'A cosa serve' },
  ],
  guida: {                            // passi dell'assistente, per sezione (facoltativo)
    rinomina: [
      { titolo: 'Carica i PDF', testo: '<p>…</p>', punta: '#mio-elemento', avanzaQuando: 'file-caricati' },
    ],
  },
  async monta(el, ctx) {              // disegna la sezione ctx.sezione dentro el
    await caricaCss(new URL('./stile.css', import.meta.url));
    el.innerHTML = '…';
    // ctx.emetti('file-caricati')   → l'assistente va avanti da solo
    // ctx.salva(nomeFile, blob)     → offre il file da scaricare
    // ctx.avviso('Testo')           → messaggio breve a schermo
    return () => { /* facoltativo: pulizia quando si cambia sezione */ };
  },
};
```

2. Aggiungila a `strumenti/elenco.js`. Il menu circolare si ridispone da solo in base al numero di funzioni.

Per una funzione ancora da fare basta `monta: montaInCostruzione` e un campo `progetto` con `obiettivo`, `cosaFara` e `servira` (vedi `strumenti/abbinamento/index.js`).

### L'assistente

Ogni passo ha `titolo`, `testo` (HTML) e, se vuoi:
- `punta`: un selettore CSS dell'elemento da evidenziare;
- `apri`: un selettore di un `<details>` da aprire;
- `avanzaQuando`: il nome di un evento (o un elenco) che la funzione emette con `ctx.emetti(...)`; quando arriva l'assistente passa al passo successivo.

Più avanti si può collegare un assistente AI che risponde a domande libere: va aggiunto in `js/assistente.js` e richiede un piccolo servizio esterno con una chiave API, perché la chiave non può stare in una pagina pubblica.

## Rinomina file PDF

Si caricano i PDF (anche una cartella intera o un .zip), si scrive il **modello del nome** e si scarica uno ZIP con i file rinominati: gli originali non vengono toccati. Il nome si compone con:

- **dal file**: `{file}` (nome attuale), `{n}` (progressivo), `{cartella}`, `{oggi}`;
- **da un Excel collegato**: ogni colonna diventa un segnaposto, per esempio `{COGNOME}`. Il file si abbina alla riga per nome uguale, per nome che contiene il valore (es. `elaborato_0012.pdf` ↔ `0012`), per testo contenuto nel PDF (es. il codice fiscale) oppure in ordine;
- **dal testo del PDF**: `{pdf:cf}` (codice fiscale trovato), `{pdf:testo}` (testo dopo un'etichetta, es. «Protocollo n.», o con un'espressione regolare), `{pdf:pagine}`.

Il testo dei PDF viene letto con [PDF.js](https://mozilla.github.io/pdf.js/) di Mozilla, caricato da jsDelivr solo quando si attiva la lettura. I PDF scansionati senza riconoscimento del testo non hanno testo da leggere.

Le regole di nome si possono salvare: restano nel browser di chi le salva.

## Ricevute: cambiare il modello Word

`strumenti/ricevute/modello-ricevuta.docx` è il modello. Si può aprire e modificare in Word lasciando intatti i segnaposto:

`{{NOMINATIVO}} {{NASCITA}} {{RESIDENZA}} {{VIA_LABEL}} {{INDIRIZZO}} {{CF}} {{TIPO_DOC}} {{NUM_DOC}} {{TEL}} {{CELL}} {{EMAIL}} {{IBAN}} {{MANSIONE}} {{LORDO}} {{RITENUTA}} {{INPS}} {{NETTO}} {{LUOGO_FIRMA}} {{DATA_FIRMA}}`

e, nella riga del report attività che viene ripetuta: `{{R_ENTE}} {{R_DATA}} {{R_TIPO}} {{R_NETTO}}`.

Scrivi ogni segnaposto tutto d'un fiato: se Word lo spezza (per esempio correggendolo a metà), non viene più riconosciuto. Nel dubbio cancellalo e riscrivilo intero.

## Provarla sul proprio computer

I moduli JavaScript non funzionano aprendo `index.html` con un doppio clic: serve un piccolo server locale. Dalla cartella del progetto:

```
python3 -m http.server 8000
```

poi apri http://localhost:8000. In alternativa va bene l'estensione «Live Server» di Visual Studio Code.

## Pubblicarla con GitHub Pages

1. Sul repository: **Settings › Pages**.
2. In «Build and deployment» scegli **Deploy from a branch**, ramo **main**, cartella **/ (root)**, e salva.
3. Dopo un minuto la pagina è su `https://<utente>.github.io/cs-strumenti/`.

Ogni modifica caricata sul ramo `main` aggiorna il sito da sola.
