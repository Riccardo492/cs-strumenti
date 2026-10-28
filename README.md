# CS Strumenti

Raccolta di strumenti per la gestione dei concorsi, in un'unica pagina web.

La pagina è fatta come una dashboard.

- **In alto** ci sono le funzioni, come pillole: la pillola accesa scorre da una voce all'altra e prende il colore della funzione. Accanto ci sono «+ Nuovo» (apre una funzione), lo stile, il tema, la campanella con le cose da fare e il cerchio con le iniziali (il nome serve solo per il saluto). Sotto ci sono le sezioni della funzione aperta, con una linea che scorre sotto quella scelta.
- **La Scrivania** è la pagina iniziale:
  - il saluto e una frase che riassume la situazione;
  - quattro numeri del mese: ricevute, compensi netti, PDF rinominati, domande preparate. Ognuno ha un piccolo grafico delle ultime settimane;
  - il grafico degli ultimi 12 mesi, con un selettore che lo trasforma da una misura all'altra;
  - l'elenco «Da fare» (per esempio le domande da rivedere) e le attività recenti.
- **I numeri** vengono da quello che si fa in questo browser: ricevute scaricate, PDF rinominati, domande generate o stampate. Restano solo nel browser (`lib/attivita.js`). Gli esempi non contano, e riscaricare lo stesso lotto non lo conta due volte. Finché non c'è niente, la Scrivania mostra dati di esempio e lo dice.
- **I passaggi tra le viste sono fluidi**, con le View Transitions del browser. Il titolo sale e cambia; l'icona della funzione vola dalla sua scheda della Scrivania all'intestazione della pagina; il contenuto vecchio esce da un lato e il nuovo entra dall'altro, nel verso dello spostamento. Nelle funzioni a tappe (Batterie di domande) un aeroplanino vola lungo il percorso fino alla tappa aperta.
- Ogni sezione può avere un **assistente passo passo** («Guidami passo passo») e dei **siti collegati**.

Nello stile classico lo sfondo è una mappa topografica animata: le curve di livello scendono piano, piccole luci scorrono lungo le curve, un clic manda un'onda e, aperta una funzione, la mappa prende la sua tinta. Chi ha attivato nel sistema «riduci movimento» vede tutto fermo.

In alto a destra c'è anche lo **stile**: **vetro** (superfici traslucide che sfocano lo sfondo, `css/vetro.css`) oppure **classico**. Nel vetro lo sfondo è statico: colori morbidi e il simbolo C&S grande in basso a destra (`assets/logo-cs-segno.svg`, ricostruito come vettore dal logo). La mappa animata resta nello stile classico. Il vetro sfoca solo le superfici principali, per non pesare sulla scheda video. Se il browser non sa sfocare, o chi usa la pagina ha chiesto meno trasparenze nel sistema, le superfici diventano quasi piene.

In alto a destra si sceglie il tema: **chiaro**, **automatico** (come il sistema) o **scuro**. Ogni browser ricorda la scelta. I colori sono pensati per non stancare la vista: niente bianco pieno nel tema chiaro, niente nero pieno nel tema scuro, contrasti sempre leggibili, anteprime dei documenti attenuate al buio.

Tutto gira nel browser: i file che caricate (Excel, PDF…) non vengono inviati a nessun server.

## Funzioni

| Funzione | Stato |
|---|---|
| Ricevute di pagamento | pronta |
| Abbinamento file per ID | in costruzione |
| Controllo domande di concorso | in costruzione |
| Batterie di domande | pronta |
| Rinomina file PDF | pronta |

## Struttura

```
index.html                  la pagina
assets/                     logo C&S (usato come maschera: prende il colore del tema), simbolo vettoriale per lo sfondo, icona della scheda
css/
  tokens.css                colori, caratteri, misure (tema chiaro e scuro, intensità dello sfondo --campo-*)
  base.css                  bottoni, campi, schede, etichette, tabelle
  struttura.css             testata con le pillole, intestazione della pagina, percorso a tappe, passaggi tra le viste
  scrivania.css             la Scrivania
  assistente.css            pannello dell'assistente
  vetro.css                 stile vetro (si attiva con data-stile="vetro" su <html>)
js/
  app.js                    avvio, testata e navigazione (# = Scrivania, #funzione.sezione)
  scrivania.js              la Scrivania: saluto, numeri del mese, grafici, da fare
  percorso.js               percorso a tappe con l'aeroplanino
  assistente.js             guida passo passo
  eventi.js                 eventi tra le funzioni e l'assistente
  campo.js                  sfondo animato: mappa topografica con rilievi, onde e luci
  tema.js                   interruttore chiaro / automatico / scuro
  stile.js                  interruttore stile vetro / classico
  vivo.js                   onde sui bottoni, luce sulle schede, numeri che scorrono
  movimento.js              rispetta l'impostazione di sistema «riduci movimento»
lib/                        utilità condivise da tutte le funzioni
  excel.js                  lettura di .xlsx e .csv, riconoscimento colonne
  formati.js                importi, date, testi
  controlli.js              codice fiscale, IBAN
  salva.js                  download dei file, avvisi
  file.js                   raccolta di file trascinati, anche cartelle e archivi .zip
  risorse.js                caricamento dei modelli che accompagnano le funzioni
  xlsx.js                   scrittura di file Excel (.xlsx)
  attivita.js               registro delle attività di questo browser (numeri della Scrivania)
strumenti/
  elenco.js                 l'elenco delle funzioni (pillole in alto)
  comune.js                 icone, caricamento CSS, pagina «in costruzione»
  ricevute/                 una cartella per funzione
    index.js                la scheda della funzione
    dati.js · word.js · vista.js · ricevute.css
    modello-ricevuta.docx   il modello Word con i segnaposto
    modello-ricevute.xlsx   il modello Excel da compilare
  rinomina-pdf/
    index.js · vista.js · regole.js · pdftesto.js · modifica.js · esempio.js · rinomina.css
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
  etichetta: 'Rinomina PDF',          // nome corto sulla pillola
  descrizione: 'Testo breve che descrive la funzione.',
  tinta: 350,                         // colore della funzione (tonalità 0–360)
  stato: 'pronto',                    // oppure 'in costruzione'
  icona: icona('<path d="…"/>'),      // tracciati SVG su griglia 24×24
  sezioni: [                          // le sotto-schede sotto le pillole
    { id: 'rinomina', nome: 'Rinomina', breve: 'Riga breve nel menu «+ Nuovo»', descrizione: 'Sotto il titolo della sezione' },
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
    const { montaSezione } = await import('./vista.js');   // la parte pesante si carica solo all'apertura
    montaSezione(el, ctx);
    // ctx.emetti('file-caricati')   → l'assistente va avanti da solo
    // ctx.salva(nomeFile, blob)     → offre il file da scaricare
    // ctx.avviso('Testo')           → messaggio breve a schermo
    // ctx.registra({ azione: 'rinominati', n: 12 })  → conta per i numeri della Scrivania
    return () => { /* facoltativo: pulizia quando si cambia sezione */ };
  },
  // facoltativi:
  // precarica() { … }               → carica vista e stile in anticipo, quando il browser è libero
  // async percorso() { … }          → { idSezione: { fatto, nota } }: mostra il percorso a tappe sopra la funzione
  // async promemoria() { … }        → [{ testo, dettaglio, href, livello: 'alto'|'medio'|'ok', n }]: «Da fare» e numerini
};
```

2. Aggiungila a `strumenti/elenco.js`: compare da sola tra le pillole e nel menu «+ Nuovo».

### Ogni funzione è isolata dalle altre

Così si può lavorare su una funzione senza rischiare le altre:

- **Codice:** ogni funzione vive nella sua cartella `strumenti/<nome>/` e non importa niente dalle altre funzioni, solo da `lib/` e `strumenti/comune.js`.
- **Stili:** gli stili di una funzione hanno un prefisso tutto suo (`ric-`, `rp-`…) e si caricano solo quando la funzione si apre.
- **Caricamento:** `index.js` contiene solo la scheda (nome, sezioni, guida); il resto si carica con `import()` dentro `monta`. Se una funzione ha un errore:
  - nel caricamento della scheda, la sua pillola non compare e le altre funzionano;
  - nella sua sezione, solo quella sezione mostra un messaggio di errore.
- **Parti in comune:** `lib/`, `strumenti/comune.js`, `css/` e `js/` sono usate da tutte le funzioni. Quando si cambiano vanno provate tutte.
- **Pubblicazione:** il sito pubblica solo il ramo `main`. Una funzione nuova si sviluppa su un ramo a parte (per esempio `abbinamento`) e si unisce a `main` quando è pronta: fino ad allora i colleghi non vedono niente.

Per una funzione ancora da fare basta `monta: montaInCostruzione` e un campo `progetto` con `obiettivo`, `cosaFara` e `servira` (vedi `strumenti/abbinamento/index.js`).

### L'assistente

Ogni passo ha `titolo`, `testo` (HTML) e, se vuoi:
- `punta`: un selettore CSS dell'elemento da evidenziare;
- `apri`: un selettore di un `<details>` da aprire;
- `avanzaQuando`: il nome di un evento (o un elenco) che la funzione emette con `ctx.emetti(...)`; quando arriva l'assistente passa al passo successivo.

Più avanti si può collegare un assistente AI che risponde a domande libere: va aggiunto in `js/assistente.js` e richiede un piccolo servizio esterno con una chiave API, perché la chiave non può stare in una pagina pubblica.

## Batterie di domande

Quattro passi, uno per sezione del sottomenu:

1. **Imposta la prova**: titolo, numero di risposte per domanda (3, 4 o 5), materie con quantità, difficoltà e argomenti da privilegiare.
   - **Mista** divide le domande in 30% facili, 50% medie e 20% difficili.
   - **Programma del bando**: è facoltativo e si attiva con l'interruttore «Usa il programma del bando come base». Serve solo a scegliere gli argomenti *dentro* ogni materia. La materia scritta comanda sempre: se il programma non ne parla, compare un avviso e le domande seguono solo la materia.
   - **Ricava le materie** compila l'elenco dal programma del bando.
2. **Genera le domande**: Claude scrive i quesiti materia per materia, a gruppi di 12, e genera solo quelli mancanti. Si può fermare e riprendere. Si può anche caricare un Excel di domande, per esempio uno salvato da questa pagina.
3. **Secondo controllo**: ogni domanda viene ricontrollata da capo.
   - **Doppioni**: la pagina li trova da sola confrontando i testi; le parole rare pesano di più (`doppioni.js`).
   - **Attinenza e risposta esatta**: Claude fa da revisore indipendente. Verifica se la domanda è attinente alla materia e al programma, se la risposta esatta è giusta ed è l'unica, e se la domanda chiede la stessa cosa di un'altra. Per il controllo usa il modello più accurato.
   - **Correzioni**: per ogni segnalazione si può usare la risposta suggerita, rigenerare la domanda, modificarla, toglierla o confermarla.
4. **Versioni e stampa**:
   - **Versioni**: mescolate con un *seme*. Con lo stesso seme si ottengono sempre le stesse versioni.
   - **Word**: una batteria per versione, più a scelta la copia per la commissione con le risposte esatte in grassetto.
   - **Excel delle domande**: domande con l'esito del controllo; si può ricaricare nella pagina.
   - **Griglie di correzione**: in Excel, una per versione più il riepilogo.

**Come si collega a Claude.** Dentro Claude (l'anteprima su claude.ai) la pagina chiede direttamente con la capacità `sample`. Usa l'account di chi la usa e alla prima richiesta Claude chiede il permesso. Altrove (sito GitHub) la pagina prepara la stessa richiesta: la si copia in una chat con Claude e si incolla qui la risposta. Il formato è identico (`ia.js`).

**Salvataggio.** La bozza resta salvata nel browser di chi la prepara. Senza bozza la pagina mostra una batteria di esempio. Appena si tocca un campo del passo 1, l'esempio sparisce del tutto (titolo, programma, materie, domande) e si parte da una batteria vuota: niente dell'esempio finisce nelle richieste a Claude.

File: `stato.js` (dati ed esempio), `ia.js` (richieste a Claude e lettura delle risposte), `doppioni.js`, `versioni.js`, `word.js` (il .docx costruito da zero), `vista.js`, `batterie.css`. L'Excel si scrive con `lib/xlsx.js`, condiviso.

## Rinomina file PDF

Si caricano i PDF (anche una cartella intera o un .zip), si scrive il **modello del nome** e si scarica uno ZIP con i file rinominati: gli originali non vengono toccati. Il nome si compone con:

- **dal file**: `{file}` (nome attuale), `{n}` (progressivo), `{cartella}`, `{oggi}`;
- **da un Excel collegato**: ogni colonna diventa un segnaposto, per esempio `{COGNOME}` o `{ID}`; in più `{nominativo}` dà cognome e nome insieme (colonne Cognome/Nome, Last Name/First Name o Nominativo). Il file si abbina alla riga per nome uguale, per nome che contiene il valore (es. `elaborato_0012.pdf` ↔ `0012`), per testo contenuto nel PDF (es. il codice fiscale) oppure in ordine;
- **dal testo del PDF**: `{pdf:cf}` (codice fiscale trovato), `{pdf:testo}` (testo dopo un'etichetta, es. «Protocollo n.», o con un'espressione regolare), `{pdf:pagine}`.

Il testo dei PDF viene letto con [PDF.js](https://mozilla.github.io/pdf.js/) di Mozilla, caricato da jsDelivr solo quando si attiva la lettura. I PDF scansionati senza riconoscimento del testo non hanno testo da leggere.

Si può anche **cambiare un testo dentro i PDF**: per esempio l'intestazione «ID Elaborato: chj56eich» diventa «Codice domanda: 884512 – ROSSI MARIO» (con `{ID}` e `{nominativo}` presi dall'elenco candidati), in cima a ogni pagina e, se si vuole, nel corpo. Il testo vecchio viene tolto davvero dal contenuto della pagina, non solo coperto, e quello nuovo viene scritto nella stessa posizione con un carattere standard simile (Helvetica al posto di Arial, Times al posto di Cambria). Funziona con i PDF che contengono testo normale, come quelli salvati da Word. Per questa parte si usa [pdf-lib](https://pdf-lib.js.org/), caricata da jsDelivr solo quando serve.

La regola pronta «Elaborati → codice domanda e nominativo» fa tutto insieme: nome del file `{ID}_{nominativo}.pdf` (es. `884512_ROSSI_MARIO.pdf`) e intestazione «Codice domanda: {ID} – {nominativo}». Se il testo nuovo è più lungo, la riga viene ricentrata e, solo se serve, il carattere si rimpicciolisce.

Le regole di nome si possono salvare: restano nel browser di chi le salva.

## Ricevute: quali file Excel vanno bene

Va bene il modello della sezione «Modello Excel», ma anche un elenco del personale fatto a mano: le colonne si riconoscono dal nome.
- **Errori di battitura:** si riconoscono anche intestazioni con un errore, per esempio «CONGOME» per cognome.
- **Nascita in una sola colonna:** «NATO A» con dentro «CAGLIARI IL 20/06/1995» viene separata in luogo e data di nascita.
- **Colonne che mancano:** se il file non ha compenso, ente, data, mansione o tipologia, la pagina lo segnala nei «Valori comuni» e lì si scrivono una volta per tutti.

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
