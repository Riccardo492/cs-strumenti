// Elaborati da Word: dal file Word esportato dalla piattaforma d'esame (tutti i candidati in un unico documento)
// a un documento per candidato, anonimo, in Word e in PDF.
//
// Fa quello che faceva il programma «Convertitore DOCX a PDF» (wordXC1.exe), riga per riga:
// - le righe con «Test Name:», «Testing Window:» ed «Examinee Name:» vengono tolte (niente nome del candidato);
// - «External ID: xxxx» apre l'elaborato di un nuovo candidato e diventa «ID Elaborato: xxxx»,
//   scritto anche in testa a ogni pagina (Arial 12, grassetto, centrato);
// - «Question» diventa «Domanda» (grassetto); dalla seconda domanda in poi si va a pagina nuova, dopo una riga «|»;
// - «Answer» diventa «Risposta» (grassetto), ripulito dalle barre doppie, e dopo la risposta c'è una riga «|»;
// - le altre righe passano così come sono; il file si chiama ID_Elaborato_xxxx.
// Differenze volute: ogni elaborato (non solo l'ultimo) finisce senza righe vuote e con «|»; ID ripetuti o vuoti
// vengono segnalati invece di sovrascrivere un file; i PDF si creano qui (prima serviva Microsoft Word).
// Pagina A4, Arial 11 nel Word e Helvetica 11 nel PDF (lo stesso disegno di Arial).
import { escXml, safeName } from '../../lib/formati.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ====================== lettura del Word ====================== */
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** Testo di un paragrafo come lo legge Word: tabulazioni e a capo compresi, testo cancellato (revisioni) escluso. */
function testoParagrafo(p) {
  let s = '';
  const giro = n => {
    for (const c of n.children) {
      if (c.namespaceURI !== NS_W) continue;
      const k = c.localName;
      if (k === 'del' || k === 'pPr' || k === 'rPr') continue;
      if (k === 't') s += c.textContent;
      else if (k === 'tab' || k === 'ptab') s += '\t';
      else if (k === 'br' || k === 'cr') s += '\n';
      else if (k === 'noBreakHyphen') s += '-';
      else giro(c);   // run, hyperlink, inserimenti, campi…
    }
  };
  giro(p);
  return s;
}

/** I paragrafi del corpo del documento, in ordine (quelli dentro le tabelle restano fuori, come nel programma). */
export async function leggiParagrafi(file) {
  let zip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); }
  catch (e) { throw new Error('non si apre come file Word (.docx)'); }
  const xml = zip.file('word/document.xml');
  if (!xml) throw new Error('non è un file Word (.docx)');
  const doc = new DOMParser().parseFromString(await xml.async('string'), 'application/xml');
  const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
  if (!body) throw new Error('il documento è vuoto');
  return [...body.children].filter(n => n.namespaceURI === NS_W && n.localName === 'p').map(testoParagrafo);
}

/* ====================== divisione per candidato ====================== */
const tutti = (s, a, b) => s.split(a).join(b);
/** Come la strip() di Python: toglie dai due lati i caratteri indicati. */
const togliLati = (s, car) => { let a = 0, b = s.length; while (a < b && car.includes(s[a])) a++; while (b > a && car.includes(s[b - 1])) b--; return s.slice(a, b); };
/** Ripulisce la riga della risposta: «Risposta:\n| Risposta:» una volta sola, niente «| |», niente barre ai lati. */
const pulisciRisposta = s => togliLati(tutti(tutti(s, 'Risposta:\n| Risposta:', 'Risposta:'), '| |', '|'), '| ');

/**
 * Divide i paragrafi in elaborati.
 * @returns {{ elaborati: Array<{ id, intestazione, righe: Array<{ t: 'testo'|'domanda'|'risposta'|'sep'|'pagina', testo? }>, domande, risposte }>, nomiTolti, prima }}
 */
export function dividi(paragrafi, { separatori = true, paginaPerDomanda = true } = {}) {
  const elaborati = [];
  let el = null, nomiTolti = 0, prima = 0;
  const chiudi = () => {
    if (!el) return;
    while (el.righe.length && el.righe[el.righe.length - 1].t === 'testo' && !el.righe[el.righe.length - 1].testo) el.righe.pop();
    if (separatori && el.righe[el.righe.length - 1]?.t !== 'sep') el.righe.push({ t: 'sep', testo: '|' });
    elaborati.push(el);
  };
  for (const grezzo of paragrafi) {
    const testo = grezzo.trim();
    if (testo.includes('Test Name:') || testo.includes('Testing Window:') || testo.includes('Examinee Name:')) {
      if (testo.includes('Examinee Name:')) nomiTolti++;
      continue;
    }
    if (testo.includes('External ID:')) {
      chiudi();
      const intestazione = tutti(testo, 'External ID:', 'ID Elaborato:').trim();
      const id = intestazione.split(':').pop().trim();
      el = { id, intestazione, righe: [{ t: 'testo', testo: intestazione }], domande: 0, risposte: 0 };
    } else if (!el) {
      if (testo) prima++;
    } else if (testo.includes('Question')) {
      if (el.domande > 0) {
        if (separatori) el.righe.push({ t: 'sep', testo: '|' });
        if (paginaPerDomanda) el.righe.push({ t: 'pagina' });
      }
      el.righe.push({ t: 'domanda', testo: tutti(testo, 'Question', 'Domanda') });
      el.domande++;
    } else if (testo.includes('Answer')) {
      el.righe.push({ t: 'risposta', testo: pulisciRisposta(tutti(testo, 'Answer', 'Risposta')) });
      if (separatori) el.righe.push({ t: 'sep', testo: '|' });
      el.risposte++;
    } else {
      el.righe.push({ t: 'testo', testo });
    }
  }
  chiudi();
  return { elaborati, nomiTolti, prima };
}

/** Nomi dei file: il modello con {ID}; un ID vuoto o ripetuto non sovrascrive un altro file. */
export function nomiFile(elaborati, modello = 'ID_Elaborato_{ID}') {
  const visti = new Map();
  return elaborati.map((e, i) => {
    let base = safeName(tutti(modello || 'ID_Elaborato_{ID}', '{ID}', e.id || `senza_ID_${i + 1}`)).replace(/\.(docx|pdf)$/i, '') || `elaborato_${i + 1}`;
    const chiave = base.toLowerCase();
    const n = (visti.get(chiave) || 0) + 1;
    visti.set(chiave, n);
    if (n > 1) base += `_${n}`;
    return base;
  });
}

/** Cose da guardare prima di consegnare. */
export function problemi(e, ripetuto) {
  const p = [];
  if (!e.id) p.push({ liv: 'err', testo: 'ID vuoto' });
  if (ripetuto) p.push({ liv: 'err', testo: 'ID ripetuto' });
  if (!e.domande) p.push({ liv: 'warn', testo: 'Nessuna domanda' });
  else if (e.risposte < e.domande) p.push({ liv: 'warn', testo: `${e.domande - e.risposte} senza risposta` });
  return p;
}

/* ====================== Word ====================== */
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const testoXml = s => escXml(String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));
/** Una riga di testo in run Word: gli a capo diventano <w:br/>, le tabulazioni <w:tab/>. */
function runs(s, grassetto) {
  const rPr = grassetto ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : '';
  return String(s).split('\n').map((riga, i) => `<w:r>${rPr}${i ? '<w:br/>' : ''}${riga.split('\t').map((p, j) => (j ? '<w:tab/>' : '') + (p ? `<w:t xml:space="preserve">${testoXml(p)}</w:t>` : '')).join('')}</w:r>`).join('');
}
const STILI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

/** Il .docx di un elaborato. */
export async function creaDocx(e) {
  const corpo = e.righe.map(r => r.t === 'pagina'
    ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    : `<w:p>${r.testo ? runs(r.testo, r.t === 'domanda' || r.t === 'risposta') : ''}</w:p>`).join('');
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
  z.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${testoXml(e.intestazione)}</dc:title><dc:creator>CS Strumenti</dc:creator></cp:coreProperties>`);
  z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>');
  z.file('word/styles.xml', STILI);
  z.file('word/header1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${W}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">${testoXml(e.intestazione)}</w:t></w:r></w:p></w:hdr>`);
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${corpo}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: DOCX });
}

/* ====================== PDF ====================== */
const MM = 72 / 25.4;
const PAGINA = [210 * MM, 297 * MM], MARGINE = 25 * MM, CORPO = 11, INTERLINEA = 14.5, DOPO = 4, TESTA = 12;

/** Prepara i caratteri per una serie di PDF: chi chiama crea un documento per elaborato con creaPdf. */
export function preparaPdf(L) {
  const cache = new Map();
  /** Tiene solo i caratteri che il carattere standard sa scrivere; gli altri diventano la lettera senza accento o «?». */
  const scrivibile = (testo, font) => {
    let m = cache.get(font); if (!m) cache.set(font, m = new Map());
    let o = '';
    for (const ch of testo.replace(/\t/g, '    ')) {
      let r = m.get(ch);
      if (r === undefined) {
        try { font.encodeText(ch); r = ch; }
        catch (e) { const s = ch.normalize('NFD').replace(/[̀-ͯ]/g, ''); try { font.encodeText(s); r = s; } catch (e2) { r = /\s/.test(ch) ? ' ' : '?'; } }
        m.set(ch, r);
      }
      o += r;
    }
    return o;
  };
  /** Righe che stanno nella larghezza; le parole troppo lunghe (indirizzi, codici) vanno a capo da sole. */
  const aCapo = (testo, font, larghezza) => {
    const righe = [];
    for (const blocco of testo.split('\n')) {
      let riga = '';
      for (const parola of blocco.split(/(\s+)/)) {
        if (!parola) continue;
        const prova = riga + parola;
        if (font.widthOfTextAtSize(prova, CORPO) <= larghezza) { riga = prova; continue; }
        if (riga.trim()) righe.push(riga.trimEnd());
        riga = /^\s+$/.test(parola) ? '' : parola;
        while (font.widthOfTextAtSize(riga, CORPO) > larghezza) {
          let k = riga.length - 1;
          while (k > 1 && font.widthOfTextAtSize(riga.slice(0, k), CORPO) > larghezza) k--;
          righe.push(riga.slice(0, k)); riga = riga.slice(k);
        }
      }
      righe.push(riga.trimEnd());
    }
    return righe;
  };

  /** Il PDF di un elaborato. */
  return async function creaPdf(e) {
    const doc = await L.PDFDocument.create();
    doc.setTitle(e.intestazione); doc.setCreator('CS Strumenti'); doc.setProducer('CS Strumenti');
    const normale = await doc.embedFont(L.StandardFonts.Helvetica), grassetto = await doc.embedFont(L.StandardFonts.HelveticaBold);
    const nero = L.rgb(0, 0, 0), larghezza = PAGINA[0] - 2 * MARGINE;
    const testa = scrivibile(e.intestazione, grassetto);
    let pg = null, y = 0, vuota = true;
    const nuovaPagina = () => {
      pg = doc.addPage(PAGINA); vuota = true;
      const w = grassetto.widthOfTextAtSize(testa, TESTA);
      // l'intestazione è marcata come tale (come fa Word): «Rinomina › Cambia un testo» la riconosce anche con «solo intestazione»
      pg.pushOperators(L.PDFOperator.of('BDC', [L.PDFName.of('Artifact'), doc.context.obj({ Type: 'Pagination', Subtype: 'Header' })]));
      pg.drawText(testa, { x: (PAGINA[0] - w) / 2, y: PAGINA[1] - 12.5 * MM - TESTA, size: TESTA, font: grassetto, color: nero });
      pg.pushOperators(L.PDFOperator.of('EMC'));
      y = PAGINA[1] - MARGINE;
    };
    nuovaPagina();
    for (const r of e.righe) {
      if (r.t === 'pagina') { if (!vuota) nuovaPagina(); continue; }
      const font = r.t === 'domanda' || r.t === 'risposta' ? grassetto : normale;
      const righe = r.testo ? aCapo(scrivibile(r.testo, font), font, larghezza) : [''];
      for (const riga of righe) {
        if (y - INTERLINEA < MARGINE) nuovaPagina();
        y -= INTERLINEA;
        if (riga) pg.drawText(riga, { x: MARGINE, y: y + 3.5, size: CORPO, font, color: nero });
        vuota = false;
      }
      y -= DOPO;
    }
    return doc.save();
  };
}

/* ====================== esempio ====================== */
// Un file come quello della piattaforma, con tre candidati inventati (gli stessi ID dell'esempio di «Rinomina»).
// Al secondo candidato manca una risposta, così si vede l'avviso.
const DOMANDE_ESEMPIO = [
  ['Il candidato illustri le fasi del procedimento amministrativo.', 'Il procedimento si articola in tre fasi: iniziativa, istruttoria e decisione.\nNella fase istruttoria il responsabile del procedimento accerta i fatti e acquisisce i pareri.\nLa decisione si conclude con un provvedimento espresso entro il termine previsto.'],
  ['Che cos\'è la conferenza di servizi e quando si convoca?', 'È lo strumento con cui le amministrazioni esaminano insieme gli interessi pubblici coinvolti in un procedimento.\nSi convoca quando servono più pareri, intese o assensi (L. 241/1990, art. 14).'],
  ['Descriva il diritto di accesso ai documenti amministrativi.', 'Chi ha un interesse diretto, concreto e attuale può prendere visione dei documenti e farne copia.\nL\'accesso civico generalizzato, invece, spetta a chiunque, nei limiti previsti dalla legge.'],
];
export function paragrafiEsempio() {
  const candidati = [['Mario Rossi', 'k3m9xq2pa', 3], ['Laura Bianchi', 'p2vh8sy6e', 2], ['Giovanni Verdi', 'r7td4wn1c', 3]];
  const p = [];
  for (const [nome, id, risposte] of candidati) {
    p.push('Test Name: Concorso istruttore amministrativo – prova scritta (esempio)', 'Testing Window: 15/10/2026 09:30 – 12:30', `Examinee Name: ${nome}`, `External ID: ${id}`, '');
    DOMANDE_ESEMPIO.forEach(([d, r], i) => {
      p.push(`Question #: ${i + 1}`, d);
      if (i < risposte) p.push(`Answer:\n| Answer: ${r} |`);
      p.push('');
    });
  }
  return p;
}
