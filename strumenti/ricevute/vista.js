// Ricevute: interfaccia delle tre sezioni (Genera, Modello Excel, Come si calcola).
import { escHtml, fmtNum, fmtEuro, isEmpty, isoToIt, colLetter, oggiIt, parseMoney } from '../../lib/formati.js';
import { leggiFoglio, trovaIntestazione, abbinaColonne, intestazioni } from '../../lib/excel.js';
import { CAMPI, COLONNE_MODELLO, RIGHE_ESEMPIO, costruisciRicevute, daNetto, daLordo, SOGLIA_BOLLO } from './dati.js';
import { creaDocx, creaZip, creaUnico } from './word.js';
import { caricaRisorsa } from '../../lib/risorse.js';

const COMMITTENTE = { nome: 'C&S CONSULENZA E SELEZIONE S.R.L.', citta: 'ROMA', indirizzo: 'Via Roberto Paribeni n. 2, CAP 00173', piva: '11312051003' };
const URL_MODELLO_XLSX = new URL('./modello-ricevute.xlsx', import.meta.url);
const ICONA_GIU = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10"/></svg>';

/* Lo stato resta tra un cambio di sezione e l'altro: il file caricato non si perde. */
const S = {
  origine: 'esempio', nomeFile: '', fogli: [{ nome: 'Esempio', righe: RIGHE_ESEMPIO }], foglio: 0, date1904: false,
  riga: 0, mappa: {}, comuni: {}, opzioni: { maiuscolo: true, raggruppa: false },
  ricevute: [], righeLette: 0, scelta: 0,
};
try { const o = JSON.parse(localStorage.getItem('cs.ricevute.opzioni') || 'null'); if (o) Object.assign(S.opzioni, o); } catch (e) { /* niente memoria locale */ }
const righe = () => S.fogli[S.foglio].righe;
function rileva() { S.riga = trovaIntestazione(righe(), CAMPI); S.mappa = abbinaColonne(intestazioni(righe(), S.riga), CAMPI); }
rileva();

/* ====================== Genera ====================== */
export function montaGenera(el, ctx) {
  el.innerHTML = `
  <div class="ric">
    <section class="ric-passi">
      <div class="card" id="ric-file">
        <h3><span class="n">1</span>File Excel</h3>
        <label class="drop" id="ric-drop">
          <input type="file" id="ric-input" accept=".xlsx,.xlsm,.csv">
          <strong>Scegli o trascina il file</strong>
          <span>.xlsx oppure .csv · una riga per collaboratore</span>
        </label>
        <div class="ric-info" id="ric-info"></div>
        <p class="hint">Non hai ancora il file? <a href="#ricevute.modello">Scarica il modello Excel</a>.</p>
      </div>
      <div class="card" id="ric-comuni">
        <h3><span class="n">2</span>Valori comuni</h3>
        <p class="hint">Usati solo dove la cella del file è vuota. Comodi quando tutti hanno lavorato allo stesso concorso.</p>
        <div class="ric-campi">
          <div class="field largo"><label for="ric-c-mansione">Mansione svolta</label><input id="ric-c-mansione" data-comune="mansione" placeholder="es. ASSISTENZA D'AULA PER CONCORSO PUBBLICO"></div>
          <div class="field"><label for="ric-c-ente">Ente</label><input id="ric-c-ente" data-comune="ente" placeholder="es. COMUNE DI SELARGIUS"></div>
          <div class="field"><label for="ric-c-tipologia">Tipologia di concorso</label><input id="ric-c-tipologia" data-comune="tipologia" list="ric-dl-tipologia" placeholder="es. IN PRESENZA"></div>
          <div class="field"><label for="ric-c-dataAttivita">Data attività</label><input id="ric-c-dataAttivita" data-comune="dataAttivita" type="date"></div>
          <div class="field"><label for="ric-c-netto">Compenso netto (€)</label><input id="ric-c-netto" data-comune="netto" inputmode="decimal" placeholder="es. 70,00"></div>
          <div class="field"><label for="ric-c-luogoRic">Luogo della ricevuta</label><input id="ric-c-luogoRic" data-comune="luogoRic" placeholder="se vuoto: comune dell'ente"></div>
          <div class="field"><label for="ric-c-dataRic">Data della ricevuta</label><input id="ric-c-dataRic" data-comune="dataRic" type="date"></div>
        </div>
        <datalist id="ric-dl-tipologia"><option value="IN PRESENZA"></option><option value="DA REMOTO"></option></datalist>
      </div>
      <div class="card ric-opz" id="ric-opzioni">
        <h3><span class="n">3</span>Opzioni</h3>
        <label class="check"><input type="checkbox" id="ric-maiuscolo"><b>Tutto in maiuscolo</b><small>Come nel modello originale.</small></label>
        <label class="check"><input type="checkbox" id="ric-raggruppa"><b>Una ricevuta per persona</b><small>Le righe con lo stesso codice fiscale diventano una ricevuta sola, con più righe nel report e importi sommati.</small></label>
      </div>
    </section>

    <details class="ric-mappa" id="ric-mappa">
      <summary><span>Abbinamento colonne</span><span id="ric-mappa-sintesi" class="chip ghost">—</span></summary>
      <div class="ric-mappa-corpo">
        <p class="hint">Le colonne vengono riconosciute dal nome dell'intestazione. Se qualcosa non torna, scegli la colonna giusta.
          Intestazioni alla riga <input class="sel ric-riga" id="ric-riga" type="number" min="1" value="1" aria-label="Riga delle intestazioni">.</p>
        <div class="ric-mappa-griglia" id="ric-mappa-griglia"></div>
      </div>
    </details>

    <section class="barra" id="ric-barra" aria-label="Riepilogo">
      <div class="stats" id="ric-stats"></div>
      <div class="row">
        <button class="btn primary" id="ric-zip" type="button">${ICONA_GIU}<span>Scarica tutte (ZIP)</span></button>
        <button class="btn" id="ric-unico" type="button" title="Un solo documento Word con tutte le ricevute: comodo per stampare">Unico file Word</button>
      </div>
      <div class="ric-esempio" id="ric-esempio"><span class="chip info"><span class="dot"></span>Dati di esempio</span><span>Tre ricevute di prova con dati inventati. Carica il tuo file per sostituirle.</span></div>
    </section>

    <section class="ric-risultati">
      <div class="ric-elenco" id="ric-elenco">
        <div class="scroll"><table class="tabella">
          <thead><tr><th>Collaboratore</th><th class="ric-nasc">Attività</th><th class="num">Lordo</th><th class="num ric-nasc">Ritenuta</th><th class="num">Netto</th><th>Stato</th></tr></thead>
          <tbody id="ric-tbody"></tbody>
        </table></div>
      </div>
      <aside class="ric-anteprima" id="ric-anteprima" aria-label="Anteprima ricevuta"></aside>
    </section>
  </div>`;

  const $ = s => el.querySelector(s);
  const ricalcola = (tieni) => {
    const prima = S.ricevute[S.scelta];
    const r = costruisciRicevute({ righe: righe(), riga: S.riga, mappa: S.mappa, comuni: S.comuni, opzioni: S.opzioni, date1904: S.date1904 });
    S.ricevute = r.ricevute; S.righeLette = r.righeLette;
    if (tieni && prima) { const j = S.ricevute.findIndex(x => x.att[0] && prima.att[0] && x.att[0].riga === prima.att[0].riga); S.scelta = j >= 0 ? j : 0; }
    else S.scelta = 0;
    disegnaInfo(); disegnaMappa(); disegnaStats(); disegnaTabella(); disegnaAnteprima();
  };
  let timer; const ricalcolaPresto = () => { clearTimeout(timer); timer = setTimeout(() => ricalcola(true), 160); };

  function disegnaInfo(err) {
    const box = $('#ric-info');
    if (err) { box.innerHTML = `<p class="msg err">${escHtml(err)}</p>`; return; }
    if (S.origine === 'esempio') { box.innerHTML = '<span class="hint">Nessun file caricato: sotto vedi tre ricevute di esempio.</span>'; return; }
    const f = S.fogli;
    box.innerHTML = `<span class="ric-nomefile">${escHtml(S.nomeFile)}</span>` +
      (f.length > 1 ? `<div class="field"><label for="ric-foglio">Foglio</label><select id="ric-foglio">${f.map((x, i) => `<option value="${i}"${i === S.foglio ? ' selected' : ''}>${escHtml(x.nome)}</option>`).join('')}</select></div>` : '') +
      `<span class="hint">${S.righeLette} ${S.righeLette === 1 ? 'riga letta' : 'righe lette'} dal foglio «${escHtml(f[S.foglio].nome)}»</span>` +
      `<span><button class="linkbtn" id="ric-torna-esempio" type="button">Torna ai dati di esempio</button></span>`;
    const sel = $('#ric-foglio');
    if (sel) sel.onchange = () => { S.foglio = +sel.value; rileva(); ricalcola(); };
    $('#ric-torna-esempio').onclick = () => { Object.assign(S, { origine: 'esempio', nomeFile: '', fogli: [{ nome: 'Esempio', righe: RIGHE_ESEMPIO }], foglio: 0, date1904: false }); rileva(); ricalcola(); };
  }

  function disegnaMappa() {
    const ints = intestazioni(righe(), S.riga);
    const trovati = CAMPI.filter(f => S.mappa[f.k] != null).length;
    const mancaReq = CAMPI.filter(f => f.req && S.mappa[f.k] == null);
    const mancaImporto = S.mappa.lordo == null && S.mappa.netto == null && !S.comuni.netto;
    const sint = $('#ric-mappa-sintesi');
    sint.className = 'chip ' + (mancaReq.length || mancaImporto ? 'warn' : 'ok');
    sint.textContent = `${trovati} di ${CAMPI.length} campi trovati` + (mancaReq.length ? ' · manca ' + mancaReq.map(f => f.label.toLowerCase()).join(', ') : '') + (mancaImporto ? ' · manca il compenso' : '');
    $('#ric-riga').value = S.riga + 1;
    const opz = ints.map((h, i) => ({ i, t: colLetter(i) + ' · ' + (h || '(senza intestazione)') }));
    $('#ric-mappa-griglia').innerHTML = CAMPI.map(f => {
      const cur = S.mappa[f.k];
      const manca = cur == null && (f.req || ((f.k === 'lordo' || f.k === 'netto') && mancaImporto));
      return `<div class="ric-mappa-voce${manca ? ' manca' : ''}"><label for="ric-m-${f.k}">${escHtml(f.label)}${f.req ? ' <span class="chip ghost">obbligatorio</span>' : ''}</label>
        <select class="sel" id="ric-m-${f.k}" data-campo="${f.k}"><option value="">— nessuna colonna${f.comune ? ' (usa valore comune)' : ''} —</option>${opz.map(o => `<option value="${o.i}"${o.i === cur ? ' selected' : ''}>${escHtml(o.t)}</option>`).join('')}</select></div>`;
    }).join('');
  }

  function disegnaStats() {
    const ok = S.ricevute.filter(r => !r.errori.length);
    const ko = S.ricevute.length - ok.length;
    const tot = k => ok.reduce((s, r) => s + r[k], 0);
    const st = (k, v, c = '') => `<div class="stat"><span class="k">${k}</span><span class="v ${c}">${v}</span></div>`;
    $('#ric-stats').innerHTML = st('Righe', S.righeLette) + st('Ricevute pronte', ok.length) + (ko ? st('Da sistemare', ko, 'err') : '') +
      st('Totale lordo', fmtEuro(tot('lordo'))) + st('Ritenute', fmtEuro(tot('rit'))) + st('Totale netto', fmtEuro(tot('netto')));
    $('#ric-zip').disabled = !ok.length; $('#ric-unico').disabled = !ok.length;
    $('#ric-esempio').hidden = S.origine !== 'esempio';
  }

  const stato = r => {
    if (r.errori.length) return '<span class="chip err"><span class="dot"></span>Da sistemare</span>';
    let h = r.avvisi.length ? `<span class="chip warn"><span class="dot"></span>${r.avvisi.length} ${r.avvisi.length === 1 ? 'avviso' : 'avvisi'}</span>` : '<span class="chip ok"><span class="dot"></span>Pronta</span>';
    if (r.bollo) h += ' <span class="chip ghost" title="Compenso oltre 77,47 €: va applicata la marca da bollo da 2,00 €">Bollo 2 €</span>';
    return h;
  };
  function disegnaTabella() {
    const tb = $('#ric-tbody');
    if (!S.ricevute.length) {
      const perche = S.origine === 'esempio' ? 'Nessuna ricevuta.' : (righe().length <= S.riga + 1 ? 'Il foglio non contiene righe sotto le intestazioni.' : 'Nessuna riga con dati nelle colonne abbinate.');
      tb.innerHTML = `<tr><td colspan="6" class="vuoto">${escHtml(perche)}</td></tr>`; return;
    }
    tb.innerHTML = S.ricevute.map((r, i) => {
      const a = r.att;
      const att = a.length === 1 ? `${escHtml(a[0].ente || '—')}<div class="sub">${escHtml(a[0].data || '')}${a[0].tipologia ? ' · ' + escHtml(a[0].tipologia) : ''}</div>`
        : `${a.length} attività<div class="sub">${escHtml([...new Set(a.map(x => x.ente).filter(Boolean))].join(', '))}</div>`;
      const m = k => r.errori.length ? '—' : fmtNum(r[k]);
      return `<tr data-i="${i}" tabindex="0" aria-selected="${i === S.scelta}" class="${r.errori.length ? 'ko' : ''}">
        <td><div class="ric-chi">${escHtml(r.nominativo || '(senza nome)')}</div><div class="sub mono">${escHtml(r.p.cf || 'CF mancante')}</div></td>
        <td class="ric-nasc">${att}</td><td class="num">${m('lordo')}</td><td class="num ric-nasc">${m('rit')}</td><td class="num"><b>${m('netto')}</b></td><td>${stato(r)}</td></tr>`;
    }).join('');
  }

  const pv = v => v ? escHtml(v) : '<span class="ric-manca" title="mancante"></span>';
  function disegnaAnteprima() {
    const box = $('#ric-anteprima');
    const r = S.ricevute[S.scelta];
    if (!r) { box.innerHTML = '<div class="ric-scrivania"><div class="vuoto">L\'anteprima compare qui quando c\'è almeno una riga.</div></div>'; return; }
    const f = r.campi;
    const note = (r.errori.length ? `<ul class="ric-note err">${r.errori.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>` : '') +
      (r.avvisi.length ? `<ul class="ric-note warn">${r.avvisi.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>` : '') +
      (r.bollo ? '<ul class="ric-note info"><li>Compenso lordo oltre 77,47 €: sulla ricevuta va applicata la marca da bollo da 2,00 €.</li></ul>' : '');
    box.innerHTML = `
      <div class="ric-ant-testa"><h3>${escHtml(r.mostra)}<span class="sub"> · riga ${r.att.map(a => a.riga).join(', ')}</span></h3>
        <button class="btn" id="ric-una" type="button"${r.errori.length ? ' disabled' : ''}>Scarica questa (.docx)</button></div>
      ${note}
      <div class="ric-scrivania">
        <div class="ric-foglio"><div class="ric-pg ric-p1">
          <p>Il/La sottoscritto/a <b>${pv(f.NOMINATIVO)}</b></p>
          <p>nato/a <b>${pv(f.NASCITA)}</b></p>
          <p>e residente in <b>${pv(f.RESIDENZA)}</b></p>
          <p>${escHtml(f.VIA_LABEL)} <b>${pv(f.INDIRIZZO)}</b></p>
          <p>Codice Fiscale: <b>${pv(f.CF)}</b></p>
          <p>Tipologia di documento: <b>${pv(f.TIPO_DOC)}</b></p>
          <p>Numero di documento: <b>${pv(f.NUM_DOC)}</b></p>
          <p>Tel.: <b>${escHtml(f.TEL)}</b>Cell.: <b>${escHtml(f.CELL)}</b>Indirizzo e-mail: <b>${pv(f.EMAIL)}</b></p>
          <p class="s12">IBAN: <b>${pv(f.IBAN)}</b></p>
          <p>Mansione/i svolta/e: <b class="s12">${pv(f.MANSIONE)}</b></p>
          <p class="c u s12"><b>DICHIARA</b></p>
          <p class="c s11">di aver ricevuto dalla Società <b>${escHtml(COMMITTENTE.nome)}</b>, con sede legale in<br><b>${escHtml(COMMITTENTE.citta)}</b>, ${escHtml(COMMITTENTE.indirizzo)}, Codice Fiscale e Partita IVA n. <b>${COMMITTENTE.piva}</b><br>quale compenso per l’attività svolta occasionalmente:</p>
          <table class="amt">
            <tr><td>DESCRIZIONE</td><td>IMPORTO</td></tr>
            <tr><td>COMPETENZE CONCORDATE</td><td class="s14">${escHtml(f.LORDO)}</td></tr>
            <tr><td>RITENUTA D’ACCONTO (20%)</td><td class="s14">${escHtml(f.RITENUTA)}</td></tr>
            <tr><td>TRATTENUTA INPS (DA CALCOLARE AL SUPERAMENTO DI € 5.000,00)</td><td class="s14">${escHtml(f.INPS)}</td></tr>
            <tr><td><b>NETTO A PAGARE CON BONIFICO</b></td><td class="s14"><b>${escHtml(f.NETTO)}</b></td></tr>
          </table>
          <p class="s11">Dichiara inoltre sotto la propria responsabilità che tale compenso:</p>
          <ul>
            <li>ha carattere del tutto occasionale, non svolgendo il sottoscritto prestazioni di lavoro autonomo con carattere di abitualità;</li>
            <li>è soggetta a ritenuta d’acconto ai sensi dell’art. 25 del D.P.R. n. 600/1973;</li>
            <li>non è soggetto al regime IVA a norma dell’art. 5 del D.P.R. n. 633/1972 e successive modificazioni;</li>
            <li>non è assoggettato a contributo previdenziale in quanto nel corso dell’anno solare il totale dei compensi ricevuti a titolo di collaborazione occasionale supera/non supera i 5.000,00 euro.</li>
          </ul>
          <p class="s11">LUOGO E DATA <b>${pv(f.LUOGO_FIRMA)}</b><b class="s14">${escHtml(f.DATA_FIRMA)}</b></p>
        </div><span class="ric-pgnum">pagina 1</span></div>
        <div class="ric-foglio"><div class="ric-pg ric-p2">
          <p class="hdr">RICEVUTA COMPENSO PER PRESTAZIONE OCCASIONALE</p>
          <table class="rep"><tr><td colspan="4">REPORT ATTIVITÀ</td></tr><tr><td>ENTE</td><td>DATA</td><td>TIPOLOGIA DI CONCORSO</td><td>COMPENSO NETTO</td></tr>
          ${r.righeReport.map(x => `<tr><td>${escHtml(x.R_ENTE)}</td><td>${escHtml(x.R_DATA)}</td><td>${escHtml(x.R_TIPO)}</td><td>${escHtml(x.R_NETTO)}</td></tr>`).join('')}</table>
        </div><span class="ric-pgnum">pagina 2</span></div>
      </div>`;
    const b = $('#ric-una');
    if (b) b.onclick = () => esegui(b, async () => { if (await ctx.salva(r.file, await creaDocx(r))) ctx.emetti('scaricato', { quante: 1 }); });
  }

  async function esegui(btn, fn) {
    if (btn.disabled) return;
    const html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span>Preparo…</span>';
    try { await fn(); } catch (e) { console.error(e); ctx.avviso('Errore durante la creazione: ' + (e.message || e)); }
    finally { btn.disabled = false; btn.innerHTML = html; disegnaStats(); }
  }

  async function carica(file) {
    try {
      const wb = await leggiFoglio(file);
      Object.assign(S, { origine: 'file', nomeFile: file.name, fogli: wb.fogli, date1904: wb.date1904 });
      S.foglio = Math.max(0, wb.fogli.findIndex(s => s.righe.some(r => r && r.some(c => !isEmpty(c)))));
      rileva(); ricalcola();
      if (CAMPI.some(f => f.req && S.mappa[f.k] == null)) $('#ric-mappa').open = true;
      ctx.emetti('file-caricato', { righe: S.righeLette });
    } catch (e) { console.error(e); disegnaInfo(e.message || String(e)); }
  }

  /* eventi */
  $('#ric-input').addEventListener('change', e => { const f = e.target.files[0]; if (f) carica(f); e.target.value = ''; });
  const drop = $('#ric-drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) carica(f); });
  el.querySelectorAll('[data-comune]').forEach(inp => {
    const k = inp.dataset.comune;
    if (S.comuni[k]) inp.value = inp.type === 'date' ? S.comuni[k].split('/').reverse().join('-') : S.comuni[k];
    inp.addEventListener('input', () => { S.comuni[k] = inp.type === 'date' ? isoToIt(inp.value) : inp.value; ricalcolaPresto(); ctx.emetti('valori-comuni'); });
  });
  $('#ric-mappa-griglia').addEventListener('change', e => {
    const s = e.target.closest('select[data-campo]'); if (!s) return;
    const k = s.dataset.campo;
    if (s.value === '') delete S.mappa[k];
    else { const v = +s.value; for (const kk of Object.keys(S.mappa)) if (S.mappa[kk] === v) delete S.mappa[kk]; S.mappa[k] = v; }
    ricalcola(true);
  });
  $('#ric-riga').addEventListener('change', e => {
    const v = Math.max(1, Math.min(righe().length || 1, parseInt(e.target.value, 10) || 1));
    S.riga = v - 1; S.mappa = abbinaColonne(intestazioni(righe(), S.riga), CAMPI); ricalcola();
  });
  const salvaOpz = () => { try { localStorage.setItem('cs.ricevute.opzioni', JSON.stringify(S.opzioni)); } catch (e) { /* ignora */ } };
  $('#ric-maiuscolo').checked = S.opzioni.maiuscolo; $('#ric-raggruppa').checked = S.opzioni.raggruppa;
  $('#ric-maiuscolo').addEventListener('change', e => { S.opzioni.maiuscolo = e.target.checked; salvaOpz(); ricalcola(true); });
  $('#ric-raggruppa').addEventListener('change', e => { S.opzioni.raggruppa = e.target.checked; salvaOpz(); ricalcola(); });
  const seleziona = i => {
    S.scelta = i;
    el.querySelectorAll('#ric-tbody tr[data-i]').forEach(tr => tr.setAttribute('aria-selected', String(+tr.dataset.i === i)));
    disegnaAnteprima();
    ctx.emetti('ricevuta-scelta', { i });
  };
  $('#ric-tbody').addEventListener('click', e => { const tr = e.target.closest('tr[data-i]'); if (tr) seleziona(+tr.dataset.i); });
  $('#ric-tbody').addEventListener('keydown', e => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const i = +tr.dataset.i;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seleziona(i); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); const j = Math.max(0, Math.min(S.ricevute.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      seleziona(j); el.querySelector(`#ric-tbody tr[data-i="${j}"]`)?.focus();
    }
  });
  const pronte = () => S.ricevute.filter(r => !r.errori.length);
  $('#ric-zip').addEventListener('click', e => esegui(e.currentTarget, async () => {
    const ok = pronte();
    if (await ctx.salva(`Ricevute prestazione occasionale - ${oggiIt()}.zip`, await creaZip(ok))) ctx.emetti('scaricato', { quante: ok.length });
  }));
  $('#ric-unico').addEventListener('click', e => esegui(e.currentTarget, async () => {
    const ok = pronte();
    if (await ctx.salva(`Ricevute prestazione occasionale - tutte - ${oggiIt()}.docx`, await creaUnico(ok))) ctx.emetti('scaricato', { quante: ok.length });
  }));

  ricalcola(true);
  return () => clearTimeout(timer);
}

/* ====================== Modello Excel ====================== */
export function montaModello(el, ctx) {
  el.innerHTML = `
  <div class="ric ric-doc">
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div><h3>Modello ricevute occasionali.xlsx</h3><p class="hint">Foglio «Dati» da compilare, foglio «Esempio» con tre righe inventate, foglio «Istruzioni».</p></div>
        <button class="btn primary" id="ric-scarica-modello" type="button">${ICONA_GIU}Scarica modello Excel</button>
      </div>
    </div>
    <div class="card" id="ric-colonne">
      <h3>Colonne</h3>
      <p class="hint">Va bene anche un Excel vostro con intestazioni diverse: le colonne vengono riconosciute dal nome (Nominativo, C.F., Nato a, Netto…) e si possono abbinare a mano.</p>
      <div class="scroll"><table class="tabella">
        <thead><tr><th>Colonna</th><th>Obbligatoria</th><th>Note</th></tr></thead>
        <tbody>${COLONNE_MODELLO.map(([c, req, nota]) => `<tr><td class="mono"><b>${escHtml(c)}</b></td><td>${req ? '<span class="chip info">sì</span>' : ''}</td><td>${escHtml(nota)}</td></tr>`).join('')}
        <tr><td class="mono"><b>COMPENSO</b></td><td><span class="chip info">uno dei due</span></td><td>Serve il lordo oppure il netto, nel file o nei «Valori comuni».</td></tr></tbody>
      </table></div>
    </div>
  </div>`;
  el.querySelector('#ric-scarica-modello').addEventListener('click', async () => {
    let blob;
    try { blob = await caricaRisorsa(URL_MODELLO_XLSX); } catch (e) { ctx.avviso(e.message); return; }
    if (await ctx.salva('Modello ricevute occasionali.xlsx', blob)) ctx.emetti('modello-scaricato');
  });
}

/* ====================== Come si calcola ====================== */
export function montaCalcoli(el) {
  el.innerHTML = `
  <div class="ric ric-doc ric-calc">
    <div class="card" id="ric-calcolatrice">
      <h3>Prova un importo</h3>
      <div class="ric-calc-campi">
        <div class="field"><label for="ric-k-importo">Importo (€)</label><input id="ric-k-importo" inputmode="decimal" value="70,00"></div>
        <div class="field"><label for="ric-k-tipo">È il…</label><select id="ric-k-tipo"><option value="netto">netto da pagare</option><option value="lordo">lordo concordato</option></select></div>
        <div class="field"><label for="ric-k-inps">Trattenuta INPS (€)</label><input id="ric-k-inps" inputmode="decimal" placeholder="0,00"></div>
      </div>
      <table class="tabella ric-calc-ris" id="ric-k-ris"></table>
    </div>
    <div class="card">
      <h3>Regole usate</h3>
      <ul class="ric-regole">
        <li><b>Ritenuta d'acconto</b>: 20% del lordo (art. 25 D.P.R. 600/1973).</li>
        <li><b>Dal netto al lordo</b>: lordo = (netto + trattenuta INPS) ÷ 0,8. Con 70,00 € netti il lordo è 87,50 € e la ritenuta 17,50 €.</li>
        <li><b>Dal lordo al netto</b>: netto = lordo − ritenuta − trattenuta INPS.</li>
        <li><b>Trattenuta INPS</b>: solo oltre 5.000 € di compensi occasionali nell'anno; va indicata nel file, non viene calcolata.</li>
        <li><b>Marca da bollo</b>: oltre 77,47 € di compenso la ricevuta va assoggettata a bollo da 2,00 €; l'elenco lo segnala.</li>
        <li><b>Arrotondamenti</b>: al centesimo; i conti si fanno in centesimi per evitare errori di virgola.</li>
        <li><b>Controlli</b>: codice fiscale (carattere di controllo) e IBAN (verifica internazionale mod 97).</li>
      </ul>
    </div>
  </div>`;
  const $ = s => el.querySelector(s);
  const aggiorna = () => {
    const v = parseMoney($('#ric-k-importo').value), inps = parseMoney($('#ric-k-inps').value) || 0;
    const out = $('#ric-k-ris');
    if (v == null || Number.isNaN(v) || Number.isNaN(inps) || v <= 0) { out.innerHTML = '<tr><td class="vuoto">Scrivi un importo, per esempio 70,00.</td></tr>'; return; }
    const c = $('#ric-k-tipo').value === 'netto' ? daNetto(v, inps) : daLordo(v, inps);
    out.innerHTML = `<tr><td>Competenze concordate (lordo)</td><td class="num">${fmtEuro(c.lordo)}</td></tr>
      <tr><td>Ritenuta d'acconto 20%</td><td class="num">${fmtEuro(c.rit)}</td></tr>
      <tr><td>Trattenuta INPS</td><td class="num">${c.inps ? fmtEuro(c.inps) : '—'}</td></tr>
      <tr><td><b>Netto a pagare con bonifico</b></td><td class="num"><b>${fmtEuro(c.netto)}</b></td></tr>
      ${c.lordo > SOGLIA_BOLLO ? '<tr><td colspan="2"><span class="chip ghost">Bollo 2 €</span> Oltre 77,47 €: serve la marca da bollo.</td></tr>' : ''}`;
  };
  el.querySelectorAll('input, select').forEach(x => x.addEventListener('input', aggiorna));
  aggiorna();
}
