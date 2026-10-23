// Avvio della pagina: menu, navigazione tra funzioni e sezioni, assistente.
// Indirizzi: "#"  → menu;  "#ricevute" → prima sezione;  "#ricevute.modello" → sezione precisa.
import STRUMENTI from '../strumenti/elenco.js';
import { disegnaMenu, chiudiMenu, riapriMenu, vola, cascata, rettangoloNodo, geometriaMenu, riduciMovimento } from './menu.js';
import { creaCampo, attivaMicroInterazioni, comparsa } from './vivo.js';
import { creaAssistente } from './assistente.js';
import { emetti } from './eventi.js';
import { salvaFile, avviso } from '../lib/salva.js';
import { escHtml } from '../lib/formati.js';

const $ = s => document.querySelector(s);
const vistaMenu = $('#vista-menu'), vistaStr = $('#vista-strumento');
const laterale = $('#laterale'), contenuto = $('#contenuto'), briciole = $('#briciole');
const assistente = creaAssistente();

let attuale = { s: null, sezione: null, smonta: null };
let origineVolo = null;
let primoGiro = true;   // all'apertura diretta di un indirizzo niente animazioni

const campo = creaCampo($('#campo'), { tinte: STRUMENTI.map(s => s.tinta) });
campo.geometria(geometriaMenu);
attivaMicroInterazioni();

disegnaMenu(vistaMenu, STRUMENTI, {
  scegli(id, rect) {
    const s = STRUMENTI.find(x => x.id === id);
    campo.scintille(rect.left + rect.width / 2, rect.top + rect.height / 2, s.tinta);
    origineVolo = rect; location.hash = id;
  },
  evidenziata: id => campo.evidenzia(id),
});

const ICONA_GUIDA = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1v.4M8 11.3h.01"/></svg>';
const chipStato = s => s.stato === 'pronto'
  ? '<span class="chip ok"><span class="dot"></span>Pronta</span>'
  : `<span class="chip warn"><span class="dot"></span>${escHtml(s.stato)}</span>`;

function leggiIndirizzo() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [id, sez] = h.split('.');
  return { id, sez };
}

async function naviga() {
  const { id, sez } = leggiIndirizzo();
  const s = STRUMENTI.find(x => x.id === id);
  if (!s) return mostraMenu();
  const sezione = s.sezioni.some(x => x.id === sez) ? sez : s.sezioni[0].id;
  if (attuale.s === s) {
    if (attuale.sezione !== sezione) {
      aggiornaSottomenu(sezione);
      await montaSezione(s, sezione);
      if (!riduciMovimento()) {
        contenuto.querySelector('.sez-testa')?.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
        comparsa(contenuto.querySelectorAll('.sez-corpo > * > *'), { passo: 55, max: 8, ritardo: 60 });
      }
    }
    return;
  }
  await apriStrumento(s, sezione);
}

async function apriStrumento(s, sezione) {
  const dalMenu = !vistaMenu.hidden && !attuale.s && !primoGiro;
  const da = dalMenu ? (origineVolo || rettangoloNodo(s.id)) : null;
  origineVolo = null;
  if (dalMenu && da) await chiudiMenu(s.id);
  smontaAttuale();
  attuale = { s, sezione: null, smonta: null };
  campo.modalita('strumento');
  disegnaLaterale(s, sezione);
  vistaMenu.hidden = true; vistaStr.hidden = false;
  window.scrollTo(0, 0);
  const voci = laterale.querySelectorAll('.sottomenu li, .siti, .lat-azioni');
  const contenutoPronto = montaSezione(s, sezione);
  if (da && !riduciMovimento()) {
    cascata(voci, 260, laterale.querySelector('.sottomenu ol'));
    contenuto.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 240, easing: 'ease-out', fill: 'backwards' });
    contenutoPronto.then(() => comparsa(contenuto.querySelectorAll('.sez-corpo > * > *'), { passo: 60, max: 8, ritardo: 300 }));
    await vola(da, $('#ancora'), s);
    $('#ancora')?.animate([{ scale: 1 }, { scale: 1.12 }, { scale: 1 }], { duration: 420, easing: 'ease-out' });
  }
  await contenutoPronto;
  muoviPerla(true);
}

async function mostraMenu() {
  const veniva = attuale.s;
  if (!veniva && !vistaMenu.hidden) return;
  const ancora = $('#ancora');
  const da = veniva && ancora && !vistaStr.hidden ? ancora.getBoundingClientRect() : null;
  smontaAttuale();
  attuale = { s: null, sezione: null, smonta: null };
  assistente.chiudi();
  vistaStr.hidden = true; vistaMenu.hidden = false;
  campo.modalita('menu');
  briciole.innerHTML = '';
  document.title = 'CS Strumenti';
  riapriMenu({ anima: !!veniva, tranne: veniva?.id });
  if (veniva && da) {
    const nodo = vistaMenu.querySelector(`.nodo[data-id="${veniva.id}"] .nodo-cerchio`);
    if (nodo) await vola(da, nodo, veniva);
    vistaMenu.querySelector(`.nodo[data-id="${veniva.id}"]`)?.focus({ preventScroll: true });
  }
}

function smontaAttuale() {
  if (attuale.smonta) { try { attuale.smonta(); } catch (e) { console.error(e); } }
  attuale.smonta = null;
}

function disegnaLaterale(s, sezione) {
  laterale.style.setProperty('--h', s.tinta);
  laterale.innerHTML = `
    <div class="ancora-blocco" data-stato="${escHtml(s.stato)}">
      <button class="ancora" type="button" id="ancora" title="Torna al menu" aria-label="Torna al menu delle funzioni">${s.icona}</button>
      <div><h1 class="lat-nome">${escHtml(s.nome)}</h1>${chipStato(s)}</div>
    </div>
    <nav class="sottomenu" aria-label="Sezioni di ${escHtml(s.nome)}"><ol>
      ${s.sezioni.map(x => `<li><a href="#${s.id}.${x.id}" data-sez="${x.id}"><span class="voce-nome">${escHtml(x.nome)}</span>${x.breve ? `<span class="voce-desc">${escHtml(x.breve)}</span>` : ''}</a></li>`).join('')}
    </ol><span class="perla" aria-hidden="true"></span></nav>
    ${s.siti && s.siti.length ? `<div class="siti"><h2 class="lat-tit">Siti collegati</h2><ul>
      ${s.siti.map(l => `<li><a href="${escHtml(l.url)}" target="_blank" rel="noopener"><b>${escHtml(l.nome)}</b><span class="freccia" aria-hidden="true">↗</span>${l.descrizione ? `<small>${escHtml(l.descrizione)}</small>` : ''}</a></li>`).join('')}
    </ul></div>` : ''}
    <div class="lat-azioni">
      <button class="btn" type="button" id="btn-guida">${ICONA_GUIDA}Guidami passo passo</button>
      <a class="linkbtn" href="#">← Tutte le funzioni</a>
    </div>`;
  $('#ancora').addEventListener('click', () => { location.hash = ''; });
  $('#btn-guida').addEventListener('click', () => avviaGuida());
  const nav = laterale.querySelector('.sottomenu');
  nav.addEventListener('pointerover', e => { const li = e.target.closest('li'); if (li) muoviPerla(false, li); });
  nav.addEventListener('focusin', e => { const li = e.target.closest('li'); if (li) muoviPerla(false, li); });
  nav.addEventListener('pointerleave', () => muoviPerla());
  nav.addEventListener('focusout', () => muoviPerla());
  aggiornaSottomenu(sezione);
}

/** La «perla» scorre lungo la linea della cascata fino alla voce sotto il puntatore, o a quella attiva. */
function muoviPerla(subito = false, li = null) {
  const perla = laterale.querySelector('.perla');
  li = li || laterale.querySelector('.sottomenu a[aria-current]')?.closest('li');
  if (!perla || !li) return;
  if (subito) perla.style.transition = 'none';
  perla.style.transform = `translateY(${li.offsetTop + 12}px)`;
  perla.classList.toggle('sopra', !li.querySelector('a[aria-current]'));
  if (subito) { perla.offsetWidth; perla.style.transition = ''; }
}

function aggiornaSottomenu(sezione) {
  laterale.querySelectorAll('.sottomenu a').forEach(a => {
    if (a.dataset.sez === sezione) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  muoviPerla();
}

async function montaSezione(s, sezione) {
  smontaAttuale();
  assistente.chiudi();
  attuale.sezione = sezione;
  const sez = s.sezioni.find(x => x.id === sezione);
  document.title = `${sez.nome} · ${s.nome} · CS Strumenti`;
  briciole.innerHTML = `<a href="#">Funzioni</a><span class="sep">/</span><a href="#${s.id}">${escHtml(s.nome)}</a><span class="sep">/</span><span aria-current="page">${escHtml(sez.nome)}</span>`;
  contenuto.innerHTML = `<header class="sez-testa"><h2>${escHtml(sez.nome)}</h2>${sez.descrizione ? `<p>${escHtml(sez.descrizione)}</p>` : ''}</header><div class="sez-corpo"></div>`;
  const passi = s.guida && s.guida[sezione];
  const bg = $('#btn-guida'); if (bg) bg.hidden = !(passi && passi.length);
  const ctx = {
    strumento: s, sezione,
    emetti: (nome, dati) => emetti(`${s.id}:${nome}`, dati),
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
}

function avviaGuida() {
  const { s, sezione } = attuale;
  if (!s) return;
  const sez = s.sezioni.find(x => x.id === sezione);
  assistente.avvia({ contesto: `${s.nome} · ${sez.nome}`, passi: s.guida && s.guida[sezione], prefisso: s.id });
}

window.addEventListener('hashchange', naviga);
naviga().finally(() => { primoGiro = false; });
