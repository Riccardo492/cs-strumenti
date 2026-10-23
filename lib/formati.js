// Funzioni di utilità su testi, numeri e date, condivise da tutte le funzioni.

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const isEmpty = v => v == null || (typeof v === 'string' && v.trim() === '');
export const clean = v => isEmpty(v) ? '' : String(v).replace(/[\s ]+/g, ' ').trim();
export const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const pad2 = n => String(n).padStart(2, '0');

/** Indice di colonna (0 = A) → lettera Excel. */
export function colLetter(i) {
  let s = ''; i++;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/** Centesimi → "1.234,56". */
export function fmtNum(c) {
  const neg = c < 0; c = Math.abs(c);
  const e = Math.floor(c / 100), d = c % 100;
  return (neg ? '-' : '') + String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + pad2(d);
}
/** Centesimi → "€ 1.234,56". */
export const fmtEuro = c => '€ ' + fmtNum(c);

/** Importo da cella o testo → centesimi; null se vuoto, NaN se non leggibile. */
export function parseMoney(v) {
  if (isEmpty(v)) return null;
  if (typeof v === 'number') return Math.round(v * 100);
  let s = String(v).replace(/[€\s ]|eur(o)?/gi, '');
  if (s === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

/** Data da cella Excel (numero seriale), testo o ISO → "gg/mm/aaaa"; altrimenti il testo così com'è. */
export function parseDate(v, date1904 = false) {
  if (isEmpty(v)) return '';
  if (typeof v === 'number') {
    if (v > 0 && v < 2958466) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round((v + (date1904 ? 1462 : 0)) * 86400) * 1000);
      return pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
    }
    return String(v);
  }
  const s = clean(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return pad2(m[3]) + '/' + pad2(m[2]) + '/' + m[1];
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (m) {
    let y = +m[3];
    if (m[3].length === 2) { const now = new Date().getFullYear() % 100; y += y > now ? 1900 : 2000; }
    return pad2(m[1]) + '/' + pad2(m[2]) + '/' + y;
  }
  return s;
}
/** "gg/mm/aaaa" → "aaaammgg" per ordinare. */
export const dateKey = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? m[3] + m[2] + m[1] : ''; };
/** Valore di <input type="date"> → "gg/mm/aaaa". */
export const isoToIt = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
export const oggiIt = (sep = '-') => { const d = new Date(); return pad2(d.getDate()) + sep + pad2(d.getMonth() + 1) + sep + d.getFullYear(); };

export const titleCase = s => s.toLocaleLowerCase('it-IT').replace(/(^|[\s'’\-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('it-IT'));
/** Toglie i caratteri non ammessi nei nomi di file. */
export const safeName = s => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();
