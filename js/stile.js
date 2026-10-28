// Stile dell'interfaccia: «vetro» (superfici traslucide e sfocate, css/vetro.css) oppure «classico».
// La scelta resta salvata nel browser; lo script in testa a index.html la applica prima che la pagina si disegni.
import { riduciMovimento } from './movimento.js';

const CHIAVE = 'cs-stile';
const ICONA = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="2.8" y="2.8" width="10" height="10" rx="3"/><rect x="7.2" y="7.2" width="10" height="10" rx="3" fill="currentColor" fill-opacity=".22"/></svg>';

export const stileAttuale = () => document.documentElement.dataset.stile === 'classico' ? 'classico' : 'vetro';

/** Il bottone in testata che passa da vetro a classico e viceversa, con una dissolvenza. */
export function montaInterruttoreStile(btn) {
  if (!btn) return;
  btn.innerHTML = ICONA;
  const aggiorna = () => {
    const vetro = stileAttuale() === 'vetro';
    btn.setAttribute('aria-pressed', String(vetro));
    btn.title = vetro ? 'Stile vetro: clicca per tornare allo stile classico' : 'Stile classico: clicca per lo stile vetro';
  };
  aggiorna();
  btn.addEventListener('click', () => {
    const nuovo = stileAttuale() === 'vetro' ? 'classico' : 'vetro';
    const applica = () => {
      document.documentElement.dataset.stile = nuovo;
      try { localStorage.setItem(CHIAVE, nuovo); } catch { /* il browser non salva: la scelta vale finché la pagina resta aperta */ }
      aggiorna();
    };
    if (!document.startViewTransition || riduciMovimento()) return applica();
    delete document.documentElement.dataset.verso;   // nessun nome di passaggio: tutta la pagina si dissolve insieme
    const vt = document.startViewTransition(applica);
    vt.ready.then(() => {
      const o = { duration: 450, easing: 'ease-out' };
      document.documentElement.animate({ opacity: [1, 0] }, { ...o, pseudoElement: '::view-transition-old(root)' });
      document.documentElement.animate({ opacity: [0, 1] }, { ...o, pseudoElement: '::view-transition-new(root)' });
    }).catch(() => {});
  });
}
