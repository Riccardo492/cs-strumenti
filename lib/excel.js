// Lettura di file Excel (.xlsx/.xlsm) e CSV direttamente nel browser, senza librerie dedicate.
// Un .xlsx è un archivio ZIP di file XML: lo apriamo con JSZip (caricato in index.html).
import { norm, isEmpty, clean } from './formati.js';

/**
 * Legge un file scelto dall'utente.
 * @returns {Promise<{fogli: {nome: string, righe: any[][]}[], date1904: boolean}>}
 *   Ogni cella è un numero, un testo o "" se vuota.
 */
export async function leggiFoglio(file) {
  const ext = (file.name || '').toLowerCase().split('.').pop();
  if (ext === 'xls') throw new Error('Il formato .xls (Excel 97-2003) non è supportato. In Excel usa File › Salva con nome › Cartella di lavoro di Excel (.xlsx) e ricarica il file.');
  if (ext === 'ods') throw new Error('Il formato .ods non è supportato. Salvalo come .xlsx e ricaricalo.');
  if (ext === 'csv' || ext === 'txt') return { fogli: [{ nome: 'CSV', righe: parseCsv(await decodificaTesto(file)) }], date1904: false };
  let zip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
  catch (e) { throw new Error('Non riesco ad aprire il file: non sembra un file Excel .xlsx valido.'); }
  return leggiXlsx(zip);
}

async function decodificaTesto(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('\uFFFD')) t = new TextDecoder('windows-1252').decode(buf); // CSV salvati da Excel in italiano
  return t.replace(/^﻿/, '');
}

export function parseCsv(text) {
  const prima = text.split(/\r?\n/, 1)[0] || '';
  const conta = ch => prima.split(ch).length - 1;
  const sep = [';', ',', '\t'].sort((a, b) => conta(b) - conta(a))[0];
  const righe = []; let riga = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { riga.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; riga.push(cur); righe.push(riga); riga = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || riga.length) { riga.push(cur); righe.push(riga); }
  return righe;
}

const X = (el, tag) => Array.from(el.getElementsByTagNameNS('*', tag));

async function leggiXlsx(zip) {
  const xml = async p => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const wb = await xml('xl/workbook.xml');
  if (!wb) throw new Error('Il file non contiene fogli di lavoro leggibili.');
  const pr = X(wb, 'workbookPr')[0];
  const date1904 = !!pr && ['1', 'true'].includes(pr.getAttribute('date1904'));
  const rels = await xml('xl/_rels/workbook.xml.rels');
  const relMap = {};
  if (rels) for (const r of X(rels, 'Relationship')) relMap[r.getAttribute('Id')] = r.getAttribute('Target');
  const sst = [];
  const ss = await xml('xl/sharedStrings.xml');
  if (ss) for (const si of X(ss, 'si')) sst.push(X(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''));
  const fogli = [];
  for (const sh of X(wb, 'sheet')) {
    const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    let target = relMap[rid]; if (!target) continue;
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const doc = await xml(target); if (!doc) continue;
    const righe = [];
    let rIdx = -1;
    for (const r of X(doc, 'row')) {
      const ra = r.getAttribute('r'); rIdx = ra ? +ra - 1 : rIdx + 1;
      const out = []; let cIdx = -1;
      for (const c of X(r, 'c')) {
        const ref = c.getAttribute('r');
        if (ref) { cIdx = 0; for (const ch of ref.replace(/\d+/g, '')) cIdx = cIdx * 26 + ch.charCodeAt(0) - 64; cIdx--; } else cIdx++;
        const t = c.getAttribute('t'); const vEl = X(c, 'v')[0]; const raw = vEl ? vEl.textContent : '';
        let v;
        if (t === 's') v = sst[+raw] ?? '';
        else if (t === 'inlineStr') v = X(c, 't').map(x => x.textContent).join('');
        else if (t === 'str' || t === 'e' || t === 'd') v = raw;
        else if (t === 'b') v = raw === '1' ? 'VERO' : 'FALSO';
        else v = raw === '' ? '' : Number(raw);
        out[cIdx] = v;
      }
      for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = '';
      righe[rIdx] = out;
    }
    for (let i = 0; i < righe.length; i++) if (!righe[i]) righe[i] = [];
    fogli.push({ nome: sh.getAttribute('name') || 'Foglio', righe });
  }
  if (!fogli.length) throw new Error('Il file non contiene fogli di lavoro leggibili.');
  return { fogli, date1904 };
}

/* ---------- riconoscimento delle colonne ----------
   `campi` è un elenco di { k: 'chiave', syn: ['intestazione possibile', ...] } con sinonimi già normalizzati. */

/** Trova la riga delle intestazioni tra le prime 15: quella con più nomi di colonna riconosciuti. */
export function trovaIntestazione(righe, campi) {
  let best = -1, bi = 0;
  for (let i = 0; i < Math.min(righe.length, 15); i++) {
    let s = 0; const visti = new Set();
    for (const h of righe[i] || []) {
      const n = norm(h); if (!n) continue;
      for (const f of campi) if (!visti.has(f.k) && f.syn.includes(n)) { s++; visti.add(f.k); break; }
    }
    if (s > best) { best = s; bi = i; }
  }
  if (best <= 0) { bi = righe.findIndex(r => r && r.some(c => !isEmpty(c))); if (bi < 0) bi = 0; }
  return bi;
}

/** Distanza tra due testi in lettere da cambiare, contando come una sola le lettere scambiate (cognome/congome = 1). */
export function distanza(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}

/**
 * Abbina ogni campo alla prima colonna con un'intestazione tra i suoi sinonimi. → { chiave: indiceColonna }
 * Poi, per i campi rimasti senza colonna, accetta anche intestazioni con un errore di battitura
 * («CONGOME» → cognome): una lettera sbagliata o scambiata, due per i nomi lunghi. Solo su sinonimi di 6+ lettere.
 */
export function abbinaColonne(intestazioni, campi, { tollerante = true } = {}) {
  const map = {}; const usate = new Set();
  const ns = intestazioni.map(norm);
  for (const f of campi) {
    for (const syn of f.syn) {
      const i = ns.findIndex((n, j) => n === syn && !usate.has(j));
      if (i >= 0) { map[f.k] = i; usate.add(i); break; }
    }
  }
  if (tollerante) for (const f of campi) {
    if (map[f.k] != null) continue;
    for (const syn of f.syn) {
      if (syn.length < 6) continue;
      const max = syn.length >= 9 ? 2 : 1;
      const i = ns.findIndex((n, j) => n && !usate.has(j) && Math.abs(n.length - syn.length) <= max && distanza(n, syn) <= max);
      if (i >= 0) { map[f.k] = i; usate.add(i); break; }
    }
  }
  return map;
}

/** Intestazioni di una riga, allungate alla larghezza massima del foglio. */
export function intestazioni(righe, idx) {
  const h = righe[idx] || [];
  let w = 0; for (const r of righe) w = Math.max(w, r ? r.length : 0);
  return Array.from({ length: w }, (_, i) => clean(h[i]));
}

/** Righe → testo CSV con il punto e virgola, leggibile da Excel in italiano (con BOM). */
export function scriviCsv(righe) {
  const cella = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + righe.map(r => r.map(cella).join(';')).join('\r\n');
}
