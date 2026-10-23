// Lettura del testo dei PDF con PDF.js (Mozilla), caricato solo quando serve.
// Il lavoro avviene nella pagina stessa (niente Web Worker): funziona sia su GitHub Pages sia nell'anteprima.
const VERSIONE = '4.10.38';
const BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${VERSIONE}/legacy/build/`;
let promessa = null;

function lettore() {
  if (!promessa) {
    promessa = (async () => {
      const [lib, worker] = await Promise.all([import(BASE + 'pdf.min.mjs'), import(BASE + 'pdf.worker.min.mjs')]);
      if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
      lib.GlobalWorkerOptions.workerSrc = BASE + 'pdf.worker.min.mjs';
      return lib;
    })().catch(e => { promessa = null; throw new Error('Non riesco a caricare il lettore PDF: serve la connessione a internet.'); });
  }
  return promessa;
}

/**
 * Testo di un PDF (prima pagina, oppure tutte).
 * @returns {Promise<{ testo: string, pagine: number, errore?: string }>}
 */
export async function leggiTesto(blob, { tutte = false } = {}) {
  const lib = await lettore();
  const compito = lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, disableFontFace: true, stopAtErrors: false, verbosity: 0 });
  let doc;
  try {
    doc = await compito.promise;
  } catch (e) {
    compito.destroy();
    if (e && e.name === 'PasswordException') return { testo: '', pagine: 0, errore: 'protetto da password' };
    return { testo: '', pagine: 0, errore: 'non si apre come PDF' };
  }
  try {
    const fino = tutte ? doc.numPages : Math.min(1, doc.numPages);
    let testo = '';
    for (let p = 1; p <= fino; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      testo += tc.items.map(it => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
      pg.cleanup();
    }
    testo = testo.replace(/[ \t]+/g, ' ').trim();
    return { testo, pagine: doc.numPages, errore: testo ? undefined : 'nessun testo (forse è una scansione)' };
  } finally { compito.destroy(); }
}

/** Disegna in un canvas la parte alta della prima pagina (per l'anteprima prima/dopo). */
export async function disegnaAnteprima(dati, canvas, { quota = 0.24, larghezza = 560 } = {}) {
  const lib = await lettore();
  const compito = lib.getDocument({ data: dati instanceof Uint8Array ? dati.slice() : new Uint8Array(await dati.arrayBuffer()), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
  try {
    const doc = await compito.promise;
    const pg = await doc.getPage(1);
    const base = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: larghezza * Math.min(2, window.devicePixelRatio || 1) / base.width });
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height * quota);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
  } finally { compito.destroy(); }
}
