// Rinomina PDF: composizione dei nuovi nomi, abbinamento con l'Excel, doppioni.
import { norm, clean, pad2, parseDate } from '../../lib/formati.js';
import { cfOk } from '../../lib/controlli.js';

/* Segnaposto sempre disponibili e quelli che arrivano dalla lettura dei PDF.
   Le colonne dell'Excel collegato diventano segnaposto con il nome dell'intestazione: {COGNOME}, {ID ELABORATO}… */
export const SEGNAPOSTO_FILE = [
  { t: 'file', d: 'nome attuale, senza .pdf' },
  { t: 'n', d: 'numero progressivo' },
  { t: 'cartella', d: 'cartella di provenienza' },
  { t: 'oggi', d: 'data di oggi (aaaa-mm-gg)' },
];
export const SEGNAPOSTO_PDF = [
  { t: 'pdf:cf', d: 'codice fiscale trovato nel PDF' },
  { t: 'pdf:testo', d: 'testo trovato con la regola di ricerca' },
  { t: 'pdf:pagine', d: 'numero di pagine' },
];

export const OPZIONI_BASE = { maiuscole: 'come', spazi: '_', accenti: true, cerca: '', sostituisci: '', inizio: 1, cifre: 0, cartelle: false };

const oggi = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ripulisce un nome di file secondo le opzioni. */
export function pulisci(s, o) {
  if (o.cerca) s = s.replace(new RegExp(escRe(o.cerca), 'gi'), o.sostituisci || '');
  s = s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ');
  if (o.accenti) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`´]/g, '').replace(/[^A-Za-z0-9 _.\-()]/g, ' ');
  s = s.replace(/\s+/g, o.spazi === 'lascia' ? ' ' : o.spazi);
  if (o.maiuscole === 'su') s = s.toLocaleUpperCase('it-IT'); else if (o.maiuscole === 'giu') s = s.toLocaleLowerCase('it-IT');
  s = s.replace(/([_\-. ])\1+/g, '$1').replace(/[_\-. ]*([_\-.])[_\-. ]*/g, '$1').replace(/^[_\-. ]+|[_\-. ]+$/g, '');
  return s.slice(0, 150);
}

/* ---------- abbinamento con l'Excel ---------- */
export const MODI_ABBINAMENTO = [
  { v: 'nome-uguale', d: 'il nome del file è uguale al valore' },
  { v: 'nome-contiene', d: 'il nome del file contiene il valore' },
  { v: 'pdf-contiene', d: 'il testo del PDF contiene il valore' },
  { v: 'ordine', d: "in ordine: 1ª riga = 1° file" },
];
const chiave = v => { let s = norm(v).replace(/\s+/g, ''); if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, ''); return s; };

/**
 * Abbina ogni file a una riga dell'Excel. → Map(idFile → { riga, ambiguo })
 * @param {object[]} file   elenco ordinato
 * @param {any[][]} righe   righe dati dell'Excel (senza intestazione)
 * @param {string} modo
 * @param {number} col      colonna chiave
 * @param {Map} testi       testo letto dai PDF (id → { testo })
 */
export function abbina(file, righe, modo, col, testi) {
  const esito = new Map();
  if (modo === 'ordine') { file.forEach((f, i) => { if (i < righe.length) esito.set(f.id, { riga: i, ambiguo: false }); }); return esito; }
  const valori = righe.map(r => clean(r[col]));
  const chiavi = valori.map(chiave);
  for (const f of file) {
    let migliori = [], lung = 0;
    if (modo === 'nome-uguale') {
      const k = chiave(f.base);
      chiavi.forEach((c, i) => { if (c && c === k) migliori.push(i); });
    } else if (modo === 'nome-contiene') {
      const nome = f.base;
      valori.forEach((v, i) => {
        if (!v) return;
        let ok;
        if (/^\d+$/.test(v)) ok = new RegExp('(^|\\D)0*' + v.replace(/^0+(?=\d)/, '') + '(\\D|$)').test(nome);
        else { const c = chiavi[i]; ok = c.length >= 3 && chiave(nome).includes(c); }
        if (!ok) return;
        if (v.length > lung) { lung = v.length; migliori = [i]; } else if (v.length === lung) migliori.push(i);
      });
    } else if (modo === 'pdf-contiene') {
      const t = testi.get(f.id);
      if (t && t.testo) {
        const kt = chiave(t.testo);
        chiavi.forEach((c, i) => { if (c.length >= 4 && kt.includes(c)) { if (c.length > lung) { lung = c.length; migliori = [i]; } else if (c.length === lung) migliori.push(i); } });
      }
    }
    if (migliori.length) esito.set(f.id, { riga: migliori[0], ambiguo: new Set(migliori.map(i => chiavi[i])).size > 1 || migliori.length > 1 });
  }
  return esito;
}

/** Sceglie colonna e modo di abbinamento che abbinano più file. */
export function abbinamentoMigliore(file, righe, intest, testi) {
  let best = { modo: 'nome-uguale', col: 0, n: 0 };
  for (const modo of ['nome-uguale', 'nome-contiene', 'pdf-contiene']) {
    for (let c = 0; c < intest.length; c++) {
      const n = abbina(file, righe, modo, c, testi).size;
      if (n > best.n) best = { modo, col: c, n };
    }
    if (best.n) break;
  }
  return best;
}

/** Modello di nome proposto in base alle colonne dell'Excel. */
export function modelloSuggerito(intest) {
  const trova = (...nomi) => intest.find(h => nomi.includes(norm(h)));
  const nuovo = trova('nuovo nome', 'nome nuovo', 'nuovo nome file', 'rinomina in');
  if (nuovo) return `{${nuovo}}`;
  const cognome = trova('cognome', 'last name'), nome = trova('nome', 'first name'), cf = trova('codice fiscale', 'cf');
  if (cognome && nome) return `{${cognome}}_{${nome}}` + (cf ? `_{${cf}}` : '');
  const nom = trova('nominativo', 'cognome e nome', 'cognome nome');
  if (nom) return `{${nom}}` + (cf ? `_{${cf}}` : '');
  return null;
}

/* ---------- ricerca nel testo dei PDF ---------- */
const RE_CF = /(?<![A-Z0-9])[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z](?![A-Z0-9])/g;
export function trovaCf(testo) {
  const t = (testo || '').toUpperCase();
  let tutti = [...new Set(t.match(RE_CF) || [])].filter(cfOk);
  if (!tutti.length) tutti = [...new Set(t.replace(/\s+/g, '').match(/[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]/g) || [])].filter(cfOk);
  return tutti;
}
/** Testo trovato con la regola scelta: dopo un'etichetta, o con un'espressione regolare. */
export function trovaTesto(testo, { cosa, etichetta, parole, regex }) {
  if (!testo) return '';
  try {
    if (cosa === 'etichetta' && etichetta) {
      const m = new RegExp(escRe(etichetta.trim()) + '\\s*[:.\\-–]?\\s*((?:\\S+\\s*){1,' + Math.max(1, Math.min(8, +parole || 1)) + '})', 'i').exec(testo);
      return m ? m[1].trim() : '';
    }
    if (cosa === 'regex' && regex) {
      const m = new RegExp(regex, 'i').exec(testo);
      return m ? (m[1] ?? m[0]).trim() : '';
    }
  } catch (e) { return ''; }
  return '';
}

/* ---------- calcolo dei nuovi nomi ---------- */
/**
 * @returns {{ risultati: { id, nuovo, stato: 'ok'|'uguale'|'doppione'|'vuoto'|'escluso'|'manuale', note: string[], riga: number|null }[], sconosciuti: string[] }}
 */
export function calcolaNomi({ file, modello, opz, excel, abbinati, testi, pdf, manuali, esclusi, mod }) {
  const intestN = excel ? excel.intestazioni.map(h => norm(h)) : [];
  const nom = colonneNominativo(intestN);
  const totali = file.length;
  const cifre = opz.cifre || String((+opz.inizio || 1) + totali - 1).length;
  const usati = new Map();
  let n = (+opz.inizio || 1) - 1;
  const sconosciuti = new Set();
  const risultati = file.map(f => {
    const note = [];
    if (esclusi.has(f.id)) return { id: f.id, nuovo: f.nome, stato: 'escluso', note: ['Escluso: non va nello ZIP'], riga: null };
    n++;
    const ab = abbinati ? abbinati.get(f.id) : null;
    const riga = ab ? excel.righe[ab.riga] : null;
    const t = testi.get(f.id);
    // valore di un segnaposto per questo file
    const valore = tok => {
      const k = norm(tok);
      if (k === 'file') return f.base;
      if (k === 'n') return String(n).padStart(cifre, '0');
      if (k === 'cartella') return f.cartella.split('/').pop() || '';
      if (k === 'oggi') return oggi();
      if (k === 'pdf cf') return t ? (trovaCf(t.testo)[0] || '') : '';
      if (k === 'pdf testo') return t ? trovaTesto(t.testo, pdf) : '';
      if (k === 'pdf pagine') return t && t.pagine ? String(t.pagine) : '';
      if (k === 'nominativo' && intestN.indexOf(k) < 0) {
        if (!riga) return '';
        return clean(nom.unica >= 0 ? riga[nom.unica] : [riga[nom.cognome], riga[nom.nome]].filter(v => !isEmptyStr(v)).join(' '));
      }
      const c = intestN.indexOf(k);
      if (c >= 0) {
        if (!riga) return '';
        const v = riga[c];
        if (typeof v === 'number' && /data/.test(k)) return parseDate(v).replace(/\//g, '-');
        return clean(typeof v === 'number' && !Number.isInteger(v) ? String(v).replace('.', ',') : v);
      }
      sconosciuti.add(tok);
      return '';
    };
    const base = manuali.has(f.id) ? manuali.get(f.id) : modello.replace(/\{([^{}]+)\}/g, (m, tok) => valore(tok));
    // testo da scrivere dentro il PDF (se la modifica è attiva): stessi segnaposto, nessuna pulizia
    let testoPdf = null, testoPdfIncompleto = false;
    if (mod && mod.attivo && mod.nuovo) {
      testoPdf = mod.nuovo.replace(/\{([^{}]+)\}/g, (m, tok) => { let v = valore(tok); if (!v) testoPdfIncompleto = true; if (mod.maiuscole === 'su') v = v.toLocaleUpperCase('it-IT'); return v; }).replace(/\s+/g, ' ').trim();
      if (testoPdfIncompleto) note.push('Manca un valore per il nuovo testo nel PDF: il PDF resta com\'è');
    }
    let nuovo = pulisci(base, opz);
    let stato = manuali.has(f.id) ? 'manuale' : 'ok';
    if (excel && !manuali.has(f.id) && usaExcel(modello, excel)) {
      if (!ab) note.push("Non trovato nell'Excel");
      else if (ab.ambiguo) note.push("Più righe dell'Excel corrispondono: uso la prima");
    }
    if (!nuovo) { nuovo = f.base; stato = 'vuoto'; note.push('Il nuovo nome sarebbe vuoto: resta quello attuale'); }
    const ext = f.ext ? '.' + (f.ext === 'pdf' ? 'pdf' : f.ext) : '';
    let pieno = nuovo + ext;
    const dove = opz.cartelle ? f.cartella : '';
    const chiaveNome = (dove + '/' + pieno).toLowerCase();
    if (usati.has(chiaveNome)) {
      let k = 2; while (usati.has((dove + '/' + nuovo + '_' + k + ext).toLowerCase())) k++;
      pieno = nuovo + '_' + k + ext; stato = 'doppione'; note.push(`C'era già «${nuovo + ext}»: aggiunto _${k}`);
    }
    usati.set((dove + '/' + pieno).toLowerCase(), true);
    if (stato === 'ok' && pieno === f.nome) stato = 'uguale';
    return { id: f.id, nuovo: pieno, stato, note, riga: ab ? ab.riga : null, testoPdf: testoPdfIncompleto ? null : testoPdf };
  });
  return { risultati, sconosciuti: [...sconosciuti] };
}

const isEmptyStr = v => v == null || String(v).trim() === '';
/** Colonne con cognome e nome (o un'unica colonna «nominativo») nell'Excel collegato. */
export function colonneNominativo(intestN) {
  const trova = nomi => intestN.findIndex(h => nomi.includes(h));
  const unica = trova(['nominativo', 'cognome e nome', 'cognome nome', 'candidato', 'nome completo']);
  const cognome = trova(['cognome', 'last name', 'surname']), nome = trova(['nome', 'first name', 'name']);
  return { unica, cognome, nome, ok: unica >= 0 || (cognome >= 0 && nome >= 0) };
}
/** Il modello usa dati dell'Excel? (colonne o {nominativo}) */
export function usaExcel(modello, excel) {
  if (!excel) return false;
  const m = modello.toLowerCase();
  return m.includes('{nominativo}') || excel.intestazioni.some(h => h && m.includes('{' + h.toLowerCase() + '}'));
}

/** Ordine naturale: file_2 prima di file_10. */
export const ordina = arr => arr.sort((a, b) => (a.cartella + '/' + a.nome).localeCompare(b.cartella + '/' + b.nome, 'it', { numeric: true, sensitivity: 'base' }));
