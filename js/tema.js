// Tema chiaro, scuro o automatico (come il sistema). La scelta resta salvata nel browser di chi usa la pagina.
// Lo script in testa a index.html la applica prima che la pagina si disegni, così non c'è il lampo del tema sbagliato.
// Il cambio si vede come un cerchio che si allarga dal bottone premuto (View Transitions, dove il browser le ha).
import { riduciMovimento } from './movimento.js';

const CHIAVE = 'cs-tema';
const ico = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SCELTE = [
  { id: 'light', nome: 'Chiaro', icona: ico('<circle cx="10" cy="10" r="3.4"/><path d="M10 2.6v1.6M10 15.8v1.6M2.6 10h1.6M15.8 10h1.6M4.8 4.8l1.1 1.1M14.1 14.1l1.1 1.1M4.8 15.2l1.1-1.1M14.1 5.9l1.1-1.1"/>') },
  { id: 'auto', nome: 'Automatico, come il sistema', icona: ico('<circle cx="10" cy="10" r="6.6"/><path d="M10 3.4a6.6 6.6 0 0 1 0 13.2z" fill="currentColor" stroke="none"/>') },
  { id: 'dark', nome: 'Scuro', icona: ico('<path d="M15.6 12.4A6.4 6.4 0 0 1 7.6 4.4a6.4 6.4 0 1 0 8 8z"/>') },
];

const sistemaScuro = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

export function sceltaTema() {
  try { const t = localStorage.getItem(CHIAVE); return t === 'light' || t === 'dark' ? t : 'auto'; } catch { return 'auto'; }
}
/** Il tema che si vede davvero: 'light' o 'dark'. */
export function temaEffettivo() {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : (sistemaScuro() ? 'dark' : 'light');
}
function applica(scelta) {
  const r = document.documentElement;
  if (scelta === 'auto') delete r.dataset.theme; else r.dataset.theme = scelta;
  try { if (scelta === 'auto') localStorage.removeItem(CHIAVE); else localStorage.setItem(CHIAVE, scelta); } catch { /* il browser non salva: la scelta vale finché la pagina resta aperta */ }
}

/** Disegna l'interruttore in `el`. `cambiato({ x, y, tema })` viene chiamata a ogni cambio visibile. */
export function montaInterruttoreTema(el, { cambiato } = {}) {
  if (!el) return;
  el.innerHTML = '<span class="tema-cursore" aria-hidden="true"></span>' + SCELTE.map(s =>
    `<button type="button" class="tema-voce" data-tema="${s.id}" title="${s.nome}" aria-label="Tema: ${s.nome}">${s.icona}</button>`).join('');
  const aggiorna = () => {
    const scelta = sceltaTema(), vero = temaEffettivo();
    el.dataset.scelta = scelta; el.dataset.vero = vero;
    el.querySelectorAll('.tema-voce').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tema === scelta)));
  };
  aggiorna();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', aggiorna);

  el.addEventListener('click', e => {
    const b = e.target.closest('.tema-voce'); if (!b) return;
    const scelta = b.dataset.tema;
    if (scelta === sceltaTema()) return;
    const prima = temaEffettivo(), dopo = scelta === 'auto' ? (sistemaScuro() ? 'dark' : 'light') : scelta;
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const cambia = () => { applica(scelta); aggiorna(); };
    if (prima === dopo || riduciMovimento() || !document.startViewTransition) { cambia(); if (prima !== dopo) cambiato?.({ x, y, tema: dopo }); return; }
    const vt = document.startViewTransition(cambia);
    vt.ready.then(() => {
      const raggio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raggio}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(.55,0,.2,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
    cambiato?.({ x, y, tema: dopo });
  });
}
