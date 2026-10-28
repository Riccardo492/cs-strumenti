// Aiuti condivisi dalle schede delle funzioni: icone, fogli di stile, pagina «in costruzione».
import { escHtml } from '../lib/formati.js';

/** Icona a tratto su griglia 24×24. */
export const icona = tracciati => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tracciati}</svg>`;

/** Carica (una volta sola) il foglio di stile di una funzione; chi lo chiede mentre arriva aspetta lo stesso caricamento. */
const fogli = new Map();
export function caricaCss(url) {
  const href = String(url);
  if (fogli.has(href)) return fogli.get(href);
  if (document.querySelector(`link[data-css="${CSS.escape(href)}"]`)) return Promise.resolve();
  const p = new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.dataset.css = href;
    l.onload = l.onerror = () => res();
    document.head.appendChild(l);
    setTimeout(res, 1500);
  });
  fogli.set(href, p);
  return p;
}

/**
 * Pagina per una funzione non ancora costruita. Usa `scheda.progetto`:
 *   { obiettivo, cosaFara: [..], servira: [..], sezioni: { idSezione: { cosaFara: [..] } } }
 */
export function montaInCostruzione(el, ctx) {
  const p = ctx.strumento.progetto || {};
  const sp = (p.sezioni && p.sezioni[ctx.sezione]) || {};
  const lista = arr => arr && arr.length ? `<ul class="ic-lista">${arr.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul>` : '';
  el.innerHTML = `
    <style>
      .ic { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); align-items: start; }
      .ic-lista { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
      .ic-cantiere { background: repeating-linear-gradient(135deg, var(--warn-soft) 0 12px, transparent 12px 24px); border: 1px dashed var(--warn); border-radius: 8px; padding: 14px 16px; display: grid; gap: 6px; grid-column: 1 / -1; }
      .ic-cantiere strong { color: var(--warn); }
    </style>
    <div class="ic">
      <div class="ic-cantiere"><strong>Funzione in costruzione</strong><span>${escHtml(p.obiettivo || ctx.strumento.descrizione)}</span></div>
      <div class="card"><h3>Cosa farà${sp.cosaFara ? ' questa sezione' : ''}</h3>${lista(sp.cosaFara || p.cosaFara)}</div>
      ${p.servira && p.servira.length ? `<div class="card"><h3>Cosa serve per costruirla</h3>${lista(p.servira)}</div>` : ''}
    </div>`;
}
