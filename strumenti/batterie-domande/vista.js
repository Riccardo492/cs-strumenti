// Batterie di domande: interfaccia delle quattro sezioni.
// Lo stato è in stato.js; generazione e controllo continuano anche se si cambia sezione,
// e ogni sezione aperta si ridisegna quando qualcosa cambia.
import { escHtml, norm, clean, oggiIt, safeName, isEmpty } from '../../lib/formati.js';
import { leggiFoglio, trovaIntestazione, intestazioni } from '../../lib/excel.js';
import { creaXlsx } from '../../lib/xlsx.js';
import { emetti } from '../../js/eventi.js';
import { comparsa } from '../../js/vivo.js';
import {
  S, salva, ricomincia, tornaEsempio, diventaMia, DIFFICOLTA, LIVELLI, LETTERE, nomeDifficolta, ripartisci,
  materia, nomeMateria, nuovaMateria, togliMateria, domandeDi, domanda, aggiungiDomande, sostituisci, togliDomanda,
  domandeOrdinate, problemi, ISTRUZIONI_BASE,
} from './stato.js';
import { claude, spiegaErrore, leggiJson, normalizzaDomande, normalizzaControllo, richiestaGenera, richiestaGeneraTutto, richiestaControllo, richiestaMaterie, chiedi, inParti } from './ia.js';
import { trovaDoppioni } from './doppioni.js';
import { creaVersioni, ORDINI } from './versioni.js';
import { creaDocx, creaZip } from './word.js';

const ID = 'batterie-domande';
const ICONA_GIU = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10"/></svg>';
const ICONA_CARICA = '<svg class="drop-icona" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10m0 0-4-4m4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';
const ICONA_STELLA = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8 9.4 6.6 14.2 8 9.4 9.4 8 14.2 6.6 9.4 1.8 8 6.6 6.6z"/></svg>';
const MAX_CONTROLLO = 25;

/* ====================== stato dell'interfaccia ====================== */
const ascoltatori = new Set();
const avvisa = () => ascoltatori.forEach(f => f());
let giro = 0;
function cambiato() { giro++; salva(); avvisa(); }
function registra(fn) {
  let raf = 0;
  const g = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { fn(); } catch (e) { console.error(e); } }); };
  ascoltatori.add(g);
  return () => { ascoltatori.delete(g); cancelAnimationFrame(raf); };
}

let modo = null;              // 'claude' | 'copia' | null (non ancora noto)
claude().then(f => { modo = f ? 'claude' : 'copia'; avvisa(); });
let lavoro = null;            // il lavoro in corso con Claude
const esiti = {};             // ultimo esito per sezione: { tipo: 'ok'|'err'|'info', testo }
const copiaAperta = { genera: false, controllo: false };

let doppiGiro = -1, doppiCache = new Map();
function doppi() { if (doppiGiro !== giro) { doppiCache = trovaDoppioni(domandeOrdinate()); doppiGiro = giro; } return doppiCache; }

const somma = c => c.facile + c.media + c.difficile;
function conteggio(m) {
  const per = { facile: 0, media: 0, difficile: 0 };
  const qs = domandeDi(m.id); for (const q of qs) per[q.difficolta] = (per[q.difficolta] || 0) + 1;
  return { tot: qs.length, per };
}
/** Quante domande mancano a una materia, per livello. */
function mancanti(m) {
  const out = { facile: 0, media: 0, difficile: 0 };
  if (!m.nome.trim() || !(m.quante > 0)) return out;
  const target = ripartisci(m.quante, m.difficolta), { tot, per } = conteggio(m);
  let resto = Math.max(0, m.quante - tot);
  for (const l of LIVELLI) { const k = Math.min(resto, Math.max(0, target[l] - (per[l] || 0))); out[l] = k; resto -= k; }
  if (resto > 0) out[m.difficolta === 'mista' ? 'media' : m.difficolta] += resto;
  return out;
}
const totaleMancanti = () => S.materie.reduce((a, m) => a + somma(mancanti(m)), 0);

/** Domande con problemi (escluse le confermate) e domande ancora da controllare. */
function classifica() {
  const d = doppi();
  const out = { tutte: [], rivedere: [], fuori: [], risposta: [], doppioni: [], dafare: [], confermate: [], ok: [] };
  for (const q of domandeOrdinate()) {
    const p = problemi(q, d);
    const veri = p.filter(x => x.tipo !== 'da-controllare');
    out.tutte.push(q);
    if (p.some(x => x.tipo === 'da-controllare')) out.dafare.push(q);
    if (q.accettata) { out.confermate.push(q); continue; }
    if (veri.length) out.rivedere.push(q);
    if (veri.some(x => x.tipo === 'fuori-tema' || x.tipo === 'attinenza-dubbia')) out.fuori.push(q);
    if (veri.some(x => x.tipo === 'risposta-errata' || x.tipo === 'risposta-dubbia')) out.risposta.push(q);
    if (veri.some(x => x.tipo === 'doppione')) out.doppioni.push(q);
    if (!p.length) out.ok.push(q);
  }
  return out;
}

/* ====================== aiuti ====================== */
/** Bottone che chiede conferma con un secondo clic (niente finestre del browser). */
function conferma(btn, testo, azione) {
  btn.addEventListener('click', () => {
    if (btn.dataset.conferma) { delete btn.dataset.conferma; btn.textContent = btn.dataset.orig; clearTimeout(btn._t); azione(); return; }
    btn.dataset.orig = btn.textContent; btn.dataset.conferma = '1'; btn.textContent = testo;
    btn._t = setTimeout(() => { delete btn.dataset.conferma; btn.textContent = btn.dataset.orig; }, 4000);
  });
}
async function copiaTesto(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* prova il metodo vecchio */ }
  const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); return ok;
}
const titoloFile = () => safeName(S.titolo || 'Batteria').slice(0, 60) || 'Batteria';
const chipDiff = d => `<span class="chip bt-diff bt-${escHtml(d)}">${escHtml(nomeDifficolta(d))}</span>`;
const msg = (e) => e ? `<p class="msg bt-msg ${e.tipo}">${escHtml(e.testo)}</p>` : '';
const bannerEsempio = () => S.esempio ? `<div class="bt-esempio"><span class="chip info"><span class="dot"></span>Esempio</span>
  <span>Questa è una batteria di esempio con 10 domande già controllate: guardala in tutte le sezioni. Appena cambi le impostazioni diventa la tua e le domande di esempio spariscono.</span>
  <button class="btn" type="button" data-bt="nuova">Comincia da zero</button></div>` : '';
const avanti = (sez, testo) => `<div class="bt-avanti"><a class="btn primary" id="bt-avanti" href="#${ID}.${sez}">${escHtml(testo)} →</a></div>`;
function collegaBanner(radice, ridisegna) {
  radice.querySelector('[data-bt="nuova"]')?.addEventListener('click', () => { ricomincia(); giro++; ridisegna(); avvisa(); });
}

/** Riquadro del copia e incolla: richiesta da copiare, risposta da incollare. */
function scatolaCopia(id, { richiesta, etichetta, bottone }) {
  return `<div class="bt-copia" id="${id}">
    <ol class="bt-passi">
      <li><span>Copia la richiesta e incollala in una nuova chat con Claude.</span>
        <div class="row"><button class="btn" type="button" data-copia>Copia la richiesta</button><a class="linkbtn" href="https://claude.ai/new" target="_blank" rel="noopener">Apri Claude ↗</a></div>
        <details class="bt-richiesta"><summary>Vedi la richiesta</summary><pre>${escHtml(richiesta)}</pre></details></li>
      <li><span>${escHtml(etichetta)}</span>
        <textarea rows="5" data-incolla placeholder="Incolla qui tutta la risposta di Claude"></textarea>
        <div class="row"><button class="btn primary" type="button" data-usa>${escHtml(bottone)}</button></div></li>
    </ol>
  </div>`;
}
function collegaCopia(box, richiesta, usa, chiaveErrore = 'copia') {
  if (!box) return;
  box.querySelector('[data-copia]').addEventListener('click', async e => {
    const ok = await copiaTesto(richiesta);
    e.target.textContent = ok ? 'Copiata ✓' : 'Copia non riuscita: seleziona il testo qui sotto';
    if (!ok) box.querySelector('details').open = true;
    setTimeout(() => { e.target.textContent = 'Copia la richiesta'; }, 2500);
  });
  box.querySelector('[data-usa]').addEventListener('click', () => {
    const ta = box.querySelector('[data-incolla]');
    if (!ta.value.trim()) { ta.focus(); return; }
    try { usa(leggiJson(ta.value)); ta.value = ''; }
    catch (e) { esiti[chiaveErrore] = { tipo: 'err', testo: e.message }; avvisa(); }
  });
}

/* ====================== lavori con Claude ====================== */
async function generaMancanti() {
  if (lavoro) return;
  const elenco = S.materie.filter(m => somma(mancanti(m)) > 0);
  const totale = elenco.reduce((a, m) => a + somma(mancanti(m)), 0);
  if (!totale) return;
  const ctl = new AbortController();
  lavoro = { tipo: 'genera', ctl, totale, fatte: 0, scritte: 0, parte: 0, materia: null, scartate: 0 };
  esiti.genera = null; avvisa();
  let esito;
  try {
    for (const m of elenco) {
      for (const parte of inParti(mancanti(m), 12)) {
        if (ctl.signal.aborted) throw { code: 'cancelled' };
        Object.assign(lavoro, { materia: m.id, scritte: 0, parte: somma(parte) }); avvisa();
        const prompt = richiestaGenera({ titolo: S.titolo, programma: S.programma, materia: m, conteggi: parte, nRisposte: S.nRisposte, giaScritte: domandeDi(m.id).map(q => q.testo) });
        const dati = await chiedi(prompt, { signal: ctl.signal, conta: n => { lavoro.scritte = Math.min(n, lavoro.parte); avvisa(); } });
        const { buone, scartate } = normalizzaDomande(dati, { materie: S.materie, materiaFissa: m.id, nRisposte: S.nRisposte });
        const prese = buone.slice(0, somma(parte));
        diventaMia();
        aggiungiDomande(prese, 'claude');
        lavoro.fatte += prese.length; lavoro.scartate += scartate.length;
        cambiato();
      }
    }
    esito = { tipo: 'ok', testo: `Generate ${lavoro.fatte} domande.` + (lavoro.scartate ? ` ${lavoro.scartate} scartate perché incomplete: se ne mancano, genera di nuovo.` : '') + ' Ora passa al secondo controllo.' };
    emetti(`${ID}:domande-generate`);
  } catch (e) {
    const s = spiegaErrore(e);
    if (s.passaACopia) { modo = 'copia'; copiaAperta.genera = true; }
    esito = { tipo: s.annullato ? 'info' : 'err', testo: (lavoro.fatte ? `Generate ${lavoro.fatte} domande. ` : '') + (s.annullato ? 'Generazione fermata: riprendi quando vuoi.' : s.messaggio) };
  } finally { lavoro = null; esiti.genera = esito; avvisa(); }
}

function gruppiControllo(qs) {
  const gruppi = [];
  for (const m of [...S.materie, { id: null }]) {
    const del = qs.filter(q => m.id ? q.materia === m.id : !materia(q.materia));
    for (let i = 0; i < del.length; i += MAX_CONTROLLO) gruppi.push(del.slice(i, i + MAX_CONTROLLO));
  }
  return gruppi;
}
async function controlla(tutte) {
  if (lavoro) return;
  const qs = domandeOrdinate().filter(q => tutte || q.controllo?.stato !== 'fatto');
  if (!qs.length) return;
  const ctl = new AbortController();
  lavoro = { tipo: 'controllo', ctl, totale: qs.length, fatte: 0, scritte: 0, parte: 0 };
  esiti.controllo = null; avvisa();
  let esito, senza = 0;
  try {
    for (const g of gruppiControllo(qs)) {
      if (ctl.signal.aborted) throw { code: 'cancelled' };
      Object.assign(lavoro, { parte: g.length, scritte: 0, materia: g[0].materia }); avvisa();
      const dati = await chiedi(richiestaControllo({ titolo: S.titolo, programma: S.programma, materie: S.materie, domande: g }),
        { livello: 'complex', signal: ctl.signal, nuova: false, conta: n => { lavoro.scritte = Math.min(n, g.length); avvisa(); } });
      applicaControllo(normalizzaControllo(dati, g), g, n => { senza += n; });
      lavoro.fatte += g.length;
      cambiato();
    }
    const c = classifica();
    esito = { tipo: 'ok', testo: `Controllate ${qs.length - senza} domande: ${c.rivedere.length ? `${c.rivedere.length} da rivedere.` : 'nessuna da rivedere.'}` + (senza ? ` ${senza} senza esito: avvia di nuovo il controllo.` : '') };
    emetti(`${ID}:controllo-fatto`);
  } catch (e) {
    const s = spiegaErrore(e);
    if (s.passaACopia) { modo = 'copia'; copiaAperta.controllo = true; }
    esito = { tipo: s.annullato ? 'info' : 'err', testo: s.annullato ? 'Controllo fermato: le domande già controllate restano.' : s.messaggio };
  } finally { lavoro = null; esiti.controllo = esito; avvisa(); }
}
function applicaControllo(es, gruppo, mancate) {
  let n = 0;
  for (const q of gruppo) { if (es[q.id]) { q.controllo = es[q.id]; q.accettata = false; } else n++; }
  mancate?.(n);
}

async function rigenera(q) {
  if (lavoro) return;
  const m = materia(q.materia); if (!m) return;
  const ctl = new AbortController();
  lavoro = { tipo: 'rigenera', id: q.id, ctl };
  avvisa();
  try {
    const perche = problemi(q, doppi()).filter(p => p.tipo !== 'da-controllare').map(p => p.testo).join('; ');
    const prompt = richiestaGenera({
      titolo: S.titolo, programma: S.programma, materia: m, nRisposte: S.nRisposte,
      conteggi: { facile: 0, media: 0, difficile: 0, [q.difficolta]: 1 },
      giaScritte: domandeDi(m.id).map(x => x.testo),
      motivo: `il quesito serve a sostituirne uno scartato al secondo controllo${perche ? ` (${perche})` : ''}: deve essere diverso da tutti quelli elencati.`,
    });
    const { buone } = normalizzaDomande(await chiedi(prompt, { signal: ctl.signal }), { materie: S.materie, materiaFissa: m.id, nRisposte: S.nRisposte });
    if (!buone.length) throw { code: 'invalid_json' };
    sostituisci(q.id, buone[0], 'claude');
    esiti.controllo = { tipo: 'ok', testo: 'Domanda sostituita: va ricontrollata.' };
    cambiato();
  } catch (e) {
    const s = spiegaErrore(e);
    if (s.passaACopia) modo = 'copia';
    esiti.controllo = { tipo: s.annullato ? 'info' : 'err', testo: s.messaggio };
  } finally { lavoro = null; avvisa(); }
}

/* ====================== montaggio ====================== */
export function monta(el, ctx) {
  const sezioni = { imposta: montaImposta, genera: montaGenera, controllo: montaControllo, esporta: montaEsporta };
  el.innerHTML = '<div class="bt"></div>';
  return (sezioni[ctx.sezione] || montaImposta)(el.firstElementChild, ctx);
}

/* ====================== 1 · Imposta la prova ====================== */
function montaImposta(radice, ctx) {
  /** Alla prima modifica l'esempio diventa una batteria vera; non si ridisegna, così il cursore resta dov'è. */
  const mio = () => { if (diventaMia()) { ctx.avviso('Ora la batteria è tua: le domande di esempio sono state tolte.'); radice.querySelector('.bt-esempio')?.remove(); } };
  function disegna() {
    radice.innerHTML = `${bannerEsempio()}
      <div class="bt-griglia">
        <div class="card" id="bt-prova">
          <h3><span class="n">1</span>La prova</h3>
          <div class="field"><label for="bt-titolo">Titolo della prova</label><input id="bt-titolo" placeholder="es. Concorso per 3 istruttori amministrativi – Comune di …"></div>
          <div class="bt-due">
            <div class="field"><label for="bt-nrisp">Risposte per domanda</label><select id="bt-nrisp"><option value="3">3 (A, B, C)</option><option value="4">4 (A, B, C, D)</option><option value="5">5 (A … E)</option></select></div>
            <div class="bt-totale" id="bt-totale"></div>
          </div>
        </div>
        <div class="card" id="bt-programma">
          <h3><span class="n">2</span>Programma del bando <span class="chip ghost">consigliato</span></h3>
          <textarea id="bt-prog" rows="7" placeholder="Incolla qui la parte del bando con le materie d'esame"></textarea>
          <div class="row"><button class="btn" type="button" id="bt-ricava">${ICONA_STELLA}Ricava le materie</button><span class="hint" id="bt-ricava-esito"></span></div>
        </div>
      </div>
      <div class="card" id="bt-materie">
        <h3><span class="n">3</span>Materie</h3>
        <div class="bt-materie" id="bt-materie-righe"></div>
        <div class="row bt-materie-piede"><button class="btn" type="button" id="bt-aggiungi">+ Aggiungi materia</button><span class="hint" id="bt-materie-tot"></span>
          ${S.esempio ? '' : '<button class="btn bt-destra" type="button" id="bt-azzera">Ricomincia da zero</button>'}</div>
      </div>
      ${avanti('genera', 'Avanti: genera le domande')}`;
    const $ = s => radice.querySelector(s);
    $('#bt-titolo').value = S.titolo; $('#bt-nrisp').value = String(S.nRisposte); $('#bt-prog').value = S.programma;
    collegaBanner(radice, disegna);
    $('#bt-titolo').addEventListener('input', e => { mio(); S.titolo = e.target.value; cambiato(); });
    $('#bt-nrisp').addEventListener('change', e => { mio(); S.nRisposte = +e.target.value; cambiato(); totali(); });
    $('#bt-prog').addEventListener('input', e => { mio(); S.programma = e.target.value; cambiato(); });
    $('#bt-aggiungi').addEventListener('click', () => { mio(); nuovaMateria(); cambiato(); righe(); radice.querySelector('.bt-materia:last-child input')?.focus(); });
    $('#bt-azzera') && conferma($('#bt-azzera'), 'Sicuro? Clicca di nuovo', () => { ricomincia(); giro++; disegna(); avvisa(); });
    $('#bt-ricava').addEventListener('click', ricava);
    righe();
  }

  function righe() {
    const box = radice.querySelector('#bt-materie-righe');
    box.innerHTML = `<div class="bt-materia bt-testa" aria-hidden="true"><span>Materia</span><span>Domande</span><span>Difficoltà</span><span>Argomenti da privilegiare</span><span></span></div>` +
      S.materie.map(m => `<div class="bt-materia" data-id="${m.id}">
        <div class="field"><label class="bt-solo-mobile" for="bt-n-${m.id}">Materia</label><input id="bt-n-${m.id}" data-k="nome" value="${escHtml(m.nome)}" placeholder="es. Diritto amministrativo" aria-label="Nome della materia"></div>
        <div class="field"><label class="bt-solo-mobile" for="bt-q-${m.id}">Domande</label><input id="bt-q-${m.id}" data-k="quante" type="number" min="0" max="300" inputmode="numeric" value="${m.quante}" aria-label="Numero di domande"></div>
        <div class="field"><label class="bt-solo-mobile" for="bt-d-${m.id}">Difficoltà</label><select id="bt-d-${m.id}" data-k="difficolta" aria-label="Difficoltà">${DIFFICOLTA.map(d => `<option value="${d.id}"${d.id === m.difficolta ? ' selected' : ''}>${escHtml(d.breve || d.nome)}</option>`).join('')}</select></div>
        <div class="field"><label class="bt-solo-mobile" for="bt-a-${m.id}">Argomenti da privilegiare</label><input id="bt-a-${m.id}" data-k="note" value="${escHtml(m.note)}" placeholder="facoltativo, es. L. 241/1990" aria-label="Argomenti da privilegiare"></div>
        <button class="bt-togli" type="button" data-togli title="Togli la materia" aria-label="Togli la materia ${escHtml(m.nome)}">×</button>
      </div>`).join('');
    box.querySelectorAll('.bt-materia[data-id]').forEach(r => {
      const m = materia(r.dataset.id);
      r.querySelectorAll('[data-k]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        mio(); const k = inp.dataset.k;
        m[k] = k === 'quante' ? Math.max(0, Math.min(300, Math.round(+inp.value || 0))) : inp.value;
        cambiato(); totali();
      }));
      r.querySelector('[data-togli]').addEventListener('click', () => {
        const n = domandeDi(m.id).length;
        mio(); togliMateria(m.id); cambiato(); righe(); totali();
        if (n) ctx.avviso(`Tolta la materia con le sue ${n} domande.`);
      });
    });
    totali();
  }

  function totali() {
    const tot = S.materie.reduce((a, m) => a + (m.nome.trim() ? m.quante : 0), 0);
    const per = { facile: 0, media: 0, difficile: 0 };
    for (const m of S.materie) if (m.nome.trim()) { const r = ripartisci(m.quante, m.difficolta); for (const l of LIVELLI) per[l] += r[l]; }
    const t = radice.querySelector('#bt-materie-tot');
    const pl = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;
    if (t) t.textContent = tot ? `Totale ${pl(tot, 'domanda', 'domande')}: ${pl(per.facile, 'facile', 'facili')}, ${pl(per.media, 'media', 'medie')}, ${pl(per.difficile, 'difficile', 'difficili')}.` : 'Aggiungi almeno una materia con il nome e il numero di domande.';
    const b = radice.querySelector('#bt-totale');
    if (b) b.innerHTML = `<span class="bt-grande">${tot}</span><span>domande in ${S.materie.filter(m => m.nome.trim()).length} materie</span>`;
  }

  async function ricava() {
    const out = radice.querySelector('#bt-ricava-esito'), btn = radice.querySelector('#bt-ricava');
    if (!S.programma.trim()) { out.textContent = 'Prima incolla il programma del bando.'; radice.querySelector('#bt-prog').focus(); return; }
    let lista = null;
    if (modo === 'claude') {
      btn.disabled = true; out.textContent = 'Claude sta leggendo il programma…';
      try { const r = await chiedi(richiestaMaterie(S.programma), { livello: 'quick', nuova: false }); lista = (Array.isArray(r) ? r : []).map(x => ({ nome: clean(x?.nome), note: clean(x?.argomenti) })).filter(x => x.nome); }
      catch (e) { const s = spiegaErrore(e); if (s.passaACopia) modo = 'copia'; out.textContent = s.messaggio + ' Provo a leggerlo da solo.'; }
      btn.disabled = false;
    }
    if (!lista) lista = materieDalTesto(S.programma);
    if (!lista.length) { out.textContent = 'Non riesco a riconoscere le materie: aggiungile a mano.'; return; }
    mio();
    S.materie = S.materie.filter(m => m.nome.trim() || domandeDi(m.id).length);
    let nuove = 0;
    for (const x of lista) if (!S.materie.some(m => norm(m.nome) === norm(x.nome))) { nuovaMateria({ nome: x.nome.slice(0, 80), note: x.note.slice(0, 200) }); nuove++; }
    if (!S.materie.length) nuovaMateria();
    cambiato(); righe();
    out.textContent = nuove ? `Aggiunte ${nuove} materie: controlla nomi, numero di domande e difficoltà.` : 'Le materie del programma ci sono già tutte.';
  }

  disegna();
  return registra(() => {});   // la sezione si ridisegna solo da sé, per non perdere il cursore mentre si scrive
}

/** Materie da un programma, senza Claude: una per riga o per voce di elenco. */
export function materieDalTesto(t) {
  let righe = String(t).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (righe.length <= 2) righe = righe.join(' ').split(/;\s*/);
  const out = [];
  for (let r of righe) {
    r = r.replace(/^([-–•*·▪]|\d{1,2}[).]|[a-z][).])\s*/i, '').trim();
    if (r.length < 4 || /:$/.test(r) || /^(materie|programma|prova|la prova|le prove)\b/i.test(r) && /:/.test(r) && r.indexOf(':') > r.length - 3) continue;
    if (/^(materie|programma)[^:]*:\s*$/i.test(r)) continue;
    const m = /^(.{3,80}?)(?:\s*[,:(;]|\s+con\s+|\s+—\s+|\s+-\s+|$)/i.exec(r);
    let nome = (m ? m[1] : r).replace(/[.;,]+$/, '').trim();
    if (!nome || nome.length < 3) continue;
    nome = nome.charAt(0).toUpperCase() + nome.slice(1);
    let note = r.slice((m ? m[1].length : r.length)).replace(/^[\s,:;–—-]+|[\s.;,]+$/g, '').replace(/^con\s+/i, '');
    if (/^\(.*\)$/.test(note)) note = note.slice(1, -1);
    out.push({ nome, note });
    if (out.length >= 15) break;
  }
  return out;
}

/* ====================== 2 · Genera le domande ====================== */
function montaGenera(radice, ctx) {
  radice.innerHTML = `<div id="bt-ban"></div>
    <div class="card bt-modo" id="bt-modo"></div>
    <div class="card" id="bt-genera">
      <h3>Domande per materia</h3>
      <div class="bt-avanz" id="bt-avanzamento"></div>
      <div class="bt-azioni-gen" id="bt-genera-azioni"></div>
      <div id="bt-genera-msg"></div>
      <div id="bt-copia-genera"></div>
    </div>
    <div class="bt-griglia">
      <div class="card" id="bt-importa">
        <h3>Hai già delle domande? <span class="chip ghost">facoltativo</span></h3>
        <label class="drop bt-drop-piccolo"><input type="file" id="bt-excel" accept=".xlsx,.xlsm,.csv">${ICONA_CARICA}<strong>Carica un Excel di domande</strong><span>per esempio una batteria salvata con questa pagina</span></label>
        <div id="bt-importa-esito"></div>
      </div>
      <div class="card" id="bt-elenco-gen"><h3>Domande nella batteria</h3><div id="bt-elenco"></div></div>
    </div>
    ${avanti('controllo', 'Avanti: secondo controllo')}`;
  const $ = s => radice.querySelector(s);
  let firmaCopia = '';

  $('#bt-excel').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { esiti.importa = await importaExcel(f); }
    catch (err) { esiti.importa = { tipo: 'err', testo: err.message || String(err) }; }
    cambiato();
  });

  function disegna() {
    $('#bt-ban').innerHTML = bannerEsempio(); collegaBanner(radice, disegna);
    // modo di collegamento
    $('#bt-modo').innerHTML = modo === null
      ? '<p class="bt-modo-riga"><span class="ass-pulsa" aria-hidden="true"></span>Verifico se la pagina può chiedere direttamente a Claude…</p>'
      : modo === 'claude'
        ? `<p class="bt-modo-riga"><span class="chip ok"><span class="dot"></span>Collegata a Claude</span><span>Le domande si generano qui, con il tuo account Claude. Alla prima richiesta Claude chiede il permesso.</span></p>`
        : `<p class="bt-modo-riga"><span class="chip warn"><span class="dot"></span>Copia e incolla</span><span>Questa pagina non è aperta dentro Claude: copia la richiesta qui sotto, incollala in una chat con Claude e incolla qui la risposta.</span></p>`;
    // avanzamento per materia
    const valide = S.materie.filter(m => m.nome.trim());
    $('#bt-avanzamento').innerHTML = valide.length ? valide.map(m => {
      const { tot, per } = conteggio(m), manca = somma(mancanti(m));
      const qui = lavoro?.tipo === 'genera' && lavoro.materia === m.id;
      const pct = m.quante ? Math.min(100, Math.round(tot / m.quante * 100)) : 0;
      const target = ripartisci(m.quante, m.difficolta);
      return `<div class="bt-mat${qui ? ' attiva' : ''}">
        <div class="bt-mat-testa"><b>${escHtml(m.nome)}</b><span class="bt-mat-num">${tot} / ${m.quante}</span></div>
        <div class="bt-barra-p"><span style="width:${pct}%"></span>${qui ? `<span class="bt-barra-in" style="left:${pct}%;width:${Math.min(100 - pct, Math.round((lavoro.scritte || 0) / m.quante * 100))}%"></span>` : ''}</div>
        <div class="bt-mat-piede">${LIVELLI.filter(l => target[l] || per[l]).map(l => `<span>${nomeDifficolta(l)} ${per[l] || 0}/${target[l]}</span>`).join('')}
          <span class="bt-mat-stato">${qui ? `<span class="ass-pulsa" aria-hidden="true"></span>Claude sta scrivendo… ${lavoro.scritte || 0} di ${lavoro.parte}` : manca ? `mancano ${manca}` : tot > m.quante ? `${tot - m.quante} in più` : '✓ complete'}</span></div>
      </div>`;
    }).join('') : '<p class="hint">Nessuna materia: aggiungile nel passo 1.</p>';
    // azioni
    const manca = totaleMancanti();
    const az = $('#bt-genera-azioni');
    if (lavoro?.tipo === 'genera') {
      az.innerHTML = `<button class="btn" type="button" id="bt-ferma">Ferma</button><span class="hint">Generate ${lavoro.fatte} di ${lavoro.totale}. Puoi cambiare sezione: la generazione continua.</span>`;
      $('#bt-ferma').addEventListener('click', () => lavoro?.ctl.abort());
    } else if (modo === 'claude') {
      az.innerHTML = `<button class="btn primary" type="button" id="bt-genera-via"${manca && !lavoro ? '' : ' disabled'}>${ICONA_STELLA}${manca ? `Genera le ${manca} domande mancanti` : 'Tutte le domande ci sono'}</button>
        ${S.domande.length && !S.esempio ? '<button class="btn" type="button" id="bt-rigenera-tutte">Rigenera tutte</button>' : ''}
        <button class="linkbtn" type="button" id="bt-apri-copia">${copiaAperta.genera ? 'Nascondi il copia e incolla' : 'Preferisci il copia e incolla?'}</button>`;
      $('#bt-genera-via').addEventListener('click', generaMancanti);
      $('#bt-rigenera-tutte') && conferma($('#bt-rigenera-tutte'), 'Toglie tutte le domande: clicca di nuovo', () => { S.domande = []; cambiato(); generaMancanti(); });
      $('#bt-apri-copia').addEventListener('click', () => { copiaAperta.genera = !copiaAperta.genera; avvisa(); });
    } else az.innerHTML = '';
    $('#bt-genera-msg').innerHTML = msg(esiti.genera) + msg(esiti.copia);
    // copia e incolla
    const vediCopia = modo === 'copia' || copiaAperta.genera;
    const daChiedere = S.materie.filter(m => m.nome.trim()).map(m => ({ ...m, conteggi: mancanti(m) })).filter(m => somma(m.conteggi) > 0);
    const richiesta = daChiedere.length ? richiestaGeneraTutto({ titolo: S.titolo, programma: S.programma, materie: daChiedere, nRisposte: S.nRisposte, giaScritte: domandeOrdinate().map(q => q.testo) }) : '';
    const firma = vediCopia + '|' + richiesta;
    if (firma !== firmaCopia) {
      firmaCopia = firma;
      const box = $('#bt-copia-genera');
      if (!vediCopia || lavoro?.tipo === 'genera') box.innerHTML = '';
      else if (!richiesta) box.innerHTML = '<p class="hint">Tutte le materie hanno le loro domande. Se ne togli qualcuna nel controllo, qui comparirà la richiesta per quelle mancanti.</p>';
      else {
        box.innerHTML = scatolaCopia('bt-scatola-gen', { richiesta, etichetta: 'Copia tutta la risposta di Claude e incollala qui.', bottone: 'Aggiungi le domande' });
        collegaCopia(box.firstElementChild, richiesta, dati => {
          const { buone, scartate } = normalizzaDomande(dati, { materie: S.materie, nRisposte: S.nRisposte });
          if (!buone.length) { esiti.copia = { tipo: 'err', testo: 'Nella risposta non ci sono domande valide.' + (scartate.length ? ` Scartate ${scartate.length}: ${scartate[0].motivo}.` : '') }; avvisa(); return; }
          diventaMia(); aggiungiDomande(buone, 'incollata');
          esiti.copia = { tipo: 'ok', testo: `Aggiunte ${buone.length} domande.` + (scartate.length ? ` ${scartate.length} scartate (${[...new Set(scartate.map(s => s.motivo))].join(', ')}).` : '') + ' Ora passa al secondo controllo.' };
          firmaCopia = ''; cambiato(); emetti(`${ID}:domande-generate`);
        });
      }
    }
    $('#bt-importa-esito').innerHTML = msg(esiti.importa);
    // elenco compatto
    const lista = $('#bt-elenco');
    const aperte = new Set([...lista.querySelectorAll('details[open]')].map(d => d.dataset.m));
    lista.innerHTML = S.domande.length ? S.materie.filter(m => domandeDi(m.id).length).map(m => `<details class="bt-gruppo" data-m="${m.id}"${aperte.has(m.id) ? ' open' : ''}><summary><b>${escHtml(m.nome || 'Senza nome')}</b> <span class="hint">${domandeDi(m.id).length} domande</span></summary>
      <ol class="bt-compatte">${domandeDi(m.id).map(q => `<li><span>${escHtml(q.testo)}</span> <span class="bt-giusta">✓ ${escHtml(q.risposte[q.esatta] || '')}</span><button class="bt-togli" type="button" data-togli="${q.id}" title="Togli la domanda" aria-label="Togli la domanda">×</button></li>`).join('')}</ol></details>`).join('')
      : '<p class="hint">Ancora nessuna domanda.</p>';
    lista.querySelectorAll('[data-togli]').forEach(b => b.addEventListener('click', () => { togliDomanda(b.dataset.togli); cambiato(); }));
  }
  disegna();
  return registra(disegna);
}

/* ---------- importazione da Excel ---------- */
const CAMPI_EXCEL = [
  { k: 'domanda', syn: ['domanda', 'quesito', 'testo domanda', 'testo del quesito', 'testo della domanda', 'testo'] },
  { k: 'esatta', syn: ['esatta', 'risposta esatta', 'corretta', 'risposta corretta', 'soluzione', 'chiave', 'giusta'] },
  { k: 'materia', syn: ['materia', 'disciplina', 'area', 'ambito'] },
  { k: 'difficolta', syn: ['difficolta', 'livello', 'grado di difficolta'] },
  { k: 'argomento', syn: ['argomento', 'tema'] },
  { k: 'riferimento', syn: ['riferimento', 'riferimento normativo', 'fonte', 'norma'] },
  { k: 'attinenza', syn: ['attinenza'] }, { k: 'motivoAttinenza', syn: ['motivo attinenza'] },
  { k: 'verifica', syn: ['risposta esatta verificata', 'verifica risposta'] }, { k: 'motivoRisposta', syn: ['motivo risposta'] },
  { k: 'confermata', syn: ['confermata'] }, { k: 'numero', syn: ['n', 'numero', 'n domanda'] }, { k: 'doppione', syn: ['doppione della n', 'doppione di'] },
];
const LIVELLO_EXCEL = { facile: 'facile', semplice: 'facile', bassa: 'facile', media: 'media', medio: 'media', difficile: 'difficile', alta: 'difficile', elevata: 'difficile' };
const esitoExcel = v => { const s = norm(v); return s.startsWith('s') ? 'si' : s.startsWith('n') ? 'no' : s ? 'dubbio' : ''; };

async function importaExcel(file) {
  const { fogli } = await leggiFoglio(file);
  const trova = nome => fogli.find(f => norm(f.nome) === nome);
  const foglio = trova('domande') || fogli.find(f => { const i = trovaIntestazione(f.righe, CAMPI_EXCEL); return (f.righe[i] || []).some(h => CAMPI_EXCEL[0].syn.includes(norm(h))); }) || fogli[0];
  const hi = trovaIntestazione(foglio.righe, CAMPI_EXCEL);
  const head = intestazioni(foglio.righe, hi).map(norm);
  const col = {};
  for (const c of CAMPI_EXCEL) { const i = head.findIndex(h => c.syn.includes(h)); if (i >= 0) col[c.k] = i; }
  const colRisposte = [];
  head.forEach((h, i) => { const m = /^(?:risposta |opzione |alternativa )?([a-h]|[1-8])$/.exec(h); if (m) colRisposte.push({ i, k: /\d/.test(m[1]) ? +m[1] - 1 : LETTERE.indexOf(m[1].toUpperCase()) }); });
  colRisposte.sort((a, b) => a.k - b.k);
  if (col.domanda == null) throw new Error('Nel file non trovo la colonna delle domande (per esempio «Domanda»).');
  if (colRisposte.length < 2) throw new Error('Nel file non trovo le colonne delle risposte (per esempio «A», «B», «C» oppure «Risposta A»…).');
  if (col.esatta == null) throw new Error('Nel file non trovo la colonna della risposta esatta (per esempio «Esatta»).');
  if (S.esempio) ricomincia();      // sull'esempio: si riparte dal file, senza le materie di esempio
  // impostazioni e materie salvate da questa pagina
  const imp = trova('impostazioni');
  if (imp) for (const r of imp.righe) {
    const k = norm(r[0]), v = clean(r[1]);
    if (k === 'titolo' && v && !S.titolo) S.titolo = v;
    if (k === 'programma del bando' && v && !S.programma.trim()) S.programma = String(r[1]);
    if (k === 'risposte per domanda' && +v >= 2 && +v <= 5) S.nRisposte = +v;
  }
  const mat = trova('materie'), infoMat = new Map();
  if (mat) { const h = (mat.righe[0] || []).map(norm); for (const r of mat.righe.slice(1)) if (clean(r[0])) infoMat.set(norm(r[0]), { quante: +r[h.indexOf('domande previste')] || 0, difficolta: (DIFFICOLTA.find(d => norm(d.breve || d.nome) === norm(r[h.indexOf('difficolta richiesta')])) || {}).id, note: clean(r[h.indexOf('argomenti')]) }); }
  const perMateria = nome => {
    const n = clean(nome) || 'Senza materia';
    let m = S.materie.find(x => norm(x.nome) === norm(n));
    if (!m) { const vuota = S.materie.find(x => !x.nome.trim() && !domandeDi(x.id).length); if (vuota) { vuota.nome = n; m = vuota; } else m = nuovaMateria({ nome: n, quante: 0 }); const inf = infoMat.get(norm(n)); if (inf) Object.assign(m, { quante: inf.quante || m.quante, difficolta: inf.difficolta || m.difficolta, note: inf.note || m.note }); else m.quante = 0; }
    return m;
  };
  const nuove = [], controlli = [], numeri = [], doppioni = [];
  let scartate = 0;
  for (const r of foglio.righe.slice(hi + 1)) {
    const testo = clean(r[col.domanda]); if (!testo) continue;
    const risposte = colRisposte.map(c => clean(r[c.i])).filter(Boolean);
    const e = r[col.esatta];
    let esatta = -1;
    const es = clean(e).toUpperCase();
    if (/^[A-H]$/.test(es)) esatta = LETTERE.indexOf(es);
    else if (/^\d$/.test(es)) esatta = +es - 1;
    else esatta = risposte.findIndex(x => norm(x) === norm(e));
    if (risposte.length < 2 || esatta < 0 || esatta >= risposte.length) { scartate++; continue; }
    const m = perMateria(col.materia != null ? r[col.materia] : '');
    nuove.push({ materia: m.id, testo, risposte, esatta, difficolta: LIVELLO_EXCEL[norm(r[col.difficolta])] || 'media', argomento: clean(r[col.argomento]), riferimento: clean(r[col.riferimento]) });
    numeri.push(col.numero != null ? +r[col.numero] || null : null);
    doppioni.push(col.doppione != null ? +r[col.doppione] || null : null);
    controlli.push(col.attinenza != null && esitoExcel(r[col.attinenza]) ? { stato: 'fatto', attinenza: esitoExcel(r[col.attinenza]), motivoAttinenza: clean(r[col.motivoAttinenza]), risposta: esitoExcel(r[col.verifica]) || 'dubbio', motivoRisposta: clean(r[col.motivoRisposta]), rispostaGiusta: null, doppioneDi: null, confermata: norm(r[col.confermata]).startsWith('s') } : null);
  }
  if (!nuove.length) throw new Error('Nel file non ci sono domande complete (testo, almeno due risposte e la risposta esatta).');
  const aggiunte = aggiungiDomande(nuove, 'excel');
  const perNumero = new Map(numeri.map((n, i) => [n, aggiunte[i].id]).filter(([n]) => n));
  aggiunte.forEach((q, i) => {
    const c = controlli[i]; if (!c) return;
    q.accettata = c.confermata; delete c.confermata;
    c.doppioneDi = perNumero.get(doppioni[i]) || null;
    q.controllo = c;
  });
  for (const m of S.materie) if (!m.quante) m.quante = domandeDi(m.id).length;
  return { tipo: 'ok', testo: `Caricate ${aggiunte.length} domande da «${file.name}».` + (scartate ? ` ${scartate} righe scartate perché incomplete.` : '') };
}

/* ====================== 3 · Secondo controllo ====================== */
const FILTRI = [
  ['rivedere', 'Da rivedere'], ['fuori', 'Fuori tema'], ['risposta', 'Risposta'], ['doppioni', 'Doppioni'],
  ['dafare', 'Da controllare'], ['confermate', 'Confermate'], ['tutte', 'Tutte'],
];
let filtro = null;
const modifica = new Set();

function montaControllo(radice, ctx) {
  radice.innerHTML = `<div id="bt-ban"></div>
    <section class="barra" id="bt-stato-controllo">
      <div class="stats" id="bt-stats"></div>
      <div class="row" id="bt-controllo-azioni"></div>
    </section>
    <div id="bt-controllo-msg"></div>
    <div id="bt-copia-controllo"></div>
    <div class="bt-filtri" id="bt-filtri" role="toolbar" aria-label="Filtra le domande"></div>
    <div class="bt-lista" id="bt-lista"></div>
    ${avanti('esporta', 'Avanti: versioni e stampa')}`;
  const $ = s => radice.querySelector(s);
  let firmaCopia = '', firmaLista = '';

  function disegna() {
    $('#bt-ban').innerHTML = bannerEsempio(); collegaBanner(radice, disegna);
    const c = classifica();
    if (!filtro) filtro = c.rivedere.length ? 'rivedere' : c.dafare.length ? 'dafare' : 'tutte';
    const stat = (k, v, cl = '') => `<div class="stat"><span class="k">${k}</span><span class="v ${cl}">${v}</span></div>`;
    $('#bt-stats').innerHTML = stat('Domande', c.tutte.length) + stat('Controllate', c.tutte.length - c.dafare.length) + stat('Da rivedere', c.rivedere.length, c.rivedere.length ? 'err' : '') + stat('Da controllare', c.dafare.length);
    // azioni
    const az = $('#bt-controllo-azioni');
    if (lavoro?.tipo === 'controllo') {
      az.innerHTML = `<span class="bt-lavoro"><span class="ass-pulsa" aria-hidden="true"></span>Claude sta controllando ${escHtml(nomeMateria(lavoro.materia))}… ${lavoro.fatte + (lavoro.scritte || 0)} di ${lavoro.totale}</span><button class="btn" type="button" id="bt-ferma">Ferma</button>`;
      $('#bt-ferma').addEventListener('click', () => lavoro?.ctl.abort());
    } else if (modo === 'claude') {
      az.innerHTML = `<button class="btn primary" type="button" id="bt-controlla"${c.dafare.length && !lavoro ? '' : ' disabled'}>${ICONA_STELLA}${c.dafare.length ? `Controlla ${c.dafare.length === c.tutte.length ? 'le' : 'le nuove'} ${c.dafare.length} domande` : 'Tutte controllate'}</button>
        ${c.tutte.length && c.dafare.length < c.tutte.length ? '<button class="btn" type="button" id="bt-ricontrolla">Ricontrolla tutto</button>' : ''}
        <button class="linkbtn" type="button" id="bt-apri-copia">${copiaAperta.controllo ? 'Nascondi il copia e incolla' : 'Copia e incolla'}</button>`;
      $('#bt-controlla').addEventListener('click', () => controlla(false));
      $('#bt-ricontrolla') && conferma($('#bt-ricontrolla'), 'Rifà il controllo di tutte: clicca di nuovo', () => controlla(true));
      $('#bt-apri-copia').addEventListener('click', () => { copiaAperta.controllo = !copiaAperta.controllo; avvisa(); });
    } else if (modo === null) az.innerHTML = '<span class="hint">Verifico il collegamento con Claude…</span>';
    else if (c.dafare.length) az.innerHTML = '<span class="hint">Copia la richiesta qui sotto in una chat con Claude.</span>';
    else {
      az.innerHTML = `<button class="btn" type="button" id="bt-apri-copia">${copiaAperta.controllo ? 'Nascondi il ricontrollo' : 'Ricontrolla tutto'}</button>`;
      $('#bt-apri-copia').addEventListener('click', () => { copiaAperta.controllo = !copiaAperta.controllo; avvisa(); });
    }
    $('#bt-controllo-msg').innerHTML = msg(esiti.controllo) + msg(esiti.copiaControllo) + (lavoro?.tipo === 'controllo' ? '<p class="hint bt-msg">Il controllo è accurato e può richiedere qualche minuto per materia. Puoi cambiare sezione: continua.</p>' : '');
    // copia e incolla
    const vedi = ((modo === 'copia' && c.dafare.length) || copiaAperta.controllo) && lavoro?.tipo !== 'controllo';
    const daFare = c.dafare.length ? c.dafare : c.tutte;
    const richiesta = vedi && daFare.length ? richiestaControllo({ titolo: S.titolo, programma: S.programma, materie: S.materie, domande: daFare }) : '';
    const firma = vedi + '|' + richiesta;
    if (firma !== firmaCopia) {
      firmaCopia = firma;
      const box = $('#bt-copia-controllo');
      if (!richiesta) box.innerHTML = '';
      else {
        box.innerHTML = `<div class="card"><h3>${c.dafare.length ? `Controllo di ${c.dafare.length} domande` : 'Ricontrollo di tutte le domande'}</h3>${scatolaCopia('bt-scatola-con', { richiesta, etichetta: 'Copia tutta la risposta di Claude e incollala qui.', bottone: 'Applica il controllo' })}</div>`;
        collegaCopia(box.querySelector('.bt-copia'), richiesta, dati => {
          const es = normalizzaControllo(dati, daFare);
          const n = Object.keys(es).length;
          if (!n) { esiti.copiaControllo = { tipo: 'err', testo: 'Nella risposta non trovo gli esiti del controllo: incolla la risposta della richiesta più recente.' }; avvisa(); return; }
          applicaControllo(es, daFare);
          esiti.copiaControllo = { tipo: 'ok', testo: `Esiti applicati a ${n} domande.` + (n < daFare.length ? ` ${daFare.length - n} senza esito.` : '') };
          firmaCopia = ''; cambiato(); emetti(`${ID}:controllo-fatto`);
        }, 'copiaControllo');
      }
    }
    // filtri
    $('#bt-filtri').innerHTML = FILTRI.map(([k, nome]) => `<button type="button" class="bt-filtro${filtro === k ? ' on' : ''}" data-f="${k}" aria-pressed="${filtro === k}">${nome} <span>${c[k].length}</span></button>`).join('');
    $('#bt-filtri').querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filtro = b.dataset.f; firmaLista = ''; disegna(); }));
    // elenco
    const lista = c[filtro] || [];
    const firmaL = [filtro, giro, modo, lavoro ? lavoro.tipo + (lavoro.id || '') : '', [...modifica].join(',')].join('|');
    if (firmaL === firmaLista) return;
    const primaVolta = !firmaLista; firmaLista = firmaL;
    const d = doppi(), tutte = domandeOrdinate();
    $('#bt-lista').innerHTML = lista.length ? lista.map(q => schedaDomanda(q, d, tutte.indexOf(q) + 1)).join('')
      : `<p class="vuoto">${filtro === 'rivedere' ? (c.dafare.length ? 'Nessuna segnalazione finora: ci sono ancora domande da controllare.' : 'Nessuna domanda da rivedere. ✓') : 'Nessuna domanda in questo elenco.'}</p>`;
    collegaSchede($('#bt-lista'));
    if (primaVolta) comparsa($('#bt-lista').children, { passo: 30, max: 10 });
  }

  function collegaSchede(box) {
    box.querySelectorAll('.bt-q').forEach(art => {
      const q = domanda(art.dataset.id); if (!q) return;
      art.querySelectorAll('[data-a]').forEach(b => {
        const a = b.dataset.a;
        if (a === 'togli') conferma(b, 'Sicuro?', () => { togliDomanda(q.id); modifica.delete(q.id); cambiato(); });
        else b.addEventListener('click', () => {
          if (a === 'usa') { q.esatta = +b.dataset.i; q.controllo = { ...q.controllo, risposta: 'si', motivoRisposta: '', rispostaGiusta: null }; q.accettata = false; cambiato(); }
          else if (a === 'ok') { q.accettata = !q.accettata; cambiato(); }
          else if (a === 'rigenera') rigenera(q);
          else if (a === 'modifica') { modifica.add(q.id); avvisa(); }
          else if (a === 'annulla') { modifica.delete(q.id); avvisa(); }
          else if (a === 'salva') salvaModifica(art, q);
          else if (a === 'vai') vaiA(b.dataset.id);
        });
      });
    });
  }
  function vaiA(id) {
    let el = radice.querySelector(`.bt-q[data-id="${id}"]`);
    if (!el) { filtro = 'tutte'; firmaLista = ''; disegna(); el = radice.querySelector(`.bt-q[data-id="${id}"]`); }
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate([{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: '0 0 0 6px hsl(278 50% 60% / .35)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1200 });
  }
  function salvaModifica(art, q) {
    const testo = clean(art.querySelector('[data-f="testo"]').value);
    const risposte = [...art.querySelectorAll('[data-f="risposta"]')].map(i => clean(i.value));
    const esatta = +(art.querySelector('[data-f="esatta"]:checked')?.value ?? -1);
    const err = art.querySelector('.bt-err');
    if (!testo) { err.textContent = 'Scrivi il testo della domanda.'; return; }
    if (risposte.some(r => !r)) { err.textContent = 'Compila tutte le risposte.'; return; }
    if (esatta < 0) { err.textContent = 'Indica la risposta esatta.'; return; }
    const cambiata = testo !== q.testo || risposte.join('|') !== q.risposte.join('|') || esatta !== q.esatta;
    Object.assign(q, { testo, risposte, esatta, difficolta: art.querySelector('[data-f="difficolta"]').value });
    if (cambiata) { q.controllo = { stato: 'da-fare' }; q.accettata = false; q.origine = q.origine === 'esempio' ? 'esempio' : 'modificata'; }
    modifica.delete(q.id); cambiato();
  }
  disegna();
  return registra(disegna);
}

function schedaDomanda(q, d, n) {
  const m = materia(q.materia);
  if (modifica.has(q.id)) return `<article class="bt-q modifica" data-id="${q.id}">
    <header><span class="bt-num">${n}</span><span class="chip ghost">${escHtml(m?.nome || 'Senza materia')}</span></header>
    <div class="field"><label>Domanda</label><textarea data-f="testo" rows="3">${escHtml(q.testo)}</textarea></div>
    <div class="bt-mod-risposte">${q.risposte.map((r, i) => `<label class="bt-mod-r"><input type="radio" name="esatta-${q.id}" data-f="esatta" value="${i}"${i === q.esatta ? ' checked' : ''} aria-label="Risposta ${LETTERE[i]} esatta"><b>${LETTERE[i]})</b><input data-f="risposta" value="${escHtml(r)}" aria-label="Risposta ${LETTERE[i]}"></label>`).join('')}</div>
    <p class="hint">Il pallino indica la risposta esatta.</p>
    <div class="row"><div class="field bt-mod-diff"><label>Difficoltà</label><select data-f="difficolta">${LIVELLI.map(l => `<option value="${l}"${l === q.difficolta ? ' selected' : ''}>${nomeDifficolta(l)}</option>`).join('')}</select></div></div>
    <p class="bt-err msg err" aria-live="polite"></p>
    <div class="bt-azioni"><button class="btn primary" type="button" data-a="salva">Salva</button><button class="btn" type="button" data-a="annulla">Annulla</button></div>
  </article>`;
  const p = problemi(q, d);
  const veri = p.filter(x => x.tipo !== 'da-controllare');
  const giusta = veri.find(x => x.giusta != null)?.giusta;
  const inRigenera = lavoro?.tipo === 'rigenera' && lavoro.id === q.id;
  const classe = q.accettata ? 'confermata' : veri.length ? 'da-rivedere' : p.length ? 'da-controllare' : 'a-posto';
  const stato = q.accettata ? '<span class="chip ok">Confermata</span>' : veri.length ? '<span class="chip err"><span class="dot"></span>Da rivedere</span>' : p.length ? '<span class="chip ghost">Da controllare</span>' : '<span class="chip ok">✓ Controllata</span>';
  const NOMI = { 'fuori-tema': 'Fuori tema', 'attinenza-dubbia': 'Attinenza dubbia', 'risposta-errata': 'Risposta errata', 'risposta-dubbia': 'Risposta dubbia', doppione: 'Doppione' };
  return `<article class="bt-q ${classe}${inRigenera ? ' rigenera' : ''}" data-id="${q.id}">
    <header><span class="bt-num">${n}</span><span class="chip ghost">${escHtml(m?.nome || 'Senza materia')}</span>${chipDiff(q.difficolta)}
      ${q.argomento || q.riferimento ? `<span class="bt-arg">${escHtml([q.argomento, q.riferimento].filter(Boolean).join(' · '))}</span>` : ''}<span class="bt-stato">${stato}</span></header>
    <p class="bt-testo">${escHtml(q.testo)}</p>
    <ol class="bt-risposte">${q.risposte.map((r, i) => `<li class="${i === q.esatta ? 'giusta' : ''}${i === giusta ? ' suggerita' : ''}"><b>${LETTERE[i]})</b> <span>${escHtml(r)}</span>${i === q.esatta ? '<em>esatta</em>' : ''}${i === giusta ? '<em>secondo il controllo</em>' : ''}</li>`).join('')}</ol>
    ${veri.length && !q.accettata ? `<ul class="bt-problemi">${veri.map(x => `<li class="${x.tipo}"><b>${NOMI[x.tipo]}</b> ${escHtml(x.testo)}${x.di ? ` <button class="linkbtn" type="button" data-a="vai" data-id="${x.di}">vedi</button>` : ''}</li>`).join('')}</ul>` : ''}
    ${inRigenera ? '<p class="bt-lavoro"><span class="ass-pulsa" aria-hidden="true"></span>Claude sta scrivendo una nuova domanda…</p>' : `<div class="bt-azioni">
      ${giusta != null && !q.accettata ? `<button class="btn primary" type="button" data-a="usa" data-i="${giusta}">Usa la risposta ${LETTERE[giusta]}</button>` : ''}
      ${modo === 'claude' && veri.length && !q.accettata ? `<button class="btn" type="button" data-a="rigenera"${lavoro ? ' disabled' : ''}>${ICONA_STELLA}Rigenera</button>` : ''}
      <button class="btn" type="button" data-a="modifica">Modifica</button>
      ${veri.length || q.accettata ? `<button class="btn" type="button" data-a="ok">${q.accettata ? 'Annulla conferma' : 'Va bene così'}</button>` : ''}
      <button class="btn bt-btn-togli" type="button" data-a="togli">Togli</button></div>`}
  </article>`;
}

/* ====================== 4 · Versioni e stampa ====================== */
let versioneVista = 0, mostraEsatte = false;
function montaEsporta(radice, ctx) {
  radice.innerHTML = `<div id="bt-ban"></div>
    <div class="bt-griglia">
      <div class="card" id="bt-versioni">
        <h3><span class="n">1</span>Versioni</h3>
        <div class="bt-due">
          <div class="field"><label for="bt-nver">Quante versioni</label><select id="bt-nver">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n === 1 ? '1 (solo A)' : `${n} (A–${String.fromCharCode(64 + n)})`}</option>`).join('')}</select></div>
          <div class="field"><label for="bt-ordine">Ordine delle domande</label><select id="bt-ordine">${ORDINI.map(o => `<option value="${o.id}">${escHtml(o.nome)}</option>`).join('')}</select></div>
        </div>
        <label class="check"><input type="checkbox" id="bt-mescola"><b>Mescola anche le risposte</b><small>La risposta esatta cambia lettera da una versione all'altra.</small></label>
        <div class="bt-seme"><div class="field"><label for="bt-seme">Seme</label><input id="bt-seme" type="number" min="1" max="999999" inputmode="numeric"></div><button class="btn" type="button" id="bt-rimescola">Rimescola</button>
          <small class="hint">Con lo stesso seme si ottengono sempre le stesse versioni.</small></div>
      </div>
      <div class="card" id="bt-stampa">
        <h3><span class="n">2</span>Stampa</h3>
        <div class="field"><label for="bt-istr">Istruzioni per i candidati</label><textarea id="bt-istr" rows="3"></textarea></div>
        <label class="check"><input type="checkbox" id="bt-campi"><b>Spazio per nome e codice</b><small>In testa alla prima pagina.</small></label>
        <label class="check"><input type="checkbox" id="bt-titmat"><b>Titolo di ogni materia</b><small>Solo se le domande restano raggruppate per materia.</small></label>
        <label class="check"><input type="checkbox" id="bt-sol"><b>Anche la copia per la commissione</b><small>Uguale alla batteria, con le risposte esatte in grassetto.</small></label>
      </div>
    </div>
    <div id="bt-avvisi"></div>
    <section class="barra" id="bt-barra" aria-label="Riepilogo">
      <div class="stats" id="bt-stats-e"></div>
      <div class="row">
        <button class="btn primary" type="button" id="bt-word">${ICONA_GIU}<span>Word delle versioni</span></button>
        <button class="btn" type="button" id="bt-xlsx">Excel delle domande</button>
        <button class="btn" type="button" id="bt-griglie">Griglie di correzione</button>
      </div>
    </section>
    <div class="bt-anteprima card" id="bt-anteprima">
      <div class="bt-ant-testa"><h3>Anteprima</h3><div class="bt-schede" id="bt-schede" role="tablist" aria-label="Versione"></div>
        <label class="bt-mostra"><input type="checkbox" id="bt-esatte"> Mostra le risposte esatte</label></div>
      <div class="bt-scrivania" id="bt-scrivania"></div>
    </div>`;
  const $ = s => radice.querySelector(s);
  // S.versioni e S.stampa si rileggono ogni volta: «Comincia da zero» li sostituisce
  function valori() {
    const V = S.versioni, P = S.stampa;
    $('#bt-nver').value = String(V.quante); $('#bt-ordine').value = V.ordine; $('#bt-mescola').checked = V.risposte; $('#bt-seme').value = V.seme;
    $('#bt-istr').value = P.istruzioni ?? ISTRUZIONI_BASE; $('#bt-campi').checked = P.campi; $('#bt-titmat').checked = P.titoliMaterie; $('#bt-sol').checked = P.soluzioni;
  }
  valori();
  const su = (sel, ev, f) => $(sel).addEventListener(ev, e => { f(e.target); cambiato(); });
  su('#bt-nver', 'change', t => { S.versioni.quante = +t.value; versioneVista = Math.min(versioneVista, S.versioni.quante - 1); });
  su('#bt-ordine', 'change', t => { S.versioni.ordine = t.value; });
  su('#bt-mescola', 'change', t => { S.versioni.risposte = t.checked; });
  su('#bt-seme', 'input', t => { S.versioni.seme = Math.max(1, Math.round(+t.value || 1)); });
  $('#bt-rimescola').addEventListener('click', () => { S.versioni.seme = Math.floor(Math.random() * 900000) + 1000; $('#bt-seme').value = S.versioni.seme; cambiato(); });
  su('#bt-istr', 'input', t => { S.stampa.istruzioni = t.value; });
  su('#bt-campi', 'change', t => { S.stampa.campi = t.checked; });
  su('#bt-titmat', 'change', t => { S.stampa.titoliMaterie = t.checked; });
  su('#bt-sol', 'change', t => { S.stampa.soluzioni = t.checked; });
  $('#bt-esatte').addEventListener('change', e => { mostraEsatte = e.target.checked; disegna(); });

  const versioni = () => creaVersioni(domandeOrdinate(), S.materie, S.versioni);
  const conTitoli = () => S.stampa.titoliMaterie && S.versioni.ordine !== 'tutte';
  const opzWord = (v, soluzioni) => ({ titolo: S.titolo, versione: v.lettera, istruzioni: S.stampa.istruzioni, campi: S.stampa.campi, domande: v.domande, titoliMaterie: conTitoli(), soluzioni, nomeMateria });

  $('#bt-word').addEventListener('click', async () => {
    const vs = versioni(); if (!vs[0].domande.length) return ctx.avviso('Non ci sono domande da stampare.');
    const voci = [];
    for (const v of vs) {
      voci.push({ nome: `${titoloFile()} - Versione ${v.lettera}.docx`, blob: await creaDocx(opzWord(v, false)) });
      if (S.stampa.soluzioni) voci.push({ nome: `${titoloFile()} - Versione ${v.lettera} - Commissione.docx`, blob: await creaDocx(opzWord(v, true)) });
    }
    if (voci.length === 1) await ctx.salva(voci[0].nome, voci[0].blob);
    else await ctx.salva(`${titoloFile()} - Batterie - ${oggiIt()}.zip`, await creaZip(voci));
    emetti(`${ID}:scaricato`);
  });
  $('#bt-xlsx').addEventListener('click', async () => {
    if (!S.domande.length) return ctx.avviso('Non ci sono domande.');
    await ctx.salva(`${titoloFile()} - Domande - ${oggiIt()}.xlsx`, await excelDomande());
    emetti(`${ID}:scaricato`);
  });
  $('#bt-griglie').addEventListener('click', async () => {
    const vs = versioni(); if (!vs[0].domande.length) return ctx.avviso('Non ci sono domande.');
    await ctx.salva(`${titoloFile()} - Griglie di correzione - ${oggiIt()}.xlsx`, await excelGriglie(vs));
    emetti(`${ID}:scaricato`);
  });

  function disegna() {
    $('#bt-ban').innerHTML = bannerEsempio(); collegaBanner(radice, () => { valori(); disegna(); });
    $('#bt-titmat').disabled = S.versioni.ordine === 'tutte';
    const c = classifica(), vs = versioni();
    const avvisi = [];
    if (c.rivedere.length) avvisi.push(`${c.rivedere.length} domand${c.rivedere.length === 1 ? 'a è' : 'e sono'} da rivedere`);
    if (c.dafare.length) avvisi.push(`${c.dafare.length} non ${c.dafare.length === 1 ? 'è stata controllata' : 'sono state controllate'}`);
    const mancano = totaleMancanti();
    if (mancano) avvisi.push(`mancano ${mancano} domande rispetto a quelle previste`);
    $('#bt-avvisi').innerHTML = avvisi.length ? `<p class="msg bt-msg info">Attenzione: ${avvisi.join(', ')}. <a href="#${ID}.${c.rivedere.length || c.dafare.length ? 'controllo' : 'genera'}">Vai a sistemarle</a> oppure scarica comunque.</p>` : '';
    const stat = (k, v) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    $('#bt-stats-e').innerHTML = stat('Domande', S.domande.length) + stat('Versioni', vs.length) + stat('Risposte', S.nRisposte) + stat('Seme', S.versioni.seme);
    $('#bt-word span').textContent = vs.length === 1 && !S.stampa.soluzioni ? 'Word della batteria' : `Word delle versioni (ZIP)`;
    // anteprima
    versioneVista = Math.min(versioneVista, vs.length - 1);
    $('#bt-schede').innerHTML = vs.map((v, i) => `<button type="button" role="tab" aria-selected="${i === versioneVista}" class="bt-scheda${i === versioneVista ? ' on' : ''}" data-v="${i}">${v.lettera}</button>`).join('');
    $('#bt-schede').querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => { versioneVista = +b.dataset.v; disegna(); }));
    $('#bt-scrivania').innerHTML = foglioAnteprima(vs[versioneVista], conTitoli());
  }
  disegna();
  return registra(disegna);
}

function foglioAnteprima(v, titoli) {
  if (!v || !v.domande.length) return '<p class="vuoto">Non ci sono domande da mostrare.</p>';
  let prima = null;
  const righe = v.domande.map(d => {
    const t = titoli && d.q.materia !== prima ? `<h4 class="bt-f-mat">${escHtml(nomeMateria(d.q.materia))}</h4>` : '';
    prima = d.q.materia;
    return `${t}<div class="bt-f-q"><p><b>${d.n}.</b> ${escHtml(d.q.testo)}</p><ol>${d.risposte.map((r, i) => `<li${mostraEsatte && i === d.esatta ? ' class="giusta"' : ''}><b>${LETTERE[i]})</b> ${escHtml(r)}</li>`).join('')}</ol></div>`;
  }).join('');
  return `<div class="bt-foglio">
    <div class="bt-f-testata"><span>${escHtml(S.titolo)}</span><b>Versione ${v.lettera}</b></div>
    <h3 class="bt-f-titolo">${escHtml(S.titolo || 'Prova')}</h3><p class="bt-f-ver">Versione ${v.lettera}</p>
    ${S.stampa.campi ? '<p class="bt-f-campi">Cognome e nome <span></span> Codice <span class="corto"></span></p>' : ''}
    ${S.stampa.istruzioni?.trim() ? `<p class="bt-f-istr"><b>Istruzioni:</b> ${escHtml(S.stampa.istruzioni)}</p>` : ''}
    ${righe}
  </div>`;
}

/* ---------- Excel ---------- */
const SI_NO = { si: 'sì', no: 'no', dubbio: 'dubbio' };
async function excelDomande() {
  const qs = domandeOrdinate(), d = doppi();
  const nR = Math.max(S.nRisposte, ...qs.map(q => q.risposte.length));
  const numeri = new Map(qs.map((q, i) => [q.id, i + 1]));
  const colonne = [
    { titolo: 'N.', larghezza: 6, stile: 'centro' }, { titolo: 'Materia', larghezza: 24, stile: 'testo' }, { titolo: 'Difficoltà', larghezza: 11 },
    { titolo: 'Domanda', larghezza: 60, stile: 'testo' },
    ...Array.from({ length: nR }, (_, i) => ({ titolo: LETTERE[i], larghezza: 30, stile: 'testo' })),
    { titolo: 'Esatta', larghezza: 8, stile: 'forte' }, { titolo: 'Argomento', larghezza: 22, stile: 'testo' }, { titolo: 'Riferimento', larghezza: 22, stile: 'testo' },
    { titolo: 'Attinenza', larghezza: 11, stile: 'centro' }, { titolo: 'Motivo attinenza', larghezza: 32, stile: 'testo' },
    { titolo: 'Risposta esatta verificata', larghezza: 13, stile: 'centro' }, { titolo: 'Motivo risposta', larghezza: 32, stile: 'testo' },
    { titolo: 'Doppione della n.', larghezza: 11, stile: 'centro' }, { titolo: 'Confermata', larghezza: 11, stile: 'centro' }, { titolo: 'Origine', larghezza: 11 },
  ];
  const ORIG = { claude: 'Claude', incollata: 'Claude (incollata)', excel: 'Excel', modificata: 'modificata', esempio: 'esempio' };
  const righe = qs.map((q, i) => {
    const c = q.controllo?.stato === 'fatto' ? q.controllo : null;
    const dp = d.get(q.id)?.di || c?.doppioneDi;
    return [i + 1, nomeMateria(q.materia), nomeDifficolta(q.difficolta), q.testo, ...Array.from({ length: nR }, (_, k) => q.risposte[k] || ''),
      LETTERE[q.esatta], q.argomento, q.riferimento,
      c ? SI_NO[c.attinenza] : 'da controllare', c?.motivoAttinenza || '', c ? SI_NO[c.risposta] : '', c?.motivoRisposta || '',
      dp ? numeri.get(dp) || '' : '', q.accettata ? 'sì' : '', ORIG[q.origine] || q.origine];
  });
  const materie = S.materie.filter(m => m.nome.trim() || domandeDi(m.id).length).map(m => {
    const { tot, per } = conteggio(m);
    return [m.nome, m.quante, tot, per.facile || 0, per.media || 0, per.difficile || 0, nomeDifficolta(m.difficolta), m.note];
  });
  return creaXlsx([
    { nome: 'Domande', colonne, righe },
    { nome: 'Materie', colonne: [{ titolo: 'Materia', larghezza: 30, stile: 'testo' }, { titolo: 'Domande previste', larghezza: 11, stile: 'centro' }, { titolo: 'Presenti', larghezza: 10, stile: 'centro' }, { titolo: 'Facili', larghezza: 9, stile: 'centro' }, { titolo: 'Medie', larghezza: 9, stile: 'centro' }, { titolo: 'Difficili', larghezza: 9, stile: 'centro' }, { titolo: 'Difficoltà richiesta', larghezza: 14 }, { titolo: 'Argomenti', larghezza: 50, stile: 'testo' }], righe: materie },
    { nome: 'Impostazioni', colonne: [{ titolo: 'Voce', larghezza: 22 }, { titolo: 'Valore', larghezza: 90, stile: 'testo' }], filtri: false, righe: [
      ['Titolo', S.titolo], ['Risposte per domanda', S.nRisposte], ['Programma del bando', S.programma], ['Versioni', S.versioni.quante], ['Seme delle versioni', S.versioni.seme], ['Creato il', oggiIt('/')],
    ] },
  ]);
}

async function excelGriglie(vs) {
  const qs = domandeOrdinate(), numeri = new Map(qs.map((q, i) => [q.id, i + 1]));
  const fogli = vs.map(v => ({
    nome: `Versione ${v.lettera}`,
    colonne: [{ titolo: 'N.', larghezza: 6, stile: 'centro' }, { titolo: 'Risposta esatta', larghezza: 10, stile: 'forte' }, { titolo: 'Materia', larghezza: 28, stile: 'testo' }, { titolo: 'N. nella batteria', larghezza: 12, stile: 'centro' }],
    righe: v.domande.map(d => [d.n, LETTERE[d.esatta], nomeMateria(d.q.materia), numeri.get(d.q.id)]),
  }));
  const pos = vs.map(v => new Map(v.domande.map(d => [d.q.id, d])));
  fogli.push({
    nome: 'Tutte le versioni',
    colonne: [{ titolo: 'N. nella batteria', larghezza: 10, stile: 'centro' }, { titolo: 'Domanda', larghezza: 50, stile: 'testo' }, { titolo: 'Materia', larghezza: 24, stile: 'testo' },
      ...vs.flatMap(v => [{ titolo: `${v.lettera}: n.`, larghezza: 7, stile: 'centro' }, { titolo: `${v.lettera}: esatta`, larghezza: 9, stile: 'forte' }])],
    righe: qs.map((q, i) => [i + 1, q.testo, nomeMateria(q.materia), ...pos.flatMap(p => { const d = p.get(q.id); return [d.n, LETTERE[d.esatta]]; })]),
  });
  fogli.push({ nome: 'Note', colonne: [{ titolo: 'Voce', larghezza: 22 }, { titolo: 'Valore', larghezza: 70, stile: 'testo' }], filtri: false, righe: [
    ['Prova', S.titolo], ['Versioni', vs.map(v => v.lettera).join(', ')], ['Ordine', ORDINI.find(o => o.id === S.versioni.ordine)?.nome || ''], ['Risposte mescolate', S.versioni.risposte ? 'sì' : 'no'], ['Seme', S.versioni.seme], ['Creato il', oggiIt('/')],
  ] });
  return creaXlsx(fogli);
}
