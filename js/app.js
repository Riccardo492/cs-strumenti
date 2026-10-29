// Avvio della pagina e navigazione.
// Indirizzi: "#" → Scrivania;  "#ricevute" → prima sezione della funzione;  "#ricevute.modello" → sezione precisa.
//
// Struttura (come una dashboard): in alto le «pillole» delle funzioni con la pillola attiva che scorre,
// sotto il percorso e le sotto-schede delle sezioni con una linea che scorre; al centro la vista.
// I cambi di vista passano con le View Transitions del browser: titolo, pillola, linea e icona della funzione
// si trasformano da una vista all'altra invece di sparire e ricomparire.
import STRUMENTI from '../strumenti/elenco.js';
import { attivaMicroInterazioni } from './vivo.js';
import { creaCampo } from './campo.js';
import { montaInterruttoreTema } from './tema.js';
import { montaInterruttoreStile } from './stile.js';
import { creaAssistente } from './assistente.js';
import { emetti } from './eventi.js';
import { riduciMovimento } from './movimento.js';
import { creaPercorso } from './percorso.js';
import { montaScrivania, nomeUtente } from './scrivania.js';
import { salvaFile, avviso } from '../lib/salva.js';
import { escHtml, pad2 } from '../lib/formati.js';
import { registra } from '../lib/attivita.js';

const $ = s => document.querySelector(s);
const vista = $('#vista'), pillole = $('#pillole'), schede = $('#schede'), briciole = $('#briciole');
const ORDINE = [...STRUMENTI.filter(s => s.stato === 'pronto'), ...STRUMENTI.filter(s => s.stato !== 'pronto')];   // pillole: prima le funzioni pronte
const assistente = creaAssistente();
const etichetta = s => s.etichetta || s.nome.split(' ')[0];
const ICONA_GUIDA = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1v.4M8 11.3h.01"/></svg>';
const chipStato = s => s.stato === 'pronto' ? '<span class="chip ok"><span class="dot"></span>Pronta</span>' : `<span class="chip warn"><span class="dot"></span>${escHtml(s.stato)}</span>`;

let attuale = { s: null, sezione: null, smonta: null, percorso: null };
let primoGiro = true;   // all'apertura niente passaggi animati

const campo = creaCampo($('#campo'), { tinte: STRUMENTI.map(s => s.tinta) });
attivaMicroInterazioni();
montaInterruttoreTema($('#tema'), { cambiato: ({ x, y }) => campo.onda(x, y, .7) });
montaInterruttoreStile($('#stile'));

/* ====================== testata ====================== */
// Le pillole sono disegnate due volte: sotto quelle normali, sopra una copia «accesa» (testo chiaro su fondo pieno)
// ritagliata sulla pillola scelta. Il ritaglio scorre da una pillola all'altra, così fondo e testo si muovono insieme.
const pillola = (s, tag) => {
  const id = s ? s.id : '', nome = s ? etichetta(s) : 'Scrivania';
  const attr = s ? ` data-id="${s.id}" style="--h:${s.tinta}"` : ' data-id=""';
  const cls = `pillola${s && s.stato !== 'pronto' ? ' in-arrivo' : ''}`;
  return tag === 'a'
    ? `<a class="${cls}" href="#${id}"${attr} title="${escHtml(s ? s.nome + (s.stato === 'pronto' ? '' : ` (${s.stato})`) : 'Scrivania')}">${escHtml(nome)}<span class="pillola-n" hidden></span></a>`
    : `<span class="${cls}"${attr}>${escHtml(nome)}<span class="pillola-n" hidden></span></span>`;
};
pillole.innerHTML = [null, ...ORDINE].map(s => pillola(s, 'a')).join('') +
  `<span class="pillole-luce" aria-hidden="true">${[null, ...ORDINE].map(s => pillola(s, 'span')).join('')}</span>`;

/** La pillola accesa scorre fin sotto la voce scelta e ne prende il colore. */
function muoviPillola() {
  const id = attuale.s?.id || '';
  const a = pillole.querySelector(`a.pillola[data-id="${id}"]`);
  pillole.querySelectorAll('a.pillola').forEach(p => p === a ? p.setAttribute('aria-current', 'page') : p.removeAttribute('aria-current'));
  if (!a || !a.offsetWidth) return;
  pillole.style.setProperty('--x', a.offsetLeft + 'px'); pillole.style.setProperty('--w', a.offsetWidth + 'px');
  if (attuale.s) pillole.style.setProperty('--h', attuale.s.tinta); else pillole.style.removeProperty('--h');
  pillole.classList.toggle('di-funzione', !!attuale.s);
  if (a.offsetLeft < pillole.scrollLeft || a.offsetLeft + a.offsetWidth > pillole.scrollLeft + pillole.clientWidth)
    pillole.scrollTo({ left: a.offsetLeft - 24, behavior: riduciMovimento() || primoGiro ? 'auto' : 'smooth' });
  if (!pillole.classList.contains('pronte')) requestAnimationFrame(() => requestAnimationFrame(() => pillole.classList.add('pronte')));
}

/** Sotto-schede della funzione aperta, con la linea che scorre sotto quella attiva. */
function disegnaSchede() {
  const s = attuale.s;
  if (!s) { schede.innerHTML = ''; delete schede.dataset.id; return; }
  if (schede.dataset.id !== s.id) {
    schede.dataset.id = s.id;
    schede.classList.remove('pronte');
    schede.innerHTML = '<span class="linea-attiva" aria-hidden="true"></span>' + s.sezioni.map(x => `<a class="scheda" href="#${s.id}.${x.id}" data-sez="${x.id}">${escHtml(x.nome)}</a>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => schede.classList.add('pronte')));
  }
  const a = schede.querySelector(`.scheda[data-sez="${attuale.sezione}"]`), l = schede.querySelector('.linea-attiva');
  schede.querySelectorAll('.scheda').forEach(x => x === a ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'));
  if (a) {
    l.style.setProperty('--x', a.offsetLeft + 'px'); l.style.setProperty('--w', a.offsetWidth + 'px');
    if (a.offsetLeft < schede.scrollLeft || a.offsetLeft + a.offsetWidth > schede.scrollLeft + schede.clientWidth) schede.scrollTo({ left: a.offsetLeft - 16 });
  }
}
function disegnaBriciole() {
  const s = attuale.s;
  briciole.innerHTML = s
    ? `<a href="#">Scrivania</a><span class="sep">/</span><a href="#${s.id}" aria-current="page">${escHtml(etichetta(s))}</a>`
    : '<span aria-current="page">Scrivania</span>';
}
window.addEventListener('resize', () => { muoviPillola(); disegnaSchede(); });

/* «Guidami passo passo»: bottone fisso in basso a destra, resta a portata di clic mentre la pagina scorre;
   sparisce mentre l'assistente è aperto (css/struttura.css) e nelle sezioni senza guida */
const bottoneGuida = $('#btn-guida');
bottoneGuida.innerHTML = ICONA_GUIDA + '<span>Guidami passo passo</span>';
bottoneGuida.addEventListener('click', () => avviaGuida());
/* altezza della testata: serve al velo che nasconde il contenuto quando scorre sotto di lei (css/vetro.css) */
const testata = $('.testata');
const misuraTestata = () => document.documentElement.style.setProperty('--testata-h', testata.offsetHeight + 'px');
misuraTestata(); new ResizeObserver(misuraTestata).observe(testata);

/* orologio, numerini delle cose da fare */
function orologio() { const d = new Date(); $('#ora').textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
orologio(); setInterval(orologio, 20000);
async function aggiornaNumerini() {
  let tot = 0;
  await Promise.all(STRUMENTI.map(async s => {
    let n = 0;
    try { n = (await s.promemoria?.() || []).reduce((t, x) => t + (x.n || 0), 0); } catch (e) { /* una funzione non risponde: niente numerino */ }
    tot += n;
    pillole.querySelectorAll(`.pillola[data-id="${s.id}"] .pillola-n`).forEach(p => { p.hidden = !n; p.textContent = n > 99 ? '99+' : n; });
  }));
  const b = $('#bollino'); b.hidden = !tot; b.textContent = tot > 99 ? '99+' : tot;
  $('#campanella').title = tot ? `${tot} ${tot === 1 ? 'cosa' : 'cose'} da fare` : 'Niente da fare';
  muoviPillola();   // un numerino in più o in meno cambia la larghezza della pillola
}
/* la campanella porta all'elenco «Da fare» della Scrivania */
let aDaFare = false;
function mostraDaFare() {
  const d = $('#sc-dafare');
  if (!d) return false;
  d.scrollIntoView({ behavior: riduciMovimento() ? 'auto' : 'smooth', block: 'start' });
  d.classList.remove('lampeggia'); void d.offsetWidth; d.classList.add('lampeggia');
  return true;
}
$('#campanella').addEventListener('click', e => {
  e.preventDefault();
  if (!attuale.s && mostraDaFare()) return;
  aDaFare = true; location.hash = '';
});

/* menu «+ Nuovo» e nome per il saluto */
function popover(btn, pop, apri) {
  const chiudi = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const apre = pop.hidden;
    document.querySelectorAll('.menu-pop').forEach(x => { x.hidden = true; });
    pop.hidden = !apre; btn.setAttribute('aria-expanded', String(apre));
    if (apre) apri?.();
  });
  document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target)) chiudi(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { chiudi(); btn.focus(); } });
  return chiudi;
}
const menuNuovo = $('#menu-nuovo');
menuNuovo.innerHTML = STRUMENTI.filter(s => s.stato === 'pronto').map(s => `<a role="menuitem" href="#${s.id}" style="--h:${s.tinta}"><span class="mn-icona">${s.icona}</span><span><b>${escHtml(s.nome)}</b><small>${escHtml(s.sezioni[0].breve || '')}</small></span></a>`).join('');
const chiudiNuovo = popover($('#nuovo'), menuNuovo, () => menuNuovo.querySelector('a')?.focus());
menuNuovo.addEventListener('click', e => { if (e.target.closest('a')) chiudiNuovo(); });

const NOME = 'cs.nome';
function aggiornaAvatar() {
  const n = nomeUtente();
  $('#avatar').textContent = n ? n.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';
  $('#avatar').title = n ? `Ciao ${n}: clicca per cambiare nome` : 'Come ti chiami?';
}
aggiornaAvatar();
const campoNome = $('#profilo-nome');
const chiudiProfilo = popover($('#avatar'), $('#profilo-pop'), () => { campoNome.value = nomeUtente(); campoNome.focus(); });
campoNome.addEventListener('input', () => {
  try { localStorage.setItem(NOME, campoNome.value.trim()); } catch (e) { /* non salvato */ }
  aggiornaAvatar(); window.dispatchEvent(new CustomEvent('cs:nome'));
});
campoNome.addEventListener('keydown', e => { if (e.key === 'Enter') { chiudiProfilo(); $('#avatar').focus(); } });
window.addEventListener('cs:chiedi-nome', () => $('#avatar').click());

/* un clic sullo sfondo (non su un comando o una scheda) manda un'onda sulla mappa, nello stile classico */
const NON_SFONDO = 'a, button, input, select, textarea, label, summary, .card, .barra, .assistente, .tabella, .avviso, .tema, .testata, .sc-pannello, .pagina-testa, .percorso-box';
document.addEventListener('pointerdown', e => {
  if (e.button === 0 && e.target instanceof Element && !e.target.closest(NON_SFONDO)) campo.onda(e.clientX, e.clientY, .45);
});

/* ====================== passaggi tra le viste ====================== */
/**
 * Esegue `aggiorna` dentro una View Transition: il browser fotografa la vista di prima, si aggiorna e passa
 * dall'una all'altra; gli elementi con lo stesso nome (titolo, pillola, linea, icona della funzione) si trasformano.
 * `verso`: 'avanti' | 'indietro', per far scorrere il contenuto nella direzione giusta.
 */
let vtAttuale = null;
async function passaggio(aggiorna, verso = 'avanti', salto = 'funzione') {
  const fai = async () => { delete document.documentElement.dataset.vtUscita; window.scrollTo(0, 0); await aggiorna(); };
  if (primoGiro || riduciMovimento() || !document.startViewTransition || document.hidden) { await fai(); return; }
  // i nomi dei passaggi (css/struttura.css) valgono solo mentre data-verso è presente: fuori dai passaggi
  // nessun elemento ha un nome, così il vetro sfoca normalmente e il cambio di tema resta un unico cerchio;
  // data-vt-uscita dà un nome al contenuto vecchio solo per la foto di partenza
  const r = document.documentElement;
  r.dataset.verso = verso; r.dataset.salto = salto; r.dataset.vtUscita = '';
  const vt = vtAttuale = document.startViewTransition(fai);
  vt.ready.catch(() => {});   // passaggio saltato (per esempio la finestra cambia misura): la vista cambia comunque
  try { await vt.updateCallbackDone; } catch (e) { console.error(e); }
  vt.finished.catch(() => {}).finally(() => { if (vtAttuale === vt) { delete r.dataset.verso; delete r.dataset.salto; delete r.dataset.vtUscita; vtAttuale = null; } });
}

/* Il contenuto nuovo entra blocco per blocco, scorrendo nel verso dello spostamento.
   Si animano le lastre di vetro una per una (o i blocchi che non ne contengono): un contenitore semitrasparente
   impedirebbe al vetro che ha dentro di sfocare lo sfondo finché l'animazione non è finita. */
const VETRO = '.card, .barra, .sc-scheda, .sc-pannello, .percorso-box, details, .ric-elenco, .rpdf-elenco, .ric-scrivania, .bt-lista, .bt-esempio, .bt-filtro, .ic-cantiere';
function blocchi(el, out = []) {
  for (const c of el.children) {
    if (out.length >= 24) break;
    if (c.matches(VETRO) || !c.querySelector(VETRO)) out.push(c); else blocchi(c, out);
  }
  return out;
}
function animaEntrata(elementi) {
  if (primoGiro || riduciMovimento()) return;
  const dx = document.documentElement.dataset.verso === 'indietro' ? -32 : 32;
  elementi.forEach((el, i) => el.animate(
    [{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 460, delay: 110 + Math.min(i, 8) * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}

function leggiIndirizzo() {
  const [id, sez] = decodeURIComponent(location.hash.replace(/^#/, '')).split('.');
  return { id, sez };
}

async function naviga() {
  const { id, sez } = leggiIndirizzo();
  const s = STRUMENTI.find(x => x.id === id);
  if (!s) {
    if (attuale.s || vista.dataset.vista !== 'scrivania') await passaggio(mostraScrivania, 'indietro');
  } else {
    const sezione = s.sezioni.some(x => x.id === sez) ? sez : s.sezioni[0].id;
    if (attuale.s !== s || attuale.sezione !== sezione) {
      // il contenuto scorre nel verso in cui ci si sposta: tra le sezioni (sotto-schede) o tra le funzioni (pillole)
      const stessa = attuale.s === s;
      const avanti = stessa
        ? s.sezioni.findIndex(x => x.id === sezione) > s.sezioni.findIndex(x => x.id === attuale.sezione)
        : ORDINE.indexOf(s) > (attuale.s ? ORDINE.indexOf(attuale.s) : -1);
      await passaggio(() => mostraFunzione(s, sezione), avanti ? 'avanti' : 'indietro', stessa ? 'sezione' : 'funzione');
    }
  }
  aggiornaNumerini();
}

function smontaAttuale() {
  if (attuale.smonta) { try { attuale.smonta(); } catch (e) { console.error(e); } }
  attuale.smonta = null;
}

/* ---------- Scrivania ---------- */
async function mostraScrivania() {
  smontaAttuale();
  assistente.chiudi();
  attuale = { s: null, sezione: null, smonta: null, percorso: null };
  vista.dataset.vista = 'scrivania';
  vista.style.removeProperty('--h');
  document.documentElement.style.removeProperty('--h-attiva');
  bottoneGuida.hidden = true;
  campo.modalita('menu');
  document.title = 'Scrivania · CS Strumenti';
  muoviPillola(); disegnaSchede(); disegnaBriciole();
  attuale.smonta = await montaScrivania(vista, { strumenti: STRUMENTI, primoGiro });
  animaEntrata(blocchi(vista.querySelector('.sc-corpo')));
  if (aDaFare) { aDaFare = false; setTimeout(mostraDaFare, 380); }
}

/* ---------- una funzione ---------- */
async function mostraFunzione(s, sezione) {
  const nuova = attuale.s !== s;
  smontaAttuale();
  assistente.chiudi();
  if (nuova) {
    attuale = { s, sezione, smonta: null, percorso: null };
    vista.dataset.vista = 'funzione';
    vista.style.setProperty('--h', s.tinta);
    document.documentElement.style.setProperty('--h-attiva', s.tinta);   // sfondo e aurora prendono la tinta della funzione
    campo.modalita('strumento', { tinta: s.tinta, fuoco: iconaPagina });
    vista.innerHTML = `
      <header class="pagina-testa">
        <div class="pt-testo">
          <div class="pt-riga"><span class="pt-icona vt-ico" style="--vt: ico-${s.id}">${s.icona}</span><span class="pt-funzione">${escHtml(s.nome)}</span>${chipStato(s)}</div>
          <h1 class="pt-titolo"></h1>
          <p class="pt-desc"></p>
          ${s.siti && s.siti.length ? `<p class="pt-siti"><span>Siti collegati</span>${s.siti.map(l => `<a href="${escHtml(l.url)}" target="_blank" rel="noopener" title="${escHtml(l.descrizione || '')}">${escHtml(l.nome)} <span aria-hidden="true">↗</span></a>`).join('')}</p>` : ''}
        </div>
      </header>
      ${s.percorso ? '<div class="percorso-box" id="percorso"></div>' : ''}
      <div class="contenuto" id="contenuto"></div>`;
    if (s.percorso) attuale.percorso = creaPercorso($('#percorso'), { tappe: s.sezioni.map(x => ({ id: x.id, nome: x.nome.replace(/^\d+\s*·\s*/, '') })), href: id => `#${s.id}.${id}` });
  }
  attuale.sezione = sezione;
  const sez = s.sezioni.find(x => x.id === sezione);
  document.title = `${sez.nome} · ${s.nome} · CS Strumenti`;
  vista.querySelector('.pt-titolo').textContent = sez.nome;
  vista.querySelector('.pt-desc').textContent = sez.descrizione || '';
  muoviPillola(); disegnaSchede(); disegnaBriciole();
  const passi = s.guida && s.guida[sezione];
  bottoneGuida.hidden = !(passi && passi.length);
  const contenuto = $('#contenuto');
  contenuto.innerHTML = '<div class="sez-corpo"></div>';
  const ctx = {
    strumento: s, sezione,
    emetti: (nome, dati) => { emetti(`${s.id}:${nome}`, dati); aggiornaPercorso(); aggiornaNumerini(); },
    registra: dati => registra(s.id, dati),
    salva: salvaFile, avviso,
    guida: avviaGuida,
  };
  try {
    const r = await s.monta(contenuto.querySelector('.sez-corpo'), ctx);
    if (attuale.s === s && attuale.sezione === sezione) attuale.smonta = typeof r === 'function' ? r : null;
    else if (typeof r === 'function') r();
  } catch (e) {
    console.error(e);
    contenuto.querySelector('.sez-corpo').innerHTML = `<p class="msg err">Questa sezione non si è caricata: ${escHtml(e.message || String(e))}</p>`;
  }
  aggiornaPercorso(!nuova);
  animaEntrata([...(nuova && attuale.percorso ? [$('#percorso')] : []), ...blocchi(contenuto.querySelector('.sez-corpo'))]);
}

/** Centro e raggio dell'icona della funzione aperta: nello stile classico la mappa ci mette il suo rilievo. */
function iconaPagina() {
  const a = vista.querySelector('.pt-icona');
  if (!a) return null;
  const r = a.getBoundingClientRect();
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 + 6 } : null;
}

/** Il percorso a tappe segue la sezione aperta e lo stato della funzione (per esempio le domande da rivedere). */
async function aggiornaPercorso(anima = true) {
  const { s, percorso, sezione } = attuale;
  if (!s || !percorso || !s.percorso) return;
  let info = {};
  try { info = await s.percorso(); } catch (e) { /* senza stato: solo le tappe */ }
  if (attuale.percorso === percorso) percorso.vai(attuale.sezione || sezione, info, anima);
}
window.addEventListener('cs:attivita', () => { aggiornaNumerini(); aggiornaPercorso(); });

function avviaGuida() {
  const { s, sezione } = attuale;
  if (!s) return;
  const sez = s.sezioni.find(x => x.id === sezione);
  assistente.avvia({ contesto: `${s.nome} · ${sez.nome}`, passi: s.guida && s.guida[sezione], prefisso: s.id });
}

window.addEventListener('hashchange', naviga);
naviga().finally(() => {
  primoGiro = false;
  // a pagina pronta, quando il browser è libero, si caricano le altre funzioni: i passaggi non aspettano la rete
  const libero = window.requestIdleCallback || (f => setTimeout(f, 1200));
  libero(() => STRUMENTI.forEach(s => { try { s.precarica?.()?.catch?.(() => {}); } catch (e) { /* si caricherà all'apertura */ } }));
});
setInterval(() => { if (!document.hidden) { aggiornaNumerini(); aggiornaPercorso(); } }, 15000);
