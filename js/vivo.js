// Ciò che rende l'interfaccia «viva», oltre allo sfondo (js/campo.js):
// - micro-interazioni: onda sui bottoni, luce che segue il puntatore sulle schede;
// - aiuti per animare numeri e comparse.
// Con «riduci movimento» attivo nel sistema gli effetti si spengono.
import { riduciMovimento } from './movimento.js';

/* ====================== micro-interazioni ====================== */
export function attivaMicroInterazioni() {
  // onda che parte dal punto del clic, sui bottoni
  document.addEventListener('pointerdown', e => {
    if (riduciMovimento()) return;
    const b = e.target.closest('.btn'); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 1.2;
    const o = document.createElement('span'); o.className = 'onda';
    Object.assign(o.style, { width: s + 'px', height: s + 'px', left: (e.clientX - r.left - s / 2) + 'px', top: (e.clientY - r.top - s / 2) + 'px' });
    b.appendChild(o);
    o.animate([{ transform: 'scale(0)', opacity: .32 }, { transform: 'scale(2)', opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => o.remove(), () => o.remove());
  });
  // luce morbida che segue il puntatore sulle schede
  let raf = 0, ev = null, corrente = null;
  document.addEventListener('pointermove', e => {
    ev = e;
    if (raf || riduciMovimento()) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const c = ev.target instanceof Element ? ev.target.closest('.card, .barra, details.ric-mappa') : null;
      if (corrente && corrente !== c) { corrente.style.removeProperty('--gx'); corrente.style.removeProperty('--gy'); }
      corrente = c;
      if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--gx', (ev.clientX - r.left) + 'px'); c.style.setProperty('--gy', (ev.clientY - r.top) + 'px'); }
    });
  }, { passive: true });
}

/* ====================== aiuti ====================== */
/** Fa scorrere un numero da `da` ad `a` (interi, per esempio centesimi), formattandolo a ogni passo. */
export function scorriNumero(el, da, a, formato, durata = 650) {
  if (riduciMovimento() || da === a || da == null) { el.textContent = formato(a); return; }
  const t0 = performance.now();
  const passo = t => {
    const k = Math.min(1, (t - t0) / durata), e = 1 - Math.pow(1 - k, 3);
    el.textContent = formato(Math.round(da + (a - da) * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/** Gli elementi compaiono uno dopo l'altro. */
export function comparsa(elementi, { passo = 35, max = 16, ritardo = 0, distanza = 8 } = {}) {
  if (riduciMovimento()) return;
  [...elementi].slice(0, max).forEach((el, i) => el.animate(
    [{ opacity: 0, transform: `translateY(${distanza}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 320, delay: ritardo + i * passo, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}
