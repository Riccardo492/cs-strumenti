// Ricevute: campi, calcoli e costruzione delle ricevute a partire dalle righe dell'Excel.
import { isEmpty, clean, fmtNum, fmtEuro, parseMoney, parseDate, dateKey, titleCase, safeName } from '../../lib/formati.js';
import { cfOk, ibanOk } from '../../lib/controlli.js';

/* Campi della ricevuta. `syn` = intestazioni riconosciute (già normalizzate: minuscole, senza accenti).
   `comune` = si può dare un valore unico per tutti nella sezione «Valori comuni». */
export const CAMPI = [
  { k: 'cognome', label: 'Cognome', req: true, syn: ['cognome', 'surname', 'nominativo', 'cognome e nome', 'cognome nome', 'nome e cognome', 'nome cognome', 'collaboratore'] },
  { k: 'nome', label: 'Nome', syn: ['nome', 'name'] },
  { k: 'luogoNascita', label: 'Luogo di nascita', syn: ['luogo di nascita', 'luogo nascita', 'nato a', 'nata a', 'nato a nata a', 'nato a a', 'comune di nascita', 'citta di nascita'] },
  { k: 'dataNascita', label: 'Data di nascita', type: 'date', syn: ['data di nascita', 'data nascita', 'nato il', 'nata il', 'data nasc'] },
  { k: 'residenza', label: 'Comune di residenza', syn: ['comune di residenza', 'residente in', 'residenza', 'citta di residenza', 'comune residenza', 'citta', 'comune'] },
  { k: 'indirizzo', label: 'Indirizzo (via e civico)', syn: ['indirizzo', 'via', 'indirizzo di residenza', 'indirizzo residenza', 'via e civico', 'via civico'] },
  { k: 'cf', label: 'Codice fiscale', req: true, syn: ['codice fiscale', 'cf', 'c f', 'cod fiscale', 'cod fisc', 'codicefiscale'] },
  { k: 'tipoDoc', label: 'Tipo documento', syn: ['tipologia di documento', 'tipologia documento', 'tipo documento', 'tipo di documento', 'documento', 'tipo doc'] },
  { k: 'numDoc', label: 'Numero documento', syn: ['numero di documento', 'numero documento', 'n documento', 'num documento', 'nr documento', 'numero doc', 'n doc'] },
  { k: 'tel', label: 'Telefono', syn: ['tel', 'telefono', 'telefono fisso'] },
  { k: 'cell', label: 'Cellulare', syn: ['cell', 'cellulare', 'mobile', 'numero di cellulare'] },
  { k: 'email', label: 'E-mail', syn: ['email', 'e mail', 'mail', 'indirizzo e mail', 'indirizzo email', 'posta elettronica'] },
  { k: 'iban', label: 'IBAN', syn: ['iban', 'codice iban'] },
  { k: 'mansione', label: 'Mansione svolta', comune: true, syn: ['mansione', 'mansioni', 'mansione i svolta e', 'mansione svolta', 'mansioni svolte', 'ruolo', 'attivita svolta', 'incarico'] },
  { k: 'ente', label: 'Ente', comune: true, syn: ['ente', 'amministrazione', 'ente committente'] },
  { k: 'dataAttivita', label: 'Data attività', type: 'date', comune: true, syn: ['data attivita', 'data', 'data concorso', 'data prova', 'giorno', 'data servizio'] },
  { k: 'tipologia', label: 'Tipologia di concorso', comune: true, syn: ['tipologia di concorso', 'tipologia concorso', 'tipologia', 'tipo concorso', 'modalita', 'tipo di concorso'] },
  { k: 'lordo', label: 'Compenso lordo', type: 'money', syn: ['compenso lordo', 'lordo', 'importo lordo', 'competenze concordate', 'competenze', 'competenze lorde'] },
  { k: 'netto', label: 'Compenso netto', type: 'money', comune: true, syn: ['compenso netto', 'netto', 'importo netto', 'netto a pagare', 'netto a pagare con bonifico'] },
  { k: 'inps', label: 'Trattenuta INPS', type: 'money', syn: ['trattenuta inps', 'inps', 'contributo inps'] },
  { k: 'luogoRic', label: 'Luogo ricevuta', comune: true, syn: ['luogo ricevuta', 'luogo firma', 'luogo', 'luogo di firma'] },
  { k: 'dataRic', label: 'Data ricevuta', type: 'date', comune: true, syn: ['data ricevuta', 'data firma', 'data di firma', 'data documento'] },
];
export const CAMPO = Object.fromEntries(CAMPI.map(f => [f.k, f]));

/* Colonne del modello Excel, con le note mostrate nella sezione «Modello Excel». */
export const COLONNE_MODELLO = [
  ['COGNOME', true, ''], ['NOME', true, ''],
  ['LUOGO DI NASCITA', false, 'Comune di nascita.'], ['DATA DI NASCITA', false, 'gg/mm/aaaa'],
  ['COMUNE DI RESIDENZA', false, ''], ['INDIRIZZO', false, 'Via e civico. Se inizia con Piazza, Viale, Corso… la ricevuta lo scrive al posto di «Via».'],
  ['CODICE FISCALE', true, 'Ne viene controllata la correttezza.'], ['TIPO DOCUMENTO', false, "Es. CARTA D'IDENTITÀ, PATENTE, PASSAPORTO."],
  ['NUMERO DOCUMENTO', false, ''], ['TELEFONO', false, 'Facoltativo.'], ['CELLULARE', false, 'Facoltativo.'], ['EMAIL', false, ''],
  ['IBAN', false, 'Ne viene controllata la correttezza.'],
  ['MANSIONE', false, 'Se è uguale per tutti si può scrivere una volta sola nei «Valori comuni».'],
  ['ENTE', false, 'Es. COMUNE DI SELARGIUS. Può andare nei «Valori comuni».'],
  ['DATA ATTIVITÀ', false, 'Giorno del concorso. Può andare nei «Valori comuni».'],
  ['TIPOLOGIA CONCORSO', false, 'Es. IN PRESENZA. Può andare nei «Valori comuni».'],
  ['COMPENSO LORDO', false, 'Compila il lordo oppure il netto: il resto viene calcolato.'],
  ['COMPENSO NETTO', false, 'Netto a pagare con bonifico.'],
  ['TRATTENUTA INPS', false, 'Solo oltre i 5.000 € annui; viene sottratta dal netto.'],
  ['LUOGO RICEVUTA', false, "Se vuoto: valore comune, oppure il comune dell'ente."],
  ['DATA RICEVUTA', false, "Se vuota: valore comune, oppure la data dell'attività."],
];

/* Righe di esempio: persone inventate, codici fiscali e IBAN di prova. */
export const RIGHE_ESEMPIO = [
  COLONNE_MODELLO.map(c => c[0]),
  ['ROSSI', 'MARIO', 'ROMA', 29221, 'ROMA', 'VIA APPIA NUOVA 120', 'RSSMRA80A01H501U', "CARTA D'IDENTITÀ", 'CA12345AA', '', '3331234567', 'mario.rossi@example.com', 'IT60X0542811101000000123456', "ASSISTENZA D'AULA PER CONCORSO PUBBLICO", 'COMUNE DI SELARGIUS', 46323, 'IN PRESENZA', '', 70, '', '', ''],
  ['BIANCHI', 'LAURA', 'CAGLIARI', 33678, 'SELARGIUS', 'PIAZZA MARTIRI 3', 'BNCLRA92C55B354B', 'PATENTE', 'CA7654321B', '070123456', '', 'laura.bianchi@example.com', 'IT03A0123456789000000123456', "ASSISTENZA D'AULA PER CONCORSO PUBBLICO", 'COMUNE DI SELARGIUS', 46323, 'IN PRESENZA', '', 70, '', '', ''],
  ['VERDI', 'GIOVANNI', "QUARTU SANT'ELENA", 32454, "QUARTU SANT'ELENA", 'VIALE COLOMBO 45', 'VRDGNN88S07H118A', "CARTA D'IDENTITÀ", 'CA1122334', '', '3479876543', 'giovanni.verdi@example.com', 'IT81K0123498765000000654321', "COORDINAMENTO D'AULA PER CONCORSO PUBBLICO", 'COMUNE DI SELARGIUS', 46323, 'IN PRESENZA', 120, '', '', '', ''],
];

/* ---------- calcoli (in centesimi) ---------- */
export const RITENUTA = 0.20;
export const SOGLIA_BOLLO = 7747; // 77,47 €
/** Dal netto: lordo = (netto + INPS) / 0,8; ritenuta = lordo − netto − INPS. */
export function daNetto(netto, inps = 0) { const lordo = Math.round((netto + inps) * 5 / 4); return { lordo, rit: lordo - netto - inps, inps, netto }; }
/** Dal lordo: ritenuta = 20% del lordo; netto = lordo − ritenuta − INPS. */
export function daLordo(lordo, inps = 0) { const rit = Math.round(lordo / 5); return { lordo, rit, inps, netto: lordo - rit - inps }; }

const TOPONIMI = /^(VIA|VIALE|V\.LE|PIAZZA|PIAZZALE|PIAZZETTA|P\.ZZA|P\.ZA|P\.LE|CORSO|C\.SO|LARGO|VICOLO|VICO|STRADA|LOCALIT[AÀ]|LOC\.|CONTRADA|C\.DA|BORGO|FRAZIONE|FRAZ\.|LUNGOMARE|SALITA|RIONE|TRAVERSA|VIOTTOLO)\s+(.+)$/i;
function separaIndirizzo(a) {
  const m = TOPONIMI.exec(a);
  if (!m) return ['Via', a];
  const t = m[1].toLocaleLowerCase('it-IT');
  return [t.charAt(0).toLocaleUpperCase('it-IT') + t.slice(1), m[2]];
}

/**
 * Dalle righe del foglio alle ricevute.
 * @param {object} o
 * @param {any[][]} o.righe          righe del foglio (celle)
 * @param {number}  o.riga           indice della riga delle intestazioni
 * @param {object}  o.mappa          { chiaveCampo: indiceColonna }
 * @param {object}  o.comuni         valori comuni (testi; date in gg/mm/aaaa)
 * @param {{maiuscolo: boolean, raggruppa: boolean}} o.opzioni
 * @param {boolean} o.date1904
 */
export function costruisciRicevute({ righe, riga, mappa, comuni, opzioni, date1904 }) {
  const U = s => opzioni.maiuscolo ? s.toLocaleUpperCase('it-IT') : s;
  const rec = [];
  for (let i = riga + 1; i < righe.length; i++) {
    const r = righe[i] || [];
    const raw = {}; let qualcosa = false;
    for (const f of CAMPI) { const c = mappa[f.k]; raw[f.k] = c == null ? '' : (r[c] ?? ''); if (!isEmpty(raw[f.k])) qualcosa = true; }
    if (!qualcosa) continue;
    const txt = k => { let v = raw[k]; if (isEmpty(v) && CAMPO[k].comune) v = comuni[k]; return clean(v); };
    const dt = k => { let v = raw[k]; if (isEmpty(v) && CAMPO[k].comune) v = comuni[k]; return parseDate(v, date1904); };
    let lordo = parseMoney(raw.lordo), netto = parseMoney(raw.netto);
    if (lordo === null && netto === null) netto = parseMoney(comuni.netto);
    rec.push({
      riga: i + 1,
      cognome: U(txt('cognome')), nome: U(txt('nome')),
      luogoNascita: U(txt('luogoNascita')), dataNascita: dt('dataNascita'),
      residenza: U(txt('residenza')), indirizzo: U(txt('indirizzo')),
      cf: txt('cf').toUpperCase().replace(/[\s.\-]/g, ''),
      tipoDoc: U(txt('tipoDoc')), numDoc: U(txt('numDoc')),
      tel: txt('tel'), cell: txt('cell'), email: U(txt('email')),
      iban: txt('iban').toUpperCase().replace(/[\s.\-]/g, ''),
      mansione: U(txt('mansione')), ente: U(txt('ente')), dataAttivita: dt('dataAttivita'), tipologia: U(txt('tipologia')),
      lordo, netto, inps: parseMoney(raw.inps),
      luogoRic: U(txt('luogoRic')), dataRic: dt('dataRic'),
    });
  }
  const gruppi = new Map();
  for (const r of rec) {
    const key = opzioni.raggruppa ? (r.cf || ('N:' + r.cognome + ' ' + r.nome)) : ('R:' + r.riga);
    if (!gruppi.has(key)) gruppi.set(key, []);
    gruppi.get(key).push(r);
  }
  const nomi = new Set();
  const ricevute = [...gruppi.values()].map(g => creaRicevuta(g, nomi, U, opzioni.maiuscolo));
  return { ricevute, righeLette: rec.length };
}

function creaRicevuta(g, nomi, U, maiuscolo) {
  const errori = [], avvisi = [];
  const p = { ...g[0] };
  for (const r of g.slice(1)) for (const k of ['cognome', 'nome', 'luogoNascita', 'dataNascita', 'residenza', 'indirizzo', 'cf', 'tipoDoc', 'numDoc', 'tel', 'cell', 'email', 'iban']) if (!p[k] && r[k]) p[k] = r[k];

  const att = g.map(r => {
    const a = { riga: r.riga, ente: r.ente, data: r.dataAttivita, tipologia: r.tipologia, inps: r.inps || 0 };
    if (Number.isNaN(r.lordo) || Number.isNaN(r.netto) || Number.isNaN(r.inps)) { a.bad = true; errori.push(`Riga ${r.riga}: importo non leggibile`); return a; }
    if (r.lordo !== null) {
      Object.assign(a, daLordo(r.lordo, a.inps), { modo: 'lordo' });
      if (r.netto !== null && Math.abs(r.netto - a.netto) > 1) avvisi.push(`Riga ${r.riga}: il netto nel file (${fmtNum(r.netto)}) non corrisponde al lordo; uso il netto calcolato ${fmtNum(a.netto)}`);
    } else if (r.netto !== null) {
      Object.assign(a, daNetto(r.netto, a.inps), { modo: 'netto' });
    } else { a.bad = true; errori.push(g.length > 1 ? `Riga ${r.riga}: manca il compenso` : 'Manca il compenso (lordo o netto)'); }
    if (!a.bad && a.lordo <= 0) { a.bad = true; errori.push(`Riga ${r.riga}: il compenso deve essere maggiore di zero`); }
    return a;
  });
  let tot = { lordo: 0, rit: 0, netto: 0, inps: 0 };
  if (!att.some(a => a.bad)) {
    const inps = att.reduce((s, a) => s + a.inps, 0);
    tot = att.every(a => a.modo === 'netto')
      ? daNetto(att.reduce((s, a) => s + a.netto, 0), inps)
      : daLordo(att.reduce((s, a) => s + a.lordo, 0), inps);
    if (tot.netto <= 0) errori.push('Il netto risulta zero o negativo: controlla la trattenuta INPS');
  }

  const mansione = [...new Set(g.map(r => r.mansione).filter(Boolean))].join('; ');
  const ultime = [...g].reverse();
  let luogoRic = (ultime.find(r => r.luogoRic) || {}).luogoRic || '';
  if (!luogoRic) { const e = (ultime.find(r => /^COMUNE DI\s+/i.test(r.ente)) || {}).ente; if (e) luogoRic = U(e.replace(/^COMUNE DI\s+/i, '')); }
  let dataRic = (ultime.find(r => r.dataRic) || {}).dataRic || '';
  if (!dataRic) { const ds = g.map(r => r.dataAttivita).filter(Boolean).sort((a, b) => (dateKey(a) || a).localeCompare(dateKey(b) || b)); dataRic = ds[ds.length - 1] || ''; }

  const nominativo = [p.cognome, p.nome].filter(Boolean).join(' ');
  if (!nominativo) errori.push('Manca il nome del collaboratore');
  if (!p.cf) avvisi.push('Manca il codice fiscale'); else if (!cfOk(p.cf)) avvisi.push(`Codice fiscale da controllare: ${p.cf}`);
  if (!p.iban) avvisi.push("Manca l'IBAN"); else if (!ibanOk(p.iban)) avvisi.push(`IBAN da controllare: ${p.iban}`);
  const manca = [];
  if (!p.luogoNascita) manca.push('luogo di nascita'); if (!p.dataNascita) manca.push('data di nascita');
  if (!p.residenza) manca.push('comune di residenza'); if (!p.indirizzo) manca.push('indirizzo');
  if (!p.tipoDoc) manca.push('tipo documento'); if (!p.numDoc) manca.push('numero documento');
  if (!mansione) manca.push('mansione');
  if (att.some(a => !a.ente)) manca.push('ente'); if (att.some(a => !a.data)) manca.push('data attività');
  if (att.some(a => !a.tipologia)) manca.push('tipologia di concorso');
  if (!luogoRic) manca.push('luogo della ricevuta'); if (!dataRic) manca.push('data della ricevuta');
  if (manca.length) avvisi.push('Mancano: ' + manca.join(', '));

  const [viaLabel, via] = separaIndirizzo(p.indirizzo);
  const il = maiuscolo ? ' IL ' : ' il ';
  const nascita = p.luogoNascita && p.dataNascita ? p.luogoNascita + il + p.dataNascita : (p.luogoNascita || (p.dataNascita ? il.trim() + ' ' + p.dataNascita : ''));
  const ok = !errori.length;
  const campi = {
    NOMINATIVO: nominativo, NASCITA: nascita, RESIDENZA: p.residenza, VIA_LABEL: viaLabel, INDIRIZZO: via, CF: p.cf,
    TIPO_DOC: p.tipoDoc, NUM_DOC: p.numDoc, TEL: p.tel ? p.tel + ' ' : '', CELL: p.cell ? p.cell + ' ' : '', EMAIL: p.email,
    IBAN: p.iban, MANSIONE: mansione,
    LORDO: ok ? fmtEuro(tot.lordo) : '', RITENUTA: ok ? fmtEuro(tot.rit) : '',
    INPS: tot.inps ? fmtEuro(tot.inps) : '', NETTO: ok ? fmtEuro(tot.netto) : '',
    LUOGO_FIRMA: luogoRic, DATA_FIRMA: dataRic ? (luogoRic ? ', ' : '') + dataRic : '',
  };
  const righeReport = att.map(a => ({ R_ENTE: a.ente, R_DATA: a.data, R_TIPO: a.tipologia, R_NETTO: a.bad ? '' : fmtNum(a.netto) }));

  const mostra = titleCase([p.nome, p.cognome].filter(Boolean).join(' ')) || 'Senza nome';
  let base = safeName('RICEVUTA PRESTAZIONE OCCASIONALE - ' + mostra);
  if (nomi.has(base)) {
    const d = ((att[0] && att[0].data) || '').replace(/\//g, '-');
    let alt = d ? base + ' - ' + d : base; let n = 2;
    while (nomi.has(alt)) alt = base + ' (' + (n++) + ')';
    base = alt;
  }
  nomi.add(base);

  return { p, nominativo, mostra, att, righeReport, campi, ...tot, mansione, luogoRic, dataRic, errori, avvisi, file: base + '.docx', bollo: ok && tot.lordo > SOGLIA_BOLLO };
}
