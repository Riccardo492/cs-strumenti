// Menu circolare: cerchio centrale con le funzioni disposte intorno, e le animazioni
// di passaggio tra il menu e la vista di una funzione.
import { escHtml } from '../lib/formati.js';

export const riduciMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const RAGGIO = 36;      // distanza dei cerchi dal centro, in % del lato
const MOZZO = 20.5;     // raggio del cerchio centrale (+ un filo di margine)
const NODO = 9.5;       // raggio dei cerchi delle funzioni (+ margine)

let anello = null, elenco = [];

/** Disegna il menu nel contenitore. `scegli(id, rettangoloCerchio)` viene chiamata al clic. */
export function disegnaMenu(el, strumenti, { scegli }) {
  elenco = strumenti;
  const n = strumenti.length;
  const pos = strumenti.map((s, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    return { a, x: 50 + RAGGIO * Math.cos(a), y: 50 + RAGGIO * Math.sin(a) };
  });
  const pronte = strumenti.filter(s => s.stato === 'pronto').length;
  const tocco = window.matchMedia('(hover: none)').matches;
  const testoBase = tocco ? 'Tocca un cerchio per aprire la funzione.' : 'Passa sopra un cerchio per vedere a cosa serve.';
  const f = v => v.toFixed(2);
  el.innerHTML = `
    <div class="anello" id="anello">
      <svg class="orbita" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="orbita-cerchio" cx="50" cy="50" r="${RAGGIO}"/>
        ${pos.map((p, i) => `<line class="raggio" data-id="${strumenti[i].id}" style="--h:${strumenti[i].tinta}"
          x1="${f(50 + MOZZO * Math.cos(p.a))}" y1="${f(50 + MOZZO * Math.sin(p.a))}"
          x2="${f(50 + (RAGGIO - NODO) * Math.cos(p.a))}" y2="${f(50 + (RAGGIO - NODO) * Math.sin(p.a))}"/>`).join('')}
      </svg>
      <div class="mozzo" id="mozzo">
        <span class="mozzo-sopra">CS Strumenti</span>
        <strong class="mozzo-titolo" id="mozzo-titolo">Scegli una funzione</strong>
        <span class="mozzo-testo" id="mozzo-testo">${testoBase}</span>
      </div>
      ${strumenti.map((s, i) => `
        <button class="nodo" type="button" data-id="${s.id}" data-stato="${escHtml(s.stato)}" style="--x:${f(pos[i].x)};--y:${f(pos[i].y)};--h:${s.tinta}">
          <span class="nodo-cerchio">${s.icona}</span>
          <span class="nodo-nome">${escHtml(s.nome)}</span>
          ${s.stato !== 'pronto' ? `<span class="nodo-stato">${escHtml(s.stato)}</span>` : ''}
        </button>`).join('')}
    </div>
    <p class="menu-nota">${n} funzioni, ${pronte} ${pronte === 1 ? 'pronta' : 'pronte'}. Scegline una: si apre il suo sottomenu e, quando serve, l'assistente ti guida passo passo.</p>`;

  anello = el.querySelector('#anello');
  const titolo = el.querySelector('#mozzo-titolo'), testo = el.querySelector('#mozzo-testo');
  const nodi = [...el.querySelectorAll('.nodo')];
  const evidenzia = id => {
    const s = strumenti.find(x => x.id === id);
    if (s) { anello.dataset.attivo = id; titolo.textContent = s.nome; testo.textContent = s.descrizione; }
    else { delete anello.dataset.attivo; titolo.textContent = 'Scegli una funzione'; testo.textContent = testoBase; }
    anello.querySelectorAll('.raggio').forEach(r => r.classList.toggle('on', r.dataset.id === id));
  };
  nodi.forEach((b, i) => {
    b.addEventListener('pointerenter', () => evidenzia(b.dataset.id));
    b.addEventListener('pointerleave', () => { if (document.activeElement !== b) evidenzia(null); });
    b.addEventListener('focus', () => evidenzia(b.dataset.id));
    b.addEventListener('blur', () => evidenzia(null));
    b.addEventListener('click', () => scegli(b.dataset.id, b.querySelector('.nodo-cerchio').getBoundingClientRect()));
    b.addEventListener('keydown', e => {
      const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!passo) return;
      e.preventDefault(); nodi[(i + passo + nodi.length) % nodi.length].focus();
    });
  });
}

/** Rettangolo a schermo del cerchio di una funzione nel menu. */
export const rettangoloNodo = id => anello?.querySelector(`.nodo[data-id="${id}"] .nodo-cerchio`)?.getBoundingClientRect();

/** Il menu si chiude verso il centro, tranne la funzione scelta (che poi vola via). */
export async function chiudiMenu(sceltoId) {
  if (!anello || riduciMovimento()) return;
  const r = anello.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const anims = [];
  anello.querySelectorAll('.nodo').forEach(n => {
    if (n.dataset.id === sceltoId) { n.querySelector('.nodo-cerchio').style.visibility = 'hidden'; anims.push(n.querySelector('.nodo-nome').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })); return; }
    const b = n.getBoundingClientRect();
    anims.push(n.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${(cx - b.left - b.width / 2) * .55}px, ${(cy - b.top - b.height / 2) * .55}px) scale(.5)`, opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }));
  });
  anims.push(anello.querySelector('.mozzo').animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: .85 }], { duration: 220, fill: 'forwards' }));
  anims.push(anello.querySelector('.orbita').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
  await Promise.allSettled(anims.map(a => a.finished));
}

/** Ripristina il menu (dopo chiudiMenu) e, se richiesto, lo fa riaprire dal centro. */
export function riapriMenu({ anima = true, tranne = null } = {}) {
  if (!anello) return;
  anello.getAnimations({ subtree: true }).forEach(a => a.cancel());
  anello.querySelectorAll('.nodo-cerchio').forEach(c => { c.style.visibility = ''; });
  if (!anima || riduciMovimento()) return;
  const r = anello.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  anello.querySelectorAll('.nodo').forEach((n, i) => {
    if (n.dataset.id === tranne) { n.querySelector('.nodo-nome').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 300, fill: 'backwards' }); return; }
    const b = n.getBoundingClientRect();
    n.animate([{ transform: `translate(${cx - b.left - b.width / 2}px, ${cy - b.top - b.height / 2}px) scale(.3)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 420, delay: 60 + i * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
  anello.querySelector('.mozzo').animate([{ opacity: 0, scale: .85 }, { opacity: 1, scale: 1 }], { duration: 300, easing: 'ease-out' });
  anello.querySelector('.orbita').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 120, fill: 'backwards' });
}

/** Fa volare una copia del cerchio da `daRect` fino all'elemento `aEl`. */
export async function vola(daRect, aEl, strumento) {
  if (!daRect || !aEl || riduciMovimento()) return;
  const aRect = aEl.getBoundingClientRect();
  if (!aRect.width || !daRect.width) return;
  const f = document.createElement('div');
  f.className = 'volante'; f.style.setProperty('--h', strumento.tinta); f.innerHTML = strumento.icona;
  Object.assign(f.style, { left: daRect.left + 'px', top: daRect.top + 'px', width: daRect.width + 'px', height: daRect.height + 'px' });
  document.body.appendChild(f);
  aEl.style.visibility = 'hidden';
  const s = aRect.width / daRect.width;
  const anim = f.animate([
    { transform: 'translate(0px, 0px) scale(1)' },
    { transform: `translate(${aRect.left - daRect.left}px, ${aRect.top - daRect.top}px) scale(${s})` },
  ], { duration: 520, easing: 'cubic-bezier(.2,.75,.15,1)', fill: 'forwards' });
  try { await anim.finished; } catch (e) { /* animazione interrotta */ }
  aEl.style.visibility = ''; f.remove();
}

/** Le voci del sottomenu scendono una dopo l'altra, e la linea della cascata si allunga dall'alto. */
export function cascata(elementi, ritardo = 140, linea = null) {
  if (riduciMovimento()) return;
  if (linea) linea.animate([{ clipPath: 'inset(0 0 100% -24px)' }, { clipPath: 'inset(0 0 0% -24px)' }], { duration: 460, delay: ritardo - 40, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' });
  [...elementi].forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }],
    { duration: 300, delay: ritardo + i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}
