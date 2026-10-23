// Salvataggio dei file creati e brevi avvisi a schermo.
// Su un sito normale (GitHub Pages, file aperto in locale) usa il download del browser.
// Dentro l'anteprima su claude.ai usa la funzione di salvataggio del visualizzatore.

let promessaDownloads = null;
function downloads() {
  if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(undefined);
  if (!promessaDownloads) promessaDownloads = window.claude.use('downloads').catch(() => null);
  return promessaDownloads;
}
downloads();

/** Offre il file all'utente. Ritorna true se il salvataggio è partito. */
export async function salvaFile(nome, blob) {
  const dl = await downloads();
  if (dl === undefined) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    avviso('Scaricato: ' + nome);
    return true;
  }
  if (!dl) { avviso('Il salvataggio dei file non è disponibile in questa vista.'); return false; }
  try { await dl.save({ filename: nome, data: blob }); avviso('Salvato: ' + nome); return true; }
  catch (e) {
    const code = e && e.code;
    if (code === 'declined') avviso('Salvataggio annullato');
    else if (code === 'rate_limited') avviso("C'è già una richiesta di salvataggio aperta: rispondi a quella e riprova.");
    else avviso('Salvataggio non riuscito' + (code ? ' (' + code + ')' : ''));
    return false;
  }
}

let timer;
export function avviso(msg) {
  const t = document.getElementById('avviso');
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(timer); timer = setTimeout(() => { t.hidden = true; }, 3800);
}

export const base64ToBlob = (b64, type) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
