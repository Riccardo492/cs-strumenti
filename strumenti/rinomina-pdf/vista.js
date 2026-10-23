// Rinomina PDF: interfaccia delle sezioni «Rinomina» e «Regole di nome».
import { escHtml, oggiIt, isEmpty } from '../../lib/formati.js';
import { leggiFoglio, trovaIntestazione, intestazioni, scriviCsv } from '../../lib/excel.js';
import { raccogliFile, fmtDimensione } from '../../lib/file.js';
import { scorriNumero, comparsa } from '../../js/vivo.js';
import { SEGNAPOSTO_FILE, SEGNAPOSTO_PDF, OPZIONI_BASE, MODI_ABBINAMENTO, abbina, abbinamentoMigliore, modelloSuggerito, calcolaNomi, ordina, trovaCf, trovaTesto } from './regole.js';
import { leggiTesto } from './pdftesto.js';
import { fileDiEsempio, EXCEL_ESEMPIO, MODELLO_ESEMPIO, OPZIONI_ESEMPIO } from './esempio.js';

const ICONA_GIU = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10"/></svg>';
const ICONA_CARICA = '<svg class="drop-icona" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10m0 0-4-4m4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
const MAX_RIGHE = 400;
const CHIAVE_REGOLE = 'cs.rinomina.regole';
const PDF_BASE = { attivo: false, cosa: 'cf', etichetta: '', parole: 1, regex: '', tutte: false };

/** Regole pronte, mostrate anche nella sezione «Regole di nome». */
export const REGOLE_PRONTE = [
  { nome: 'Elaborati anonimi → nome del candidato', descrizione: "Per i file ID_Elaborato_xxxx.pdf: collega l'elenco candidati esportato dalla piattaforma (Test Code) e ogni elaborato prende cognome, nome e codice fiscale.", modello: '{Last Name}_{First Name}_{CF}', opz: { maiuscole: 'su' } },
  { nome: "Solo l'ID elaborato", descrizione: 'Da ID_Elaborato_chj56eich.pdf a chj56eich.pdf.', modello: '{file}', opz: { cerca: 'ID_Elaborato_' } },
  { nome: 'Cognome_Nome_CF da Excel', descrizione: "Collega un Excel con colonne COGNOME, NOME e CODICE FISCALE: ogni PDF prende i dati della sua riga.", modello: '{COGNOME}_{NOME}_{CODICE FISCALE}', opz: { maiuscole: 'su' } },
  { nome: 'Codice fiscale letto dal PDF', descrizione: 'Cerca il codice fiscale dentro ogni PDF e lo usa come nome.', modello: '{pdf:cf}', opz: { maiuscole: 'su' }, pdf: { attivo: true, cosa: 'cf' } },
  { nome: 'Progressivo con prefisso', descrizione: 'ELABORATO_001, ELABORATO_002… nell\'ordine dei file.', modello: 'ELABORATO_{n}', opz: { cifre: 3 } },
  { nome: 'Nome attuale ripulito', descrizione: 'Stesso nome, ma senza spazi, accenti e caratteri strani, in maiuscolo.', modello: '{file}', opz: { maiuscole: 'su' } },
  { nome: 'Data di oggi davanti', descrizione: 'Aggiunge la data di oggi prima del nome attuale.', modello: '{oggi}_{file}', opz: {} },
];

const S = {
  origine: 'esempio', file: [], ignorati: 0,
  modello: MODELLO_ESEMPIO, opz: { ...OPZIONI_BASE, ...OPZIONI_ESEMPIO },
  excel: null,           // { nome, intestazioni, righe, fogli?, foglio?, modo, col, esempio }
  pdf: { ...PDF_BASE },
  testi: new Map(), lettura: null, giro: 0,
  manuali: new Map(), esclusi: new Set(),
  esito: { risultati: [], sconosciuti: [] }, abbinati: null,
  prec: {}, animaRighe: true,
};
let esempioPronto = null;
async function preparaEsempio() {
  if (!esempioPronto) esempioPronto = (async () => {
    const { accettati } = await raccogliFile(fileDiEsempio().map(x => new File([x.blob], x.nome, { type: 'application/pdf' })));
    S.file = ordina(accettati);
    const best = abbinamentoMigliore(S.file, EXCEL_ESEMPIO.righe, EXCEL_ESEMPIO.intestazioni, S.testi);
    S.excel = { ...EXCEL_ESEMPIO, esempio: true, modo: best.modo, col: best.col };
  })();
  return esempioPronto;
}
const regoleSalvate = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_REGOLE) || '[]'); } catch (e) { return []; } };
const salvaRegole = l => { try { localStorage.setItem(CHIAVE_REGOLE, JSON.stringify(l)); return true; } catch (e) { return false; } };
export function applicaRegola(r) {
  S.modello = r.modello; S.opz = { ...OPZIONI_BASE, ...(r.opz || {}) };
  if (r.pdf) Object.assign(S.pdf, r.pdf);
  S.manuali.clear();
}

/* ====================== Rinomina ====================== */
export async function montaRinomina(el, ctx) {
  await preparaEsempio();
  el.innerHTML = `
  <div class="rpdf">
    <section class="rpdf-riga">
      <div class="card" id="rp-file">
        <h3><span class="n">1</span>File PDF</h3>
        <label class="drop" id="rp-drop">
          <input type="file" id="rp-input" multiple accept=".pdf,.zip,application/pdf,application/zip">
          ${ICONA_CARICA}
          <strong>Scegli o trascina i PDF</strong>
          <span>anche una cartella intera o un archivio .zip</span>
        </label>
        <div class="row"><label class="btn" for="rp-cartella" tabindex="0">Scegli una cartella</label><input type="file" id="rp-cartella" webkitdirectory multiple hidden></div>
        <div class="rp-info" id="rp-info"></div>
      </div>
      <div class="card" id="rp-nome">
        <h3><span class="n">2</span>Nuovo nome</h3>
        <div class="field"><label for="rp-modello">Modello del nome</label>
          <div class="rp-modello"><input id="rp-modello" class="mono" spellcheck="false" autocomplete="off"><span class="rp-ext">.pdf</span></div>
        </div>
        <div class="rp-gettoni" id="rp-gettoni"></div>
        <p class="rp-prova" id="rp-prova"></p>
        <div class="rp-opzioni">
          <div class="field"><label for="rp-maiuscole">Lettere</label><select id="rp-maiuscole"><option value="come">come sono</option><option value="su">MAIUSCOLE</option><option value="giu">minuscole</option></select></div>
          <div class="field"><label for="rp-spazi">Spazi</label><select id="rp-spazi"><option value="_">diventano _</option><option value="-">diventano -</option><option value="lascia">restano spazi</option><option value="">tolti</option></select></div>
          <div class="field"><label for="rp-inizio">{n} parte da</label><input id="rp-inizio" type="number" min="0" inputmode="numeric"></div>
          <div class="field"><label for="rp-cifre">Cifre di {n}</label><select id="rp-cifre"><option value="0">automatiche</option><option value="1">1</option><option value="2">2 (01)</option><option value="3">3 (001)</option><option value="4">4 (0001)</option><option value="5">5</option></select></div>
        </div>
        <details class="rp-altro" id="rp-altro"><summary>Altre opzioni</summary>
          <div class="rp-altro-corpo">
            <label class="check"><input type="checkbox" id="rp-accenti"><b>Togli accenti e caratteri speciali</b><small>«D'Angelo Nicolò» diventa «DAngelo Nicolo»: evita problemi con alcuni programmi e piattaforme.</small></label>
            <label class="check"><input type="checkbox" id="rp-cartelle"><b>Mantieni le cartelle nello ZIP</b><small>Utile se hai caricato più cartelle e vuoi ritrovarle.</small></label>
            <div class="rp-sost">
              <div class="field"><label for="rp-cerca">Cerca nel nome</label><input id="rp-cerca" placeholder="es. scansione"></div>
              <div class="field"><label for="rp-sostituisci">Sostituisci con</label><input id="rp-sostituisci" placeholder="(niente)"></div>
            </div>
          </div>
        </details>
        <div class="rp-regole" id="rp-regole"></div>
      </div>
    </section>
    <section class="rpdf-riga">
      <div class="card" id="rp-excel"><h3><span class="n">3</span>Excel collegato <span class="chip ghost">facoltativo</span></h3><div id="rp-excel-corpo" class="rp-corpo"></div></div>
      <div class="card" id="rp-pdf"><h3><span class="n">4</span>Leggi dentro i PDF <span class="chip ghost">facoltativo</span></h3><div id="rp-pdf-corpo" class="rp-corpo"></div></div>
    </section>
    <section class="barra" id="rp-barra" aria-label="Riepilogo">
      <div class="stats" id="rp-stats"></div>
      <div class="row">
        <button class="btn primary" id="rp-zip" type="button">${ICONA_GIU}<span>Scarica ZIP rinominato</span></button>
        <button class="btn" id="rp-csv" type="button" title="Elenco vecchio nome → nuovo nome, da aprire in Excel">Elenco (CSV)</button>
      </div>
      <div class="rp-nota-esempio" id="rp-nota-esempio"><span class="chip info"><span class="dot"></span>Dati di esempio</span><span>Quattro elaborati di prova e un elenco candidati con persone inventate. Carica i tuoi file per sostituirli.</span></div>
    </section>
    <div class="rpdf-elenco" id="rp-elenco">
      <div class="scroll"><table class="tabella">
        <thead><tr><th class="rp-c"><input type="checkbox" id="rp-tutti" aria-label="Includi tutti" checked></th><th class="num">#</th><th>Nome attuale</th><th aria-hidden="true"></th><th>Nuovo nome</th><th>Stato</th></tr></thead>
        <tbody id="rp-tbody"></tbody>
      </table></div>
      <p class="hint rp-altri" id="rp-altri" hidden></p>
    </div>
  </div>`;

  const $ = s => el.querySelector(s);
  let vivo = true;

  /* ---------- calcolo ---------- */
  function ricalcola() {
    if (S.excel) S.abbinati = abbina(S.file, S.excel.righe, S.excel.modo, S.excel.col, S.testi); else S.abbinati = null;
    S.esito = calcolaNomi({ file: S.file, modello: S.modello, opz: S.opz, excel: S.excel, abbinati: S.abbinati, testi: S.testi, pdf: S.pdf, manuali: S.manuali, esclusi: S.esclusi });
    disegnaGettoni(); disegnaProva(); disegnaStats(); disegnaTabella(); aggiornaRiepilogoExcel(); aggiornaRiepilogoPdf();
  }
  let timer; const ricalcolaPresto = () => { clearTimeout(timer); timer = setTimeout(ricalcola, 120); };

  /* ---------- 1 · file ---------- */
  function disegnaInfo(err) {
    const box = $('#rp-info');
    if (err) { box.innerHTML = `<p class="msg err">${escHtml(err)}</p>`; return; }
    if (S.origine === 'esempio') { box.innerHTML = '<span class="hint">Nessun file caricato: sotto vedi quattro PDF di esempio.</span>'; return; }
    const tot = S.file.reduce((s, f) => s + f.dimensione, 0);
    const cartelle = new Set(S.file.map(f => f.cartella).filter(Boolean)).size;
    box.innerHTML = `<span><b>${S.file.length}</b> PDF · ${fmtDimensione(tot)}${cartelle ? ` · ${cartelle} ${cartelle === 1 ? 'cartella' : 'cartelle'}` : ''}</span>` +
      (S.ignorati ? `<span class="hint">${S.ignorati} file non PDF ignorati</span>` : '') +
      `<span class="row"><button class="linkbtn" id="rp-svuota" type="button">Togli tutti i file</button><button class="linkbtn" id="rp-torna-esempio" type="button">Torna all'esempio</button></span>`;
    $('#rp-svuota').onclick = () => { Object.assign(S, { file: [], ignorati: 0, origine: 'file' }); S.testi.clear(); S.manuali.clear(); S.esclusi.clear(); disegnaInfo(); ricalcola(); };
    $('#rp-torna-esempio').onclick = async () => {
      esempioPronto = null; S.origine = 'esempio'; S.testi.clear(); S.manuali.clear(); S.esclusi.clear(); S.ignorati = 0;
      S.modello = MODELLO_ESEMPIO; S.opz = { ...OPZIONI_BASE, ...OPZIONI_ESEMPIO }; S.pdf = { ...PDF_BASE };
      await preparaEsempio(); S.animaRighe = true; disegnaInfo(); disegnaOpzioni(); disegnaExcel(); disegnaPdf(); ricalcola();
    };
  }
  async function aggiungi(sorgente, sostituisci = true) {
    try {
      const { accettati, ignorati } = await raccogliFile(sorgente, { accetta: e => e === 'pdf' });
      if (!accettati.length) { disegnaInfo(ignorati ? `Nessun PDF trovato (${ignorati} file di altro tipo ignorati).` : 'Nessun PDF trovato.'); return; }
      if (S.origine === 'esempio') {
        // via i dati di esempio: file, Excel di prova e il modello pensato per lui
        S.file = []; if (!S.excel || S.excel.esempio) S.excel = null; S.manuali.clear(); S.esclusi.clear(); S.testi.clear();
        if (S.modello === MODELLO_ESEMPIO && !S.excel) { S.modello = '{file}'; S.opz = { ...OPZIONI_BASE }; }
        S.origine = 'file'; S.ignorati = 0;
      }
      if (sostituisci) { S.file = []; S.ignorati = 0; S.manuali.clear(); S.esclusi.clear(); S.testi.clear(); }
      const visti = new Set(S.file.map(f => f.cartella + '/' + f.nome + ':' + f.dimensione));
      for (const f of accettati) if (!visti.has(f.cartella + '/' + f.nome + ':' + f.dimensione)) S.file.push(f);
      ordina(S.file); S.ignorati += ignorati; S.animaRighe = true;
      disegnaInfo(); disegnaOpzioni(); disegnaExcel(); ricalcola();
      ctx.emetti('file-caricati', { quanti: S.file.length });
      if (S.pdf.attivo) leggiPdf();
    } catch (e) { console.error(e); disegnaInfo('Non sono riuscito a leggere i file: ' + (e.message || e)); }
  }

  /* ---------- 2 · nome ---------- */
  function disegnaOpzioni() {
    $('#rp-modello').value = S.modello;
    $('#rp-maiuscole').value = S.opz.maiuscole; $('#rp-spazi').value = S.opz.spazi;
    $('#rp-inizio').value = S.opz.inizio; $('#rp-cifre').value = String(S.opz.cifre || 0);
    $('#rp-accenti').checked = S.opz.accenti; $('#rp-cartelle').checked = S.opz.cartelle;
    $('#rp-cerca').value = S.opz.cerca; $('#rp-sostituisci').value = S.opz.sostituisci;
    disegnaRegole();
  }
  function disegnaGettoni() {
    const gruppo = (titolo, lista) => lista.length ? `<div class="rp-gruppo"><span class="rp-gruppo-t">${titolo}</span>${lista.map(g => `<button type="button" class="rp-gettone${S.modello.toLowerCase().includes('{' + g.t.toLowerCase() + '}') ? ' usato' : ''}" data-t="${escHtml(g.t)}" title="${escHtml(g.d)}">{${escHtml(g.t)}}</button>`).join('')}</div>` : '';
    const dallExcel = S.excel ? S.excel.intestazioni.filter(Boolean).map(h => ({ t: h, d: 'colonna dell\'Excel collegato' })) : [];
    $('#rp-gettoni').innerHTML = gruppo('Dal file', SEGNAPOSTO_FILE) + gruppo("Dall'Excel", dallExcel) + gruppo('Dal PDF', S.pdf.attivo ? SEGNAPOSTO_PDF : []) +
      (S.esito.sconosciuti.length ? `<p class="msg err">Segnaposto non riconosciuto: ${S.esito.sconosciuti.map(t => '{' + escHtml(t) + '}').join(', ')}. Controlla il nome o collega l'Excel giusto.</p>` : '');
  }
  function disegnaProva() {
    const r = S.esito.risultati.find(x => x.stato !== 'escluso');
    const f = r && S.file.find(x => x.id === r.id);
    $('#rp-prova').innerHTML = r ? `<span class="sub">Per esempio</span> <span class="mono">${escHtml(f.nome)}</span> <span aria-hidden="true">→</span> <b class="mono">${escHtml(r.nuovo)}</b>` : '<span class="sub">Carica dei PDF per vedere il risultato.</span>';
  }
  function disegnaRegole() {
    const salvate = regoleSalvate();
    $('#rp-regole').innerHTML = `
      <div class="field rp-usa"><label for="rp-usa">Usa una regola</label><select id="rp-usa"><option value="">— scegli —</option>
        <optgroup label="Pronte">${REGOLE_PRONTE.map((r, i) => `<option value="p${i}">${escHtml(r.nome)}</option>`).join('')}</optgroup>
        ${salvate.length ? `<optgroup label="Salvate da te">${salvate.map((r, i) => `<option value="s${i}">${escHtml(r.nome)}</option>`).join('')}</optgroup>` : ''}
      </select></div>
      <div class="rp-salva-box" id="rp-salva-box"><button class="btn" type="button" id="rp-salva-apri">Salva questa regola</button></div>`;
    $('#rp-usa').onchange = e => {
      const v = e.target.value; if (!v) return;
      const r = v[0] === 'p' ? REGOLE_PRONTE[+v.slice(1)] : regoleSalvate()[+v.slice(1)];
      if (!r) return;
      applicaRegola(r); disegnaOpzioni(); disegnaPdf(); ricalcola(); if (S.pdf.attivo) leggiPdf();
      ctx.avviso('Regola applicata: ' + r.nome);
    };
    $('#rp-salva-apri').onclick = () => {
      const box = $('#rp-salva-box');
      box.innerHTML = `<div class="field"><label for="rp-salva-nome">Nome della regola</label><input id="rp-salva-nome" placeholder="es. Elaborati concorso Selargius"></div><button class="btn primary" type="button" id="rp-salva-ok">Salva</button><button class="linkbtn" type="button" id="rp-salva-no">Annulla</button>`;
      const inp = $('#rp-salva-nome'); inp.focus();
      const ok = () => {
        const nome = inp.value.trim(); if (!nome) { inp.focus(); return; }
        const l = regoleSalvate().filter(r => r.nome !== nome);
        l.push({ nome, modello: S.modello, opz: { ...S.opz }, pdf: S.pdf.attivo ? { attivo: true, cosa: S.pdf.cosa, etichetta: S.pdf.etichetta, parole: S.pdf.parole, regex: S.pdf.regex } : undefined });
        ctx.avviso(salvaRegole(l) ? 'Regola salvata in questo browser' : 'Non riesco a salvare in questo browser');
        disegnaRegole();
      };
      $('#rp-salva-ok').onclick = ok;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') disegnaRegole(); });
      $('#rp-salva-no').onclick = disegnaRegole;
    };
  }

  /* ---------- 3 · Excel ---------- */
  function disegnaExcel(err) {
    const box = $('#rp-excel-corpo');
    const x = S.excel;
    if (!x) {
      box.innerHTML = `<p class="hint">Per prendere i nomi da un elenco: per esempio dall'ID elaborato a cognome, nome e codice fiscale. Va bene anche un elenco con «vecchio nome» e «nuovo nome».</p>
        <label class="drop rp-drop-piccolo"><input type="file" id="rp-excel-input" accept=".xlsx,.xlsm,.csv"><strong>Carica un Excel</strong><span>.xlsx o .csv</span></label>
        ${err ? `<p class="msg err">${escHtml(err)}</p>` : ''}`;
      $('#rp-excel-input').onchange = e => { const f = e.target.files[0]; if (f) caricaExcel(f); };
      return;
    }
    box.innerHTML = `
      <div class="rp-excel-testa"><span class="rp-excel-nome">${x.esempio ? '<span class="chip info">esempio</span> ' : ''}${escHtml(x.nome)}</span>
        <span class="row"><label class="linkbtn" for="rp-excel-cambia">Cambia</label><input type="file" id="rp-excel-cambia" accept=".xlsx,.xlsm,.csv" hidden><button class="linkbtn" type="button" id="rp-excel-togli">Scollega</button></span></div>
      ${x.fogli && x.fogli.length > 1 ? `<div class="field"><label for="rp-excel-foglio">Foglio</label><select id="rp-excel-foglio">${x.fogli.map((f, i) => `<option value="${i}"${i === x.foglio ? ' selected' : ''}>${escHtml(f.nome)}</option>`).join('')}</select></div>` : ''}
      <div class="rp-excel-campi">
        <div class="field"><label for="rp-excel-col">Colonna che identifica il file</label><select id="rp-excel-col">${x.intestazioni.map((h, i) => `<option value="${i}"${i === x.col ? ' selected' : ''}>${escHtml(h || '(colonna ' + (i + 1) + ')')}</option>`).join('')}</select></div>
        <div class="field"><label for="rp-excel-modo">Come si abbina</label><select id="rp-excel-modo">${MODI_ABBINAMENTO.map(m => `<option value="${m.v}"${m.v === x.modo ? ' selected' : ''}>${escHtml(m.d)}</option>`).join('')}</select></div>
      </div>
      <div class="rp-excel-esito" id="rp-excel-esito"></div>`;
    $('#rp-excel-cambia').onchange = e => { const f = e.target.files[0]; if (f) caricaExcel(f); };
    $('#rp-excel-togli').onclick = () => { S.excel = null; S.manuali.clear(); disegnaExcel(); ricalcola(); };
    const sel = $('#rp-excel-foglio');
    if (sel) sel.onchange = () => { impostaFoglio(+sel.value); disegnaExcel(); ricalcola(); };
    $('#rp-excel-col').onchange = e => { x.col = +e.target.value; ricalcola(); };
    $('#rp-excel-modo').onchange = e => { x.modo = e.target.value; if (x.modo === 'pdf-contiene' && !S.pdf.attivo) { S.pdf.attivo = true; disegnaPdf(); leggiPdf(); } ricalcola(); };
  }
  function aggiornaRiepilogoExcel() {
    const box = $('#rp-excel-esito'); if (!box || !S.excel) return;
    const n = S.abbinati ? S.abbinati.size : 0, tot = S.file.length;
    const usate = new Set(S.abbinati ? [...S.abbinati.values()].map(a => a.riga) : []);
    const senza = S.excel.righe.map((r, i) => ({ r, i })).filter(o => !usate.has(o.i) && o.r.some(c => !isEmpty(c)));
    const chiave = o => String(o.r[S.excel.col] ?? '').trim() || `riga ${o.i + 2}`;
    box.innerHTML = `<span class="chip ${n === tot && tot ? 'ok' : n ? 'warn' : 'err'}"><span class="dot"></span>Abbinati ${n} file su ${tot}</span>` +
      (senza.length ? `<p class="hint">Righe dell'Excel senza PDF: <b>${senza.length}</b> — ${senza.slice(0, 8).map(o => escHtml(chiave(o))).join(', ')}${senza.length > 8 ? '…' : ''}</p>` : '');
  }
  function impostaFoglio(i) {
    const x = S.excel, righe = x.fogli[i].righe;
    const h = trovaIntestazione(righe, []);
    x.foglio = i; x.intestazioni = intestazioni(righe, h);
    x.righe = righe.slice(h + 1).filter(r => r && r.some(c => !isEmpty(c)));
    const best = abbinamentoMigliore(S.file, x.righe, x.intestazioni, S.testi);
    x.modo = best.modo; x.col = best.col;
  }
  async function caricaExcel(file) {
    try {
      const wb = await leggiFoglio(file);
      S.excel = { nome: file.name, fogli: wb.fogli, foglio: 0, intestazioni: [], righe: [], modo: 'nome-uguale', col: 0 };
      impostaFoglio(Math.max(0, wb.fogli.findIndex(f => f.righe.some(r => r && r.some(c => !isEmpty(c))))));
      const sug = modelloSuggerito(S.excel.intestazioni);
      if (sug && (S.modello === '{file}' || S.modello === MODELLO_ESEMPIO)) S.modello = sug;
      disegnaOpzioni(); disegnaExcel(); ricalcola();
      ctx.emetti('excel-caricato');
    } catch (e) { console.error(e); disegnaExcel(e.message || String(e)); }
  }

  /* ---------- 4 · lettura dei PDF ---------- */
  function disegnaPdf() {
    const p = S.pdf, box = $('#rp-pdf-corpo');
    box.innerHTML = `
      <label class="check"><input type="checkbox" id="rp-pdf-attivo"${p.attivo ? ' checked' : ''}><b>Cerca nel testo dei PDF</b><small>Per usare nel nome un codice fiscale o un numero scritto dentro il documento. Funziona con i PDF che contengono testo; le scansioni senza riconoscimento del testo non hanno nulla da leggere.</small></label>
      <div class="rp-pdf-opz"${p.attivo ? '' : ' hidden'}>
        <div class="field"><label for="rp-pdf-cosa">Cosa cercare per {pdf:testo}</label><select id="rp-pdf-cosa">
          <option value="cf"${p.cosa === 'cf' ? ' selected' : ''}>solo il codice fiscale ({pdf:cf})</option>
          <option value="etichetta"${p.cosa === 'etichetta' ? ' selected' : ''}>il testo dopo un'etichetta</option>
          <option value="regex"${p.cosa === 'regex' ? ' selected' : ''}>un'espressione regolare (esperti)</option></select></div>
        <div class="rp-pdf-riga"${p.cosa === 'etichetta' ? '' : ' hidden'}>
          <div class="field"><label for="rp-pdf-etichetta">Etichetta</label><input id="rp-pdf-etichetta" placeholder="es. Protocollo n." value="${escHtml(p.etichetta)}"></div>
          <div class="field"><label for="rp-pdf-parole">Parole da prendere</label><input id="rp-pdf-parole" type="number" min="1" max="8" value="${p.parole}"></div>
        </div>
        <div class="field"${p.cosa === 'regex' ? '' : ' hidden'}><label for="rp-pdf-regex">Espressione (il gruppo tra parentesi diventa il testo)</label><input id="rp-pdf-regex" class="mono" spellcheck="false" placeholder="es. Prot\\.\\s*(\\d+)" value="${escHtml(p.regex)}"></div>
        <label class="check"><input type="checkbox" id="rp-pdf-tutte"${p.tutte ? ' checked' : ''}><b>Leggi tutte le pagine</b><small>Di solito basta la prima, ed è molto più veloce.</small></label>
        <div class="rp-pdf-esito" id="rp-pdf-esito"></div>
      </div>`;
    $('#rp-pdf-attivo').onchange = e => { p.attivo = e.target.checked; disegnaPdf(); ricalcola(); if (p.attivo) leggiPdf(); };
    const sc = $('#rp-pdf-cosa'); if (sc) sc.onchange = e => { p.cosa = e.target.value; disegnaPdf(); ricalcola(); };
    const et = $('#rp-pdf-etichetta'); if (et) et.oninput = e => { p.etichetta = e.target.value; ricalcolaPresto(); };
    const pa = $('#rp-pdf-parole'); if (pa) pa.oninput = e => { p.parole = +e.target.value || 1; ricalcolaPresto(); };
    const rx = $('#rp-pdf-regex'); if (rx) rx.oninput = e => { p.regex = e.target.value; ricalcolaPresto(); };
    const tu = $('#rp-pdf-tutte'); if (tu) tu.onchange = e => { p.tutte = e.target.checked; S.testi.clear(); leggiPdf(); };
    aggiornaRiepilogoPdf();
  }
  function aggiornaRiepilogoPdf() {
    const box = $('#rp-pdf-esito'); if (!box || !S.pdf.attivo) return;
    if (S.lettura) {
      const k = S.lettura.totale ? Math.round(S.lettura.fatti / S.lettura.totale * 100) : 0;
      box.innerHTML = `<div class="rp-progresso" role="progressbar" aria-valuenow="${k}" aria-valuemin="0" aria-valuemax="100"><span style="width:${k}%"></span></div><span class="hint">Leggo i PDF… ${S.lettura.fatti} di ${S.lettura.totale}</span>`;
      return;
    }
    if (S.lettura === undefined) return;
    let cf = 0, testo = 0, vuoti = 0, errori = 0;
    for (const f of S.file) {
      const t = S.testi.get(f.id); if (!t) continue;
      if (t.errore && !t.testo) { if (/testo/.test(t.errore)) vuoti++; else errori++; continue; }
      if (trovaCf(t.testo).length) cf++;
      if (S.pdf.cosa !== 'cf' && trovaTesto(t.testo, S.pdf)) testo++;
    }
    box.innerHTML = `<span class="row">${S.testi.size ? `<span class="chip ${cf ? 'ok' : 'ghost'}">CF trovato in ${cf}</span>` : ''}${S.pdf.cosa !== 'cf' && S.testi.size ? `<span class="chip ${testo ? 'ok' : 'ghost'}">testo trovato in ${testo}</span>` : ''}${vuoti ? `<span class="chip warn">${vuoti} senza testo</span>` : ''}${errori ? `<span class="chip err">${errori} non leggibili</span>` : ''}</span>`;
  }
  async function leggiPdf() {
    const giro = ++S.giro;
    const daLeggere = S.file.filter(f => !S.testi.has(f.id));
    if (!daLeggere.length) { ricalcola(); return; }
    S.lettura = { fatti: 0, totale: daLeggere.length }; aggiornaRiepilogoPdf();
    try {
      for (const f of daLeggere) {
        if (giro !== S.giro || !S.pdf.attivo) return;
        try { S.testi.set(f.id, await leggiTesto(f.blob, { tutte: S.pdf.tutte })); }
        catch (e) { if (/connessione/.test(e.message)) throw e; S.testi.set(f.id, { testo: '', pagine: 0, errore: 'non leggibile' }); }
        S.lettura.fatti++;
        if (vivo) { aggiornaRiepilogoPdf(); if (S.lettura.fatti % 5 === 0) ricalcola(); }
      }
    } catch (e) {
      const box = $('#rp-pdf-esito'); if (box && vivo) box.innerHTML = `<p class="msg err">${escHtml(e.message)}</p>`;
      S.lettura = undefined; return;
    } finally { if (giro === S.giro && S.lettura) S.lettura = null; }
    if (vivo) { ricalcola(); ctx.emetti('pdf-letti'); }
  }

  /* ---------- riepilogo e tabella ---------- */
  function conteggi() {
    const c = { file: S.file.length, rinominati: 0, uguali: 0, controllare: 0, esclusi: 0 };
    for (const r of S.esito.risultati) {
      if (r.stato === 'escluso') c.esclusi++;
      else if (r.stato === 'uguale' || r.stato === 'vuoto') c.uguali++;
      else c.rinominati++;
      if (r.stato === 'doppione' || r.stato === 'vuoto' || (r.note.length && r.stato !== 'escluso')) c.controllare++;
    }
    return c;
  }
  function disegnaStats() {
    const c = conteggi();
    const st = (k, chiave, v, cls = '') => `<div class="stat"><span class="k">${k}</span><span class="v ${cls}" data-k="${chiave}" data-v="${v}">${v}</span></div>`;
    $('#rp-stats').innerHTML = st('File', 'file', c.file) + st('Rinominati', 'rin', c.rinominati) + st('Invariati', 'ug', c.uguali) +
      (c.controllare ? st('Da controllare', 'ctr', c.controllare, 'err') : '') + (c.esclusi ? st('Esclusi', 'esc', c.esclusi) : '');
    $('#rp-stats').querySelectorAll('.v').forEach(x => { const k = x.dataset.k, v = +x.dataset.v; scorriNumero(x, S.prec[k] ?? 0, v, String); S.prec[k] = v; });
    const inclusi = c.file - c.esclusi;
    $('#rp-zip').disabled = !inclusi; $('#rp-csv').disabled = !c.file;
    $('#rp-nota-esempio').hidden = S.origine !== 'esempio';
    $('#rp-tutti').checked = !c.esclusi; $('#rp-tutti').indeterminate = !!c.esclusi && c.esclusi < c.file;
  }
  const CHIP = {
    ok: '<span class="chip ok"><span class="dot"></span>Rinominato</span>',
    uguale: '<span class="chip ghost">Invariato</span>',
    doppione: '<span class="chip warn"><span class="dot"></span>Doppione</span>',
    vuoto: '<span class="chip warn"><span class="dot"></span>Nome vuoto</span>',
    manuale: '<span class="chip info"><span class="dot"></span>Scritto a mano</span>',
    escluso: '<span class="chip ghost">Escluso</span>',
  };
  function disegnaTabella() {
    const tb = $('#rp-tbody');
    if (!S.file.length) { tb.innerHTML = '<tr><td colspan="6" class="vuoto">Nessun PDF. Trascinali nel riquadro 1, anche come cartella o .zip.</td></tr>'; $('#rp-altri').hidden = true; return; }
    const mappa = new Map(S.file.map(f => [f.id, f]));
    const mostrati = S.esito.risultati.slice(0, MAX_RIGHE);
    const mod = S.modello.toLowerCase();
    const usaPdf = { cf: mod.includes('{pdf:cf}'), testo: mod.includes('{pdf:testo}') || (S.excel && S.excel.modo === 'pdf-contiene') };
    const usaExcel = !!S.excel && (S.excel.intestazioni.some(h => mod.includes('{' + h.toLowerCase() + '}')));
    tb.innerHTML = mostrati.map((r, i) => {
      const f = mappa.get(r.id);
      const ext = f.ext ? '.' + f.ext : '';
      const senzaExt = r.nuovo.endsWith(ext) ? r.nuovo.slice(0, r.nuovo.length - ext.length) : r.nuovo;
      const t = S.pdf.attivo ? S.testi.get(f.id) : null;
      let dalPdf = '';
      if (t) {
        if (t.errore && !t.testo) dalPdf = `PDF: ${t.errore}`;
        else if (usaPdf.cf) dalPdf = trovaCf(t.testo)[0] ? `CF nel PDF: ${trovaCf(t.testo)[0]}` : 'nessun codice fiscale nel PDF';
        else if (usaPdf.testo) dalPdf = trovaTesto(t.testo, S.pdf) ? `nel PDF: «${trovaTesto(t.testo, S.pdf)}»` : 'testo non trovato nel PDF';
      }
      const dalExcel = r.riga != null && usaExcel ? `riga ${r.riga + 2} dell'Excel` : '';
      const note = [...r.note, dalExcel, dalPdf].filter(Boolean);
      return `<tr data-id="${r.id}" class="${r.stato === 'escluso' ? 'escluso' : ''}">
        <td class="rp-c"><input type="checkbox" data-inc="${r.id}" aria-label="Includi ${escHtml(f.nome)}"${r.stato === 'escluso' ? '' : ' checked'}></td>
        <td class="num sub">${i + 1}</td>
        <td><div class="rp-vecchio mono">${escHtml(f.nome)}</div>${f.cartella ? `<div class="sub">${escHtml(f.cartella)}</div>` : ''}</td>
        <td class="rp-freccia" aria-hidden="true">→</td>
        <td><div class="rp-nuovo"><input class="mono" data-nuovo="${r.id}" value="${escHtml(senzaExt)}" size="${Math.max(12, Math.min(70, senzaExt.length + 2))}" aria-label="Nuovo nome di ${escHtml(f.nome)}"${r.stato === 'escluso' ? ' disabled' : ''}><span class="rp-ext">${escHtml(ext)}</span>${r.stato === 'manuale' ? `<button type="button" class="rp-ripristina" data-ripristina="${r.id}" title="Torna al nome calcolato" aria-label="Torna al nome calcolato">↺</button>` : ''}</div></td>
        <td>${CHIP[r.stato] || ''}${note.length ? `<div class="sub">${note.map(escHtml).join(' · ')}</div>` : ''}</td></tr>`;
    }).join('');
    const altri = S.esito.risultati.length - mostrati.length;
    $('#rp-altri').hidden = altri <= 0; $('#rp-altri').textContent = altri > 0 ? `E altri ${altri} file, non mostrati qui ma inclusi nello ZIP.` : '';
    if (S.animaRighe) { S.animaRighe = false; comparsa(tb.querySelectorAll('tr'), { passo: 28, max: 16, ritardo: 80 }); }
  }

  /* ---------- download ---------- */
  async function esegui(btn, fn) {
    if (btn.disabled) return;
    const html = btn.innerHTML; btn.disabled = true;
    try { await fn(t => { btn.innerHTML = `<span>${t}</span>`; }); }
    catch (e) { console.error(e); ctx.avviso('Errore: ' + (e.message || e)); }
    finally { btn.disabled = false; btn.innerHTML = html; disegnaStats(); }
  }
  $('#rp-zip').addEventListener('click', e => esegui(e.currentTarget, async avanza => {
    avanza('Preparo…');
    const mappa = new Map(S.file.map(f => [f.id, f]));
    const zip = new JSZip();
    for (const r of S.esito.risultati) {
      if (r.stato === 'escluso') continue;
      const f = mappa.get(r.id);
      zip.file((S.opz.cartelle && f.cartella ? f.cartella + '/' : '') + r.nuovo, f.blob, { binary: true });
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', mimeType: 'application/zip' }, m => avanza(`Preparo… ${Math.round(m.percent)}%`));
    if (await ctx.salva(`PDF rinominati - ${oggiIt()}.zip`, blob)) ctx.emetti('scaricato');
  }));
  $('#rp-csv').addEventListener('click', e => esegui(e.currentTarget, async () => {
    const mappa = new Map(S.file.map(f => [f.id, f]));
    const righe = [['CARTELLA', 'NOME ATTUALE', 'NUOVO NOME', 'STATO', 'NOTE', 'RIGA EXCEL']];
    for (const r of S.esito.risultati) { const f = mappa.get(r.id); righe.push([f.cartella, f.nome, r.stato === 'escluso' ? '' : r.nuovo, r.stato, r.note.join(' · '), r.riga != null ? r.riga + 2 : '']); }
    await ctx.salva(`Elenco rinomina - ${oggiIt()}.csv`, new Blob([scriviCsv(righe)], { type: 'text/csv' }));
  }));

  /* ---------- eventi ---------- */
  $('#rp-input').addEventListener('change', e => { if (e.target.files.length) aggiungi([...e.target.files]); e.target.value = ''; });
  $('#rp-cartella').addEventListener('change', e => { if (e.target.files.length) aggiungi([...e.target.files]); e.target.value = ''; });
  el.querySelector('label[for="rp-cartella"]').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#rp-cartella').click(); } });
  const drop = $('#rp-drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); aggiungi(e.dataTransfer); });

  const modello = $('#rp-modello');
  modello.addEventListener('input', () => { S.modello = modello.value; ricalcolaPresto(); ctx.emetti('modello-cambiato'); });
  $('#rp-gettoni').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const tok = '{' + b.dataset.t + '}';
    const a = modello.selectionStart ?? modello.value.length, z = modello.selectionEnd ?? a;
    const prima = modello.value.slice(0, a), dopo = modello.value.slice(z);
    const sep = prima && !/[_\-\s.]$/.test(prima) ? (S.opz.spazi && S.opz.spazi !== 'lascia' ? S.opz.spazi : '_') : '';
    modello.value = prima + sep + tok + dopo; S.modello = modello.value;
    const pos = (prima + sep + tok).length; modello.focus(); modello.setSelectionRange(pos, pos);
    ricalcola(); ctx.emetti('modello-cambiato');
  });
  const opz = (id, k, conv = v => v, ev = 'change') => $(id).addEventListener(ev, e => { S.opz[k] = conv(e.target.type === 'checkbox' ? e.target.checked : e.target.value); ricalcolaPresto(); });
  opz('#rp-maiuscole', 'maiuscole'); opz('#rp-spazi', 'spazi'); opz('#rp-inizio', 'inizio', v => Math.max(0, parseInt(v, 10) || 0), 'input'); opz('#rp-cifre', 'cifre', v => +v);
  opz('#rp-accenti', 'accenti'); opz('#rp-cartelle', 'cartelle'); opz('#rp-cerca', 'cerca', v => v, 'input'); opz('#rp-sostituisci', 'sostituisci', v => v, 'input');

  const tb = $('#rp-tbody');
  tb.addEventListener('change', e => {
    const inc = e.target.closest('[data-inc]');
    if (inc) { if (inc.checked) S.esclusi.delete(inc.dataset.inc); else S.esclusi.add(inc.dataset.inc); ricalcola(); return; }
    const n = e.target.closest('[data-nuovo]');
    if (n) { const v = n.value.trim(); if (v) S.manuali.set(n.dataset.nuovo, v); else S.manuali.delete(n.dataset.nuovo); ricalcola(); }
  });
  tb.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-nuovo]')) e.target.blur(); });
  tb.addEventListener('click', e => { const b = e.target.closest('[data-ripristina]'); if (b) { S.manuali.delete(b.dataset.ripristina); ricalcola(); } });
  $('#rp-tutti').addEventListener('change', e => { if (e.target.checked) S.esclusi.clear(); else S.file.forEach(f => S.esclusi.add(f.id)); ricalcola(); });

  disegnaInfo(); disegnaOpzioni(); disegnaExcel(); disegnaPdf();
  S.animaRighe = true; S.prec = {};
  ricalcola();
  if (S.pdf.attivo && S.file.some(f => !S.testi.has(f.id))) leggiPdf();
  return () => { vivo = false; clearTimeout(timer); };
}

/* ====================== Regole di nome ====================== */
export function montaRegole(el, ctx) {
  const disegna = () => {
    const salvate = regoleSalvate();
    const voce = (r, chiave, salvata) => `<li class="rp-regola">
        <div><b>${escHtml(r.nome)}</b>${r.descrizione ? `<span class="sub">${escHtml(r.descrizione)}</span>` : ''}<span class="mono rp-regola-mod">${escHtml(r.modello)}.pdf</span></div>
        <span class="row"><button class="btn" type="button" data-usa="${chiave}">Usa</button>${salvata ? `<button class="linkbtn" type="button" data-togli="${chiave}">Elimina</button>` : ''}</span></li>`;
    el.innerHTML = `
    <div class="rpdf rpdf-doc">
      <div class="card" id="rp-pronte"><h3>Regole pronte</h3><ul class="rp-lista">${REGOLE_PRONTE.map((r, i) => voce(r, 'p' + i, false)).join('')}</ul></div>
      <div class="card" id="rp-tue"><h3>Salvate da te</h3>${salvate.length ? `<ul class="rp-lista">${salvate.map((r, i) => voce(r, 's' + i, true)).join('')}</ul>` : '<p class="hint">Nessuna regola salvata. In «Rinomina», quando il modello ti convince, usa «Salva questa regola». Le regole restano in questo browser.</p>'}</div>
      <div class="card" id="rp-segnaposto"><h3>Segnaposto</h3>
        <p class="hint">Nel modello del nome scrivi il testo fisso e, tra parentesi graffe, le parti che cambiano da file a file.</p>
        <div class="scroll"><table class="tabella"><thead><tr><th>Segnaposto</th><th>Diventa</th></tr></thead><tbody>
          ${SEGNAPOSTO_FILE.map(s => `<tr><td class="mono"><b>{${s.t}}</b></td><td>${escHtml(s.d)}</td></tr>`).join('')}
          <tr><td class="mono"><b>{COGNOME}</b>, <b>{ID ELABORATO}</b>…</td><td>il valore di quella colonna nella riga dell'Excel collegato</td></tr>
          ${SEGNAPOSTO_PDF.map(s => `<tr><td class="mono"><b>{${s.t}}</b></td><td>${escHtml(s.d)} (con «Leggi dentro i PDF» attivo)</td></tr>`).join('')}
        </tbody></table></div>
        <p class="hint">Esempio: <span class="mono">ELABORATO_{n}_{COGNOME}</span> → <span class="mono">ELABORATO_007_ROSSI.pdf</span>. Spazi, accenti e caratteri non ammessi nei nomi di file vengono sistemati da soli; se due file finirebbero con lo stesso nome, al secondo viene aggiunto _2.</p>
      </div>
    </div>`;
  };
  disegna();
  el.addEventListener('click', e => {
    const u = e.target.closest('[data-usa]'), t = e.target.closest('[data-togli]');
    if (u) {
      const k = u.dataset.usa, r = k[0] === 'p' ? REGOLE_PRONTE[+k.slice(1)] : regoleSalvate()[+k.slice(1)];
      if (r) { applicaRegola(r); ctx.avviso('Regola applicata: ' + r.nome); location.hash = 'rinomina-pdf.rinomina'; }
    }
    if (t) { const l = regoleSalvate(); l.splice(+t.dataset.togli.slice(1), 1); salvaRegole(l); disegna(); ctx.avviso('Regola eliminata'); }
  });
}
