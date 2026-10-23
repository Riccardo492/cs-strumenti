// Raccolta di file scelti o trascinati dall'utente: file singoli, cartelle intere e archivi ZIP.
// Ogni elemento restituito: { id, nome, base, ext, cartella, blob, dimensione }.

let contatore = 0;
const SPAZZATURA = n => /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)/i.test(n) || /(^|\/)\._/.test(n);

function elemento(blob, percorso) {
  const pulito = percorso.replace(/^\/+/, '');
  const i = pulito.lastIndexOf('/');
  const nome = pulito.slice(i + 1), cartella = i >= 0 ? pulito.slice(0, i) : '';
  const p = nome.lastIndexOf('.');
  return { id: 'f' + (++contatore), nome, base: p > 0 ? nome.slice(0, p) : nome, ext: p > 0 ? nome.slice(p + 1).toLowerCase() : '', cartella, blob, dimensione: blob.size };
}

/** Legge le voci di una cartella trascinata (API FileSystemEntry). */
async function leggiVoce(voce, out) {
  if (voce.isFile) {
    const f = await new Promise((res, rej) => voce.file(res, rej));
    out.push({ blob: f, percorso: voce.fullPath || f.name });
  } else if (voce.isDirectory) {
    const lettore = voce.createReader();
    let lotto;
    do {
      lotto = await new Promise((res, rej) => lettore.readEntries(res, rej));
      for (const v of lotto) await leggiVoce(v, out);
    } while (lotto.length);
  }
}

/**
 * @param {DataTransfer|FileList|File[]} sorgente
 * @param {{ accetta?: (ext: string) => boolean, apriZip?: boolean }} opzioni
 * @returns {Promise<{ accettati: object[], ignorati: number }>}
 */
export async function raccogliFile(sorgente, { accetta = () => true, apriZip = true } = {}) {
  const grezzi = [];
  if (sorgente && sorgente.items && typeof sorgente.items[0]?.webkitGetAsEntry === 'function') {
    const voci = [...sorgente.items].map(it => it.kind === 'file' && it.webkitGetAsEntry()).filter(Boolean);
    for (const v of voci) await leggiVoce(v, grezzi);
  } else {
    for (const f of (sorgente.files || sorgente)) grezzi.push({ blob: f, percorso: f.webkitRelativePath || f.name });
  }
  const accettati = []; let ignorati = 0;
  for (const g of grezzi) {
    if (SPAZZATURA(g.percorso)) continue;
    const ext = (g.percorso.split('.').pop() || '').toLowerCase();
    if (apriZip && ext === 'zip') {
      let zip;
      try { zip = await JSZip.loadAsync(g.blob); } catch (e) { ignorati++; continue; }
      const radice = g.percorso.replace(/\.zip$/i, '');
      for (const [nome, voce] of Object.entries(zip.files)) {
        if (voce.dir || SPAZZATURA(nome)) continue;
        const e = (nome.split('.').pop() || '').toLowerCase();
        if (!accetta(e)) { ignorati++; continue; }
        accettati.push(elemento(await voce.async('blob'), radice.split('/').pop() + '/' + nome));
      }
      continue;
    }
    if (!accetta(ext)) { ignorati++; continue; }
    accettati.push(elemento(g.blob, g.percorso));
  }
  return { accettati, ignorati };
}

/** Dimensione leggibile: 12,4 MB */
export function fmtDimensione(b) {
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return b.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' ' + u[i];
}
