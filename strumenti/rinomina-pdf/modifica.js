// Modifica del testo dentro i PDF: sostituisce un'etichetta e il valore che la segue sulla stessa riga
// (per esempio «ID Elaborato: chj56eich») con un testo nuovo (per esempio «Codice domanda: 884512»),
// nell'intestazione in cima a ogni pagina e, se richiesto, anche nel corpo del documento.
//
// Il testo vecchio viene tolto davvero dal contenuto della pagina, non solo coperto; quello nuovo
// viene scritto nella stessa posizione e dimensione, con un carattere standard simile all'originale
// (Helvetica al posto di Arial/Calibri, Times al posto di Cambria/Times, grassetto se lo era).
// Funziona con i PDF che scrivono il testo come caratteri normali (per esempio quelli salvati da Word).
// Usa pdf-lib, caricata da jsDelivr solo quando serve.

const URL_PDFLIB = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
let promessa = null;
function pdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!promessa) {
    promessa = new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = URL_PDFLIB; s.async = true;
      s.onload = () => window.PDFLib ? ok(window.PDFLib) : ko(new Error('Libreria PDF non disponibile.'));
      s.onerror = () => { promessa = null; s.remove(); ko(new Error('Non riesco a caricare la libreria per modificare i PDF: serve la connessione a internet.')); };
      document.head.appendChild(s);
    });
  }
  return promessa;
}

/* ---------- lettura del contenuto delle pagine ---------- */
const SPAZIO = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([...'()<>[]{}/%'].map(c => c.charCodeAt(0)));
const winAnsi = new TextDecoder('windows-1252');

function daByte(b) { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return s; }
function aByte(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }

/** Spezza un flusso di contenuto PDF in elementi: stringhe, numeri, nomi, operatori… con la loro posizione. */
export function tokenizza(s) {
  const out = []; const n = s.length; let i = 0;
  while (i < n) {
    const c = s.charCodeAt(i);
    if (SPAZIO.has(c)) { i++; continue; }
    if (c === 37) { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; continue; }          // % commento
    const a = i;
    if (c === 40) {                                                                              // ( stringa )
      let liv = 1; i++;
      while (i < n && liv) { const ch = s[i]; if (ch === '\\') i += 2; else { if (ch === '(') liv++; else if (ch === ')') liv--; i++; } }
      out.push({ t: 'str', a, b: i, v: s.slice(a + 1, i - 1) }); continue;
    }
    if (c === 60) {
      if (s[i + 1] === '<') { out.push({ t: '<<', a, b: i + 2 }); i += 2; continue; }
      const z = s.indexOf('>', i); const fine = z < 0 ? n : z + 1;
      out.push({ t: 'hex', a, b: fine, v: s.slice(i + 1, fine - 1) }); i = fine; continue;
    }
    if (c === 62 && s[i + 1] === '>') { out.push({ t: '>>', a, b: i + 2 }); i += 2; continue; }
    if (c === 91 || c === 93 || c === 123 || c === 125) { out.push({ t: s[i], a, b: i + 1 }); i++; continue; }
    if (c === 47) { i++; while (i < n && !SPAZIO.has(s.charCodeAt(i)) && !DELIM.has(s.charCodeAt(i))) i++; out.push({ t: 'name', a, b: i, v: s.slice(a + 1, i) }); continue; }
    while (i < n && !SPAZIO.has(s.charCodeAt(i)) && !DELIM.has(s.charCodeAt(i))) i++;
    if (i === a) { i++; continue; }
    const w = s.slice(a, i);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) out.push({ t: 'num', a, b: i, v: parseFloat(w) });
    else {
      out.push({ t: 'op', a, b: i, v: w });
      if (w === 'ID') { const re = /\sEI(?=\s|$)/g; re.lastIndex = i; const m = re.exec(s); i = m ? m.index + 3 : n; } // immagine in linea
    }
  }
  return out;
}

function letterale(v) {
  let o = '';
  for (let i = 0; i < v.length; i++) {
    const ch = v[i];
    if (ch !== '\\') { o += ch; continue; }
    const x = v[++i];
    if (x === 'n') o += '\n'; else if (x === 'r') o += '\r'; else if (x === 't') o += '\t'; else if (x === 'b') o += '\b'; else if (x === 'f') o += '\f';
    else if (x >= '0' && x <= '7') { let ott = x; while (ott.length < 3 && v[i + 1] >= '0' && v[i + 1] <= '7') ott += v[++i]; o += String.fromCharCode(parseInt(ott, 8) & 255); }
    else if (x === '\r') { if (v[i + 1] === '\n') i++; }
    else if (x !== '\n' && x !== undefined) o += x;
  }
  return o;
}
const daHex = h => { h = h.replace(/\s+/g, ''); if (h.length % 2) h += '0'; let o = ''; for (let i = 0; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return o; };
const decodifica = bin => winAnsi.decode(aByte(bin));

/** Blocchi di testo (da BT a ET) con testo, posizione, carattere e se stanno nell'intestazione di pagina. */
export function blocchiDiTesto(tok, s) {
  const blocchi = []; let cur = null, ops = [];
  const mc = []; let font = null, size = 0, lm = [1, 0, 0, 1, 0, 0], tl = 0;
  for (const x of tok) {
    if (x.t !== 'op') { ops.push(x); continue; }
    const op = x.v, num = i => (ops.filter(o => o.t === 'num')[i] || {}).v || 0;
    if (op === 'BDC' || op === 'BMC') {
      const testo = s.slice(ops.length ? ops[0].a : x.a, x.a);
      mc.push((/^\s*\/Artifact\b/.test(testo) && /\/Header\b/.test(testo)) || (mc.length > 0 && mc[mc.length - 1]));
    } else if (op === 'EMC') mc.pop();
    else if (op === 'Tf') { font = (ops.find(o => o.t === 'name') || {}).v || font; size = num(0); }
    else if (op === 'BT') { cur = { a: x.a, testo: '', x: null, y: null, size: 0, font: null, intestazione: mc.some(Boolean) }; lm = [1, 0, 0, 1, 0, 0]; }
    else if (op === 'ET') { if (cur) { cur.b = x.b; blocchi.push(cur); cur = null; } }
    else if (op === 'Tm') lm = [num(0), num(1), num(2), num(3), num(4), num(5)];
    else if (op === 'Td' || op === 'TD') { const tx = num(0), ty = num(1); lm = [lm[0], lm[1], lm[2], lm[3], lm[4] + tx * lm[0] + ty * lm[2], lm[5] + tx * lm[1] + ty * lm[3]]; if (op === 'TD') tl = -ty; }
    else if (op === 'TL') tl = num(0);
    else if (op === 'T*') lm = [lm[0], lm[1], lm[2], lm[3], lm[4] - tl * lm[2], lm[5] - tl * lm[3]];
    else if (cur && (op === 'Tj' || op === 'TJ' || op === "'" || op === '"')) {
      if (cur.x === null) { cur.x = lm[4]; cur.y = lm[5]; cur.size = size * (Math.hypot(lm[2], lm[3]) || 1); cur.font = font; }
      for (const o of ops) {
        if (o.t === 'str') cur.testo += decodifica(letterale(o.v));
        else if (o.t === 'hex') cur.testo += decodifica(daHex(o.v));
        else if (o.t === 'num' && op === 'TJ' && o.v < -250) cur.testo += ' ';
      }
    }
    ops = [];
  }
  return blocchi;
}

const compatta = t => t.toLowerCase().replace(/\s+/g, '');
/** Toglie l'etichetta dall'inizio del testo, ignorando spazi e maiuscole. */
function dopoEtichetta(testo, etichetta) {
  const e = compatta(etichetta); let k = 0, i = 0;
  while (i < testo.length && k < e.length) { if (/\s/.test(testo[i])) { i++; continue; } if (testo[i].toLowerCase() !== e[k]) return null; i++; k++; }
  return k === e.length ? testo.slice(i).trim() : null;
}

/** Dove compare l'etichetta e quali blocchi vanno tolti (etichetta + valore sulla stessa riga). */
export function trovaOccorrenze(blocchi, etichetta) {
  const occ = [];
  if (!compatta(etichetta)) return occ;
  for (let i = 0; i < blocchi.length; i++) {
    const b = blocchi[i];
    if (b.x === null) continue;
    const resto = dopoEtichetta(b.testo, etichetta);
    if (resto === null) continue;
    const o = { rimuovi: [i], x: b.x, y: b.y, size: b.size, font: b.font, intestazione: b.intestazione, valore: resto, xValore: null };
    if (!resto) {
      for (let j = i + 1; j < Math.min(blocchi.length, i + 8); j++) {
        const c = blocchi[j];
        if (c.x === null || Math.abs(c.y - b.y) > 1.5 || c.x < b.x) break;
        o.rimuovi.push(j);
        if (!c.testo.trim()) continue;
        o.valore = c.testo.trim(); o.xValore = c.x; o.sizeValore = c.size; o.fontValore = c.font;
        break;
      }
    }
    occ.push(o);
    i = o.rimuovi[o.rimuovi.length - 1];
  }
  return occ;
}

function contenutoPagina(L, doc, pagina) {
  const c = pagina.node.Contents();
  if (!c) return null;
  const flussi = c instanceof L.PDFArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
  let s = '';
  for (const f of flussi) {
    if (f instanceof L.PDFRawStream) s += daByte(L.decodePDFRawStream(f).decode()) + '\n';
    else if (f && typeof f.getContents === 'function') s += daByte(f.getContents()) + '\n';
    else return null;
  }
  return s;
}
function nomeFont(L, pagina, risorsa) {
  try {
    const res = pagina.node.Resources(); const fonts = res && res.lookup(L.PDFName.of('Font'));
    const f = fonts && fonts.lookup(L.PDFName.of(risorsa));
    const b = f && f.lookup(L.PDFName.of('BaseFont'));
    return b ? b.decodeText ? b.decodeText() : String(b).replace(/^\//, '') : '';
  } catch (e) { return ''; }
}
function fontSimile(base) {
  const g = /bold|black|heavy|semibold|demi/i.test(base), c = /italic|oblique/i.test(base);
  if (/courier|mono|consol/i.test(base)) return ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'][(g ? 1 : 0) + (c ? 2 : 0)];
  if (/arial|helvetica|calibri|verdana|tahoma|segoe|sans|gothic|futura|roboto|open|aptos|lato/i.test(base)) return ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'][(g ? 1 : 0) + (c ? 2 : 0)];
  return ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'][(g ? 1 : 0) + (c ? 2 : 0)];
}
/** Sostituisce i caratteri che il carattere standard non sa scrivere. */
function scrivibile(testo, font) {
  let o = '';
  for (const ch of testo) {
    try { font.encodeText(ch); o += ch; }
    catch (e) { const s = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); try { font.encodeText(s); o += s; } catch (e2) { o += '?'; } }
  }
  return o;
}

async function apri(L, blob) {
  try { return await L.PDFDocument.load(await blob.arrayBuffer(), { updateMetadata: false }); }
  catch (e) { const m = String(e && e.message || e); throw new Error(/encrypt/i.test(m) ? 'protetto da password' : 'non si apre come PDF'); }
}

/** Conta dove compare l'etichetta. → { pagine, occorrenze: [{ pagina, intestazione, valore }] } */
export async function analizzaPdf(blob, etichetta) {
  const L = await pdfLib();
  const doc = await apri(L, blob);
  const occorrenze = [];
  doc.getPages().forEach((pg, n) => {
    const s = contenutoPagina(L, doc, pg); if (s == null) return;
    for (const o of trovaOccorrenze(blocchiDiTesto(tokenizza(s), s), etichetta)) occorrenze.push({ pagina: n + 1, intestazione: o.intestazione, valore: o.valore });
  });
  return { pagine: doc.getPageCount(), occorrenze };
}

/**
 * Sostituisce etichetta + valore con `nuovo` («Codice domanda: 884512»).
 * Se il nuovo testo contiene «:» e l'originale aveva il valore staccato dall'etichetta, il valore va nella stessa colonna.
 * @returns {Promise<{ bytes: Uint8Array|null, sostituite: number }>}
 */
export async function modificaPdf(blob, { etichetta, nuovo, corpo = true }) {
  const L = await pdfLib();
  const doc = await apri(L, blob);
  const fonts = {};
  const font = async k => (fonts[k] = fonts[k] || await doc.embedFont(L.StandardFonts[k]));
  const nero = L.rgb(0, 0, 0);
  let sostituite = 0;
  for (const pg of doc.getPages()) {
    const s = contenutoPagina(L, doc, pg); if (s == null) continue;
    const blocchi = blocchiDiTesto(tokenizza(s), s);
    const occ = trovaOccorrenze(blocchi, etichetta).filter(o => corpo || o.intestazione);
    if (!occ.length) continue;
    const tagli = occ.flatMap(o => o.rimuovi.map(i => blocchi[i])).sort((a, b) => a.a - b.a);
    let nuovoS = '', pos = 0;
    for (const t of tagli) { if (t.a >= pos) { nuovoS += s.slice(pos, t.a); pos = t.b; } }
    nuovoS += s.slice(pos);
    pg.node.set(L.PDFName.of('Contents'), doc.context.register(doc.context.flateStream(aByte('q\n' + nuovoS + '\nQ\n'))));
    for (const o of occ) {
      const f = await font(fontSimile(nomeFont(L, pg, o.font)));
      const testo = scrivibile(nuovo, f);
      const m = /^(.*?:)\s*(\S.*)$/.exec(testo);
      // Se il testo nuovo è più lungo della riga: prima il valore si avvicina all'etichetta e la riga
      // si sposta verso sinistra (o si ricentra, per le intestazioni); solo se non basta il carattere si rimpicciolisce.
      const W = pg.getWidth(), sinistra = Math.min(o.x, 54), destra = W - 40;
      if (m && o.xValore != null) {
        const fv = o.fontValore ? await font(fontSimile(nomeFont(L, pg, o.fontValore))) : f;
        const et = m[1], val = scrivibile(m[2], fv);
        let sz = o.size, szv = o.sizeValore || o.size;
        const largh = (s1, s2) => ({ et: f.widthOfTextAtSize(et, s1), sp: f.widthOfTextAtSize(o.intestazione ? '  ' : ' ', s1), val: fv.widthOfTextAtSize(val, s2) });
        let w = largh(sz, szv);
        let x = o.x, xv = Math.max(o.xValore, o.x + w.et + w.sp);
        if (xv + w.val > destra) {
          const tot = w.et + w.sp + w.val;
          if (tot <= destra - sinistra) {
            x = o.intestazione ? Math.max(sinistra, (W - tot) / 2) : Math.max(sinistra, Math.min(o.x, destra - tot));
          } else {
            const k = (destra - sinistra) / tot; sz *= k; szv *= k; w = largh(sz, szv); x = sinistra;
          }
          xv = x + w.et + w.sp;
        }
        pg.drawText(et, { x, y: o.y, size: sz, font: f, color: nero });
        pg.drawText(val, { x: xv, y: o.y, size: szv, font: fv, color: nero });
      } else {
        let sz = o.size, x = o.x, w = f.widthOfTextAtSize(testo, sz);
        if (x + w > destra) { if (w <= destra - sinistra) x = Math.max(sinistra, destra - w); else { sz *= (destra - sinistra) / w; x = sinistra; } }
        pg.drawText(testo, { x, y: o.y, size: sz, font: f, color: nero });
      }
      sostituite++;
    }
  }
  return { bytes: sostituite ? await doc.save() : null, sostituite };
}
