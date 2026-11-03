// Lavori PDF › «Elaborati da Word»: interfaccia.
// Si carica il Word esportato dalla piattaforma, si controlla l'elenco degli elaborati e l'anteprima,
// poi si scarica lo ZIP (Word e/o PDF) oppure si passano i PDF direttamente alla sezione «Rinomina».
import { escHtml, oggiIt } from '../../lib/formati.js';
import { impronta } from '../../lib/attivita.js';
import { fmtDimensione } from '../../lib/file.js';
import { scorriNumero } from '../../js/vivo.js';
import { leggiParagrafi, dividi, nomiFile, problemi, creaDocx, preparaPdf, paragrafiEsempio } from './elaborati.js';
import { pdfLib } from './modifica.js';

const ICONA_GIU = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10"/></svg>';
const ICONA_CARICA = '<svg class="drop-icona" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10m0 0-4-4m4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
const ICONA_AVANTI = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h9m-3-3 3 3-3 3"/></svg>';
const CHIAVE_OPZ = 'cs.elaborati.opz';
const OPZ_BASE = { formato: 'entrambi', modello: 'ID_Elaborato_{ID}', separatori: true, paginaPerDomanda: true };
const FORMATI = { entrambi: 'Word e PDF', pdf: 'Solo PDF', word: 'Solo Word' };
const MAX_FOGLI = 4;

const leggiOpz = () => { try { return { ...OPZ_BASE, ...JSON.parse(localStorage.getItem(CHIAVE_OPZ) || '{}') }; } catch (e) { return { ...OPZ_BASE }; } };
const S = { origine: 'esempio', file: null, paragrafi: paragrafiEsempio(), opz: leggiOpz(), scelto: 0, prec: {}, esito: null };

export function montaElaborati(el, ctx) {
  el.innerHTML = `
  <div class="rpdf">
    <section class="rpdf-riga">
      <div class="card" id="ew-file">
        <h3><span class="n">1</span>File Word della piattaforma</h3>
        <label class="drop" id="ew-drop">
          <input type="file" id="ew-input" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
          ${ICONA_CARICA}
          <strong>Scegli o trascina il file Word</strong>
          <span>quello esportato con tutti i candidati, .docx</span>
        </label>
        <div class="rp-info" id="ew-info"></div>
      </div>
      <div class="card" id="ew-opz">
        <h3><span class="n">2</span>Cosa preparare</h3>
        <div class="ew-opz-riga">
          <div class="field"><label for="ew-formato">File</label><select id="ew-formato">${Object.entries(FORMATI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="field"><label for="ew-modello">Nome dei file</label>
            <div class="rp-modello"><input id="ew-modello" class="mono" spellcheck="false" autocomplete="off"><span class="rp-ext" id="ew-ext">.pdf</span></div>
          </div>
        </div>
        <label class="check"><input type="checkbox" id="ew-sep"><b>Riga «|» dopo ogni risposta</b><small>Come nel programma di prima: segna dove finisce ogni risposta e la fine dell'elaborato.</small></label>
        <label class="check"><input type="checkbox" id="ew-pagina"><b>Ogni domanda su una pagina nuova</b><small>Dalla seconda domanda in poi.</small></label>
        <p class="hint">Nome del candidato, nome della prova e finestra d'esame vengono tolti: in ogni elaborato resta solo l'<b>ID elaborato</b>, scritto anche in testa a ogni pagina. «Question» e «Answer» diventano «Domanda» e «Risposta». Nel nome del file, <span class="mono">{ID}</span> è l'ID elaborato.</p>
      </div>
    </section>
    <section class="barra" id="ew-barra" aria-label="Riepilogo">
      <div class="stats" id="ew-stats"></div>
      <div class="row">
        <button class="btn primary" id="ew-zip" type="button">${ICONA_GIU}<span id="ew-zip-t">Scarica ZIP</span></button>
        <button class="btn" id="ew-rinomina" type="button" title="Crea i PDF e li apre nella sezione «Rinomina», per esempio per dare a ogni elaborato il nome del candidato">${ICONA_AVANTI}<span>Passa a «Rinomina»</span></button>
      </div>
      <div class="ew-avanza" id="ew-avanza" hidden><div class="rp-progresso"><span id="ew-avanza-barra"></span></div><span class="hint" id="ew-avanza-t"></span></div>
      <div class="rp-nota-esempio" id="ew-nota-esempio"><span class="chip info"><span class="dot"></span>Dati di esempio</span><span>Tre candidati inventati, come nel file della piattaforma. Carica il tuo Word per sostituirli.</span></div>
    </section>
    <section class="ew-lavoro">
      <div class="rpdf-elenco" id="ew-elenco">
        <div class="scroll ew-scorri"><table class="tabella">
          <thead><tr><th class="num">#</th><th>ID elaborato</th><th class="num">Domande</th><th class="num">Risposte</th><th>Stato</th></tr></thead>
          <tbody id="ew-tbody"></tbody>
        </table></div>
      </div>
      <div class="card ew-anteprima" id="ew-anteprima">
        <div class="rp-ant-testa"><span class="lat-tit">Anteprima</span><span class="sub mono" id="ew-ant-nome"></span></div>
        <div class="ew-fogli" id="ew-fogli"></div>
      </div>
    </section>
  </div>`;

  const $ = s => el.querySelector(s);
  let vivo = true, occupato = false;

  /* ---------- calcolo ---------- */
  function ricalcola() {
    const r = dividi(S.paragrafi, S.opz);
    const nomi = nomiFile(r.elaborati, S.opz.modello);
    const conta = new Map(); r.elaborati.forEach(e => conta.set(e.id, (conta.get(e.id) || 0) + 1));
    r.elaborati.forEach((e, i) => { e.nome = nomi[i]; e.problemi = problemi(e, !!e.id && conta.get(e.id) > 1); });
    S.esito = r;
    if (S.scelto >= r.elaborati.length) S.scelto = 0;
    disegnaInfo(); disegnaStats(); disegnaTabella(); disegnaAnteprima();
  }

  /* ---------- 1 · file ---------- */
  function disegnaInfo(err) {
    const box = $('#ew-info');
    if (err) { box.innerHTML = `<p class="msg err">${escHtml(err)}</p>`; return; }
    if (S.origine === 'esempio') { box.innerHTML = '<span class="hint">Nessun file caricato: sotto vedi un esempio con tre candidati.</span>'; return; }
    const { elaborati, prima } = S.esito;
    box.innerHTML = `<span><b>${escHtml(S.file.nome)}</b> · ${fmtDimensione(S.file.dimensione)} · ${elaborati.length} ${elaborati.length === 1 ? 'elaborato' : 'elaborati'}</span>` +
      (!elaborati.length ? '<p class="msg err">Nel file non trovo nessuna riga «External ID:»: è il Word esportato dalla piattaforma, con tutti i candidati?</p>' : '') +
      (prima ? `<span class="hint">${prima} ${prima === 1 ? 'riga prima del primo candidato è stata lasciata' : 'righe prima del primo candidato sono state lasciate'} fuori.</span>` : '') +
      `<span class="row"><button class="linkbtn" id="ew-torna" type="button">Torna all'esempio</button></span>`;
    $('#ew-torna').onclick = () => { Object.assign(S, { origine: 'esempio', file: null, paragrafi: paragrafiEsempio(), scelto: 0 }); ricalcola(); };
  }
  async function carica(file) {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { disegnaInfo(/\.doc$/i.test(file.name) ? 'È un .doc del vecchio Word: aprilo in Word e salvalo come .docx, poi caricalo qui.' : 'Serve un file Word .docx.'); return; }
    try {
      const paragrafi = await leggiParagrafi(file);
      Object.assign(S, { origine: 'file', file: { nome: file.name, dimensione: file.size }, paragrafi, scelto: 0 });
      ricalcola();
      ctx.emetti('word-caricato', { elaborati: S.esito.elaborati.length });
    } catch (e) { console.error(e); disegnaInfo(`Non riesco a leggere «${file.name}»: ${e.message || e}.`); }
  }

  /* ---------- 2 · opzioni ---------- */
  function disegnaOpzioni() {
    $('#ew-formato').value = S.opz.formato; $('#ew-modello').value = S.opz.modello;
    $('#ew-sep').checked = S.opz.separatori; $('#ew-pagina').checked = S.opz.paginaPerDomanda;
    $('#ew-ext').textContent = S.opz.formato === 'word' ? '.docx' : S.opz.formato === 'pdf' ? '.pdf' : '.docx / .pdf';
    $('#ew-zip-t').textContent = `Scarica ZIP (${FORMATI[S.opz.formato].replace('Solo ', '')})`;
  }
  const opz = (sel, k, ev = 'change') => $(sel).addEventListener(ev, e => {
    S.opz[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    try { localStorage.setItem(CHIAVE_OPZ, JSON.stringify(S.opz)); } catch (err) { /* il browser non salva */ }
    disegnaOpzioni(); ricalcola(); ctx.emetti('opzioni-cambiate');
  });
  opz('#ew-formato', 'formato'); opz('#ew-modello', 'modello', 'input'); opz('#ew-sep', 'separatori'); opz('#ew-pagina', 'paginaPerDomanda');

  /* ---------- riepilogo ed elenco ---------- */
  function disegnaStats() {
    const { elaborati, nomiTolti } = S.esito;
    const domande = elaborati.reduce((t, e) => t + e.domande, 0), controllare = elaborati.filter(e => e.problemi.length).length;
    const st = (k, chiave, v, cls = '') => `<div class="stat"><span class="k">${k}</span><span class="v ${cls}" data-k="${chiave}" data-v="${v}">${v}</span></div>`;
    $('#ew-stats').innerHTML = st('Elaborati', 'el', elaborati.length) + st('Domande', 'dom', domande) + st('Nomi tolti', 'nomi', nomiTolti) + (controllare ? st('Da controllare', 'ctr', controllare, 'err') : '');
    $('#ew-stats').querySelectorAll('.v').forEach(x => { const k = x.dataset.k, v = +x.dataset.v; scorriNumero(x, S.prec[k] ?? 0, v, String); S.prec[k] = v; });
    $('#ew-zip').disabled = $('#ew-rinomina').disabled = !elaborati.length || occupato;
    $('#ew-nota-esempio').hidden = S.origine !== 'esempio';
  }
  function disegnaTabella() {
    const righe = S.esito.elaborati.map((e, i) => {
      const stato = e.problemi.length ? e.problemi.map(p => `<span class="chip ${p.liv}"><span class="dot"></span>${escHtml(p.testo)}</span>`).join(' ') : '<span class="chip ok"><span class="dot"></span>Pronto</span>';
      return `<tr data-i="${i}" tabindex="0" aria-selected="${i === S.scelto}"><td class="num">${i + 1}</td><td><span class="mono ew-id">${escHtml(e.id || '—')}</span><span class="sub mono ew-nome">${escHtml(e.nome)}</span></td><td class="num">${e.domande}</td><td class="num">${e.risposte}</td><td>${stato}</td></tr>`;
    });
    $('#ew-tbody').innerHTML = righe.join('') || '<tr><td colspan="5" class="vuoto">Nessun elaborato.</td></tr>';
  }
  function scegli(i) {
    S.scelto = i;
    $('#ew-tbody').querySelectorAll('tr[data-i]').forEach(r => r.setAttribute('aria-selected', String(+r.dataset.i === i)));
    disegnaAnteprima();
  }
  $('#ew-tbody').addEventListener('click', e => { const r = e.target.closest('tr[data-i]'); if (r) scegli(+r.dataset.i); });
  $('#ew-tbody').addEventListener('keydown', e => {
    const r = e.target.closest('tr[data-i]'); if (!r) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scegli(+r.dataset.i); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = r[e.key === 'ArrowDown' ? 'nextElementSibling' : 'previousElementSibling']; if (n) { n.focus(); scegli(+n.dataset.i); } }
  });

  /* ---------- anteprima: i fogli come escono, una pagina per domanda ---------- */
  function disegnaAnteprima() {
    const e = S.esito.elaborati[S.scelto];
    $('#ew-ant-nome').textContent = e ? e.nome + (S.opz.formato === 'word' ? '.docx' : '.pdf') : '';
    if (!e) { $('#ew-fogli').innerHTML = '<p class="hint">Nessun elaborato da mostrare.</p>'; return; }
    const fogli = [[]];
    for (const r of e.righe) { if (r.t === 'pagina') fogli.push([]); else fogli[fogli.length - 1].push(r); }
    const para = r => `<p class="${r.t === 'domanda' || r.t === 'risposta' ? 'b' : ''}${r.testo ? '' : ' vuoto'}">${escHtml(r.testo || '')}</p>`;
    $('#ew-fogli').innerHTML = fogli.slice(0, MAX_FOGLI).map((f, i) => `<div class="ew-foglio" aria-label="Pagina ${i + 1}"><div class="ew-pag"><div class="ew-testa">${escHtml(e.intestazione)}</div>${f.map(para).join('')}</div></div>`).join('') +
      (fogli.length > MAX_FOGLI ? `<p class="hint">… e altre ${fogli.length - MAX_FOGLI} pagine.</p>` : '');
  }

  /* ---------- creazione dei file ---------- */
  function avanzamento(testo, k) {
    $('#ew-avanza').hidden = testo == null;
    if (testo != null) { $('#ew-avanza-t').textContent = testo; $('#ew-avanza-barra').style.width = Math.round(k * 100) + '%'; }
  }
  /** Crea i file uno per elaborato; `cosa` = { word, pdf }. Chiama `dove(e, tipo, bytes)` per ognuno. */
  async function crea({ word, pdf }, dove) {
    const els = S.esito.elaborati, tot = els.length * ((word ? 1 : 0) + (pdf ? 1 : 0));
    let fatti = 0;
    const creaPdf = pdf ? preparaPdf(await pdfLib()) : null;
    for (const e of els) {
      if (!vivo) throw new Error('interrotto');
      if (word) { dove(e, 'docx', await creaDocx(e)); avanzamento(`Preparo i Word… ${++fatti} di ${tot}`, fatti / tot); }
      if (pdf) { dove(e, 'pdf', await creaPdf(e)); avanzamento(`Preparo i PDF… ${++fatti} di ${tot}`, fatti / tot); }
      if (fatti % 8 === 0) await new Promise(r => setTimeout(r));   // lascia respirare la pagina
    }
  }
  async function esegui(btn, fn) {
    if (occupato) return;
    occupato = true; disegnaStats();
    try { await fn(); }
    catch (e) { if (vivo) { console.error(e); ctx.avviso('Errore: ' + (e.message || e)); } }
    finally { occupato = false; if (vivo) { avanzamento(null); disegnaStats(); } }
  }
  $('#ew-zip').addEventListener('click', () => esegui($('#ew-zip'), async () => {
    const f = S.opz.formato, word = f !== 'pdf', pdf = f !== 'word';
    const zip = new JSZip();
    await crea({ word, pdf }, (e, tipo, bytes) => zip.file((tipo === 'pdf' && word ? 'PDF/' : '') + `${e.nome}.${tipo}`, bytes, { binary: true }));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', mimeType: 'application/zip' }, m => avanzamento(`Preparo lo ZIP… ${Math.round(m.percent)}%`, m.percent / 100));
    const base = S.file ? S.file.nome.replace(/\.docx$/i, '') : 'Elaborati di esempio';
    if (await ctx.salva(`${base} - elaborati - ${oggiIt()}.zip`, blob)) {
      ctx.emetti('scaricato');
      if (S.origine !== 'esempio') ctx.registra?.({ azione: 'elaborati', n: S.esito.elaborati.length, chiave: impronta(S.esito.elaborati.map(e => e.nome).join('|')) });
    }
  }));
  $('#ew-rinomina').addEventListener('click', () => esegui($('#ew-rinomina'), async () => {
    const file = [];
    await crea({ pdf: true }, (e, tipo, bytes) => file.push(new File([bytes], `${e.nome}.pdf`, { type: 'application/pdf' })));
    const { consegnaPdf } = await import('./vista.js');
    consegnaPdf(file, { da: 'Elaborati da Word' });
    ctx.emetti('passato-a-rinomina');
    location.hash = 'rinomina-pdf.rinomina';
  }));

  /* ---------- eventi ---------- */
  $('#ew-input').addEventListener('change', e => { carica(e.target.files[0]); e.target.value = ''; });
  const drop = $('#ew-drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); carica(e.dataTransfer.files[0]); });

  disegnaOpzioni(); ricalcola();
  return () => { vivo = false; };
}
