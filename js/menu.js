// Menu circolare: cerchio centrale con le funzioni disposte intorno, e le animazioni
// di passaggio tra il menu e la vista di una funzione.
// Il menu «vive»: i cerchi fluttuano e si lasciano attirare dal puntatore, l'anello si inclina,
// il centro saluta e, se nessuno lo tocca per un po', presenta da solo le funzioni una alla volta.
import { escHtml } from '../lib/formati.js';
import { riduciMovimento } from './movimento.js';
export { riduciMovimento };

const RAGGIO = 36;      // distanza dei cerchi dal centro, in % del lato
const MOZZO = 20.5;     // raggio del cerchio centrale (+ un filo di margine)
const NODO = 9.5;       // raggio dei cerchi delle funzioni (+ margine)
const ATTESA_GIRO = 8000, PASSO_GIRO = 3400;

let anello = null, vista = null, elenco = [], cerchi = [];
let azzeraInclinazione = () => {};

const LOGO = '<span class="logo-cs" role="img" aria-label="C&amp;S Consulenza e Selezione"></span>';
const saluto = () => { const h = new Date().getHours(); return h >= 5 && h < 13 ? 'Buongiorno' : h >= 13 && h < 18 ? 'Buon pomeriggio' : 'Buonasera'; };

/**
 * Disegna il menu nel contenitore.
 * `scegli(id, rettangoloCerchio)` viene chiamata al clic; `evidenziata(id | null)` quando cambia la funzione in primo piano.
 */
export function disegnaMenu(el, strumenti, { scegli, evidenziata = () => {} }) {
  vista = el; elenco = strumenti;
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
        <circle class="orbita-esterna" cx="50" cy="50" r="47"/>
        <circle class="orbita-cerchio" cx="50" cy="50" r="${RAGGIO}"/>
        ${pos.map((p, i) => `<line class="raggio" data-id="${strumenti[i].id}" style="--h:${strumenti[i].tinta}"
          x1="${f(50 + MOZZO * Math.cos(p.a))}" y1="${f(50 + MOZZO * Math.sin(p.a))}"
          x2="${f(50 + (RAGGIO - NODO) * Math.cos(p.a))}" y2="${f(50 + (RAGGIO - NODO) * Math.sin(p.a))}"/>`).join('')}
      </svg>
      <div class="mozzo" id="mozzo">
        <span class="mozzo-icona" id="mozzo-icona">${LOGO}</span>
        <span class="mozzo-sopra" id="mozzo-saluto">${saluto()}</span>
        <strong class="mozzo-titolo" id="mozzo-titolo">Scegli una funzione</strong>
        <span class="mozzo-testo" id="mozzo-testo">${testoBase}</span>
      </div>
      ${strumenti.map((s, i) => `
        <button class="nodo" type="button" data-id="${s.id}" data-stato="${escHtml(s.stato)}" style="--x:${f(pos[i].x)};--y:${f(pos[i].y)};--h:${s.tinta};--i:${i}">
          <span class="nodo-galleggia"><span class="nodo-cerchio">${s.icona}</span></span>
          <span class="nodo-nome">${escHtml(s.nome)}</span>
          ${s.stato !== 'pronto' ? `<span class="nodo-stato">${escHtml(s.stato)}</span>` : ''}
        </button>`).join('')}
    </div>
    <p class="menu-nota">${n} funzioni, ${pronte} ${pronte === 1 ? 'pronta' : 'pronte'}. Scegline una: si apre il suo sottomenu e, quando serve, l'assistente ti guida passo passo.</p>`;

  anello = el.querySelector('#anello');
  const titolo = el.querySelector('#mozzo-titolo'), testo = el.querySelector('#mozzo-testo'), icona = el.querySelector('#mozzo-icona');
  // al centro il logo; quando una funzione è in primo piano diventa la sua icona
  const mostraIcona = s => {
    icona.classList.toggle('di-funzione', !!s);
    if (s) icona.style.setProperty('--h', s.tinta); else icona.style.removeProperty('--h');
    icona.innerHTML = s ? s.icona : LOGO;
    if (!riduciMovimento()) icona.animate([{ opacity: 0, transform: 'scale(.55) rotate(-30deg)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.25,1.4,.5,1)' });
  };
  const nodi = [...el.querySelectorAll('.nodo')];
  cerchi = nodi.map(b => b.querySelector('.nodo-cerchio'));
  setInterval(() => { el.querySelector('#mozzo-saluto').textContent = saluto(); }, 60000);

  const cambia = (nodo, t) => {
    if (nodo.textContent === t) return;
    nodo.textContent = t;
    if (!riduciMovimento()) nodo.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
  };
  let attivo = null;
  const evidenzia = id => {
    if (id === attivo) return;
    attivo = id;
    const s = strumenti.find(x => x.id === id);
    if (s) { anello.dataset.attivo = id; anello.style.setProperty('--ha', s.tinta); cambia(titolo, s.nome); cambia(testo, s.descrizione); }
    else { delete anello.dataset.attivo; cambia(titolo, 'Scegli una funzione'); cambia(testo, testoBase); }
    mostraIcona(s);
    anello.querySelectorAll('.raggio').forEach(r => r.classList.toggle('on', r.dataset.id === id));
    nodi.forEach(b => b.classList.toggle('in-luce', b.dataset.id === id));
    evidenziata(id);
  };

  /* --- giro automatico quando nessuno tocca il menu --- */
  let attesa = 0, giro = 0, indice = -1, automatico = false;
  const fermaGiro = () => {
    clearInterval(giro); giro = 0;
    if (automatico) {
      automatico = false; delete anello.dataset.auto;
      const sopra = nodi.find(b => b.matches(':hover') || b === document.activeElement);
      evidenzia(sopra ? sopra.dataset.id : null);
    }
  };
  const passoGiro = () => {
    if (el.hidden || document.hidden) return;
    indice = (indice + 1) % nodi.length;
    evidenzia(nodi[indice].dataset.id);
  };
  const riposo = () => {
    clearTimeout(attesa); fermaGiro();
    if (riduciMovimento()) return;
    attesa = setTimeout(() => { if (el.hidden) return riposo(); automatico = true; anello.dataset.auto = ''; passoGiro(); giro = setInterval(passoGiro, PASSO_GIRO); }, ATTESA_GIRO);
  };
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, riposo, { passive: true }));
  riposo();

  /* --- cerchi attirati dal puntatore e anello che si inclina --- */
  let px = null, py = null, raf = 0;
  const applica = () => {
    raf = 0;
    if (px == null || riduciMovimento()) { anello.style.transform = ''; cerchi.forEach(c => { c.style.translate = ''; }); return; }
    const r = anello.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const nx = Math.max(-1, Math.min(1, (px - cx) / (r.width / 2))), ny = Math.max(-1, Math.min(1, (py - cy) / (r.height / 2)));
    anello.style.transform = `perspective(1200px) rotateX(${(-ny * 3.5).toFixed(2)}deg) rotateY(${(nx * 3.5).toFixed(2)}deg)`;
    const portata = r.width * .2;
    cerchi.forEach((c, i) => {
      const bx = r.left + pos[i].x / 100 * r.width, by = r.top + pos[i].y / 100 * r.height;
      const dx = px - bx, dy = py - by, d = Math.hypot(dx, dy);
      c.style.translate = d < portata ? `${(dx * (1 - d / portata) * .3).toFixed(1)}px ${(dy * (1 - d / portata) * .3).toFixed(1)}px` : '';
    });
  };
  el.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(applica); });
  el.addEventListener('pointerleave', () => { px = py = null; if (!raf) raf = requestAnimationFrame(applica); });
  azzeraInclinazione = () => { px = py = null; anello.style.transition = 'none'; applica(); anello.offsetWidth; anello.style.transition = ''; };

  nodi.forEach((b, i) => {
    b.addEventListener('pointerenter', () => { fermaGiro(); evidenzia(b.dataset.id); });
    b.addEventListener('pointerleave', () => { if (document.activeElement !== b) evidenzia(null); });
    b.addEventListener('focus', () => evidenzia(b.dataset.id));
    b.addEventListener('blur', () => evidenzia(null));
    b.addEventListener('click', () => scegli(b.dataset.id, cerchi[i].getBoundingClientRect()));
    b.addEventListener('keydown', e => {
      const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!passo) return;
      e.preventDefault(); nodi[(i + passo + nodi.length) % nodi.length].focus();
    });
  });
}

/** Geometria a schermo del menu, per il campo animato sullo sfondo (null se il menu non è visibile). */
export function geometriaMenu() {
  if (!anello || !vista || vista.hidden) return null;
  const r = anello.getBoundingClientRect();
  if (!r.width) return null;
  return {
    cx: r.left + r.width / 2, cy: r.top + r.height / 2, rMozzo: r.width * .205, rOrbita: r.width * RAGGIO / 100,
    nodi: elenco.map((s, i) => {
      const b = cerchi[i].getBoundingClientRect();
      return { id: s.id, h: s.tinta, x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 + 2 };
    }),
  };
}

/** Rettangolo a schermo del cerchio di una funzione nel menu. */
export const rettangoloNodo = id => anello?.querySelector(`.nodo[data-id="${id}"] .nodo-cerchio`)?.getBoundingClientRect();

/** Il menu si chiude verso il centro, tranne la funzione scelta (che poi vola via). */
export async function chiudiMenu(sceltoId) {
  if (!anello || riduciMovimento()) return;
  azzeraInclinazione();
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
  anello.getAnimations({ subtree: true }).forEach(a => { if (!(a instanceof CSSAnimation)) a.cancel(); });
  anello.querySelectorAll('.nodo-cerchio').forEach(c => { c.style.visibility = ''; c.style.translate = ''; });
  if (!anima || riduciMovimento()) return;
  const r = anello.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  anello.querySelectorAll('.nodo').forEach((n, i) => {
    if (n.dataset.id === tranne) { n.querySelector('.nodo-nome').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 300, fill: 'backwards' }); return; }
    const b = n.getBoundingClientRect();
    n.animate([{ transform: `translate(${cx - b.left - b.width / 2}px, ${cy - b.top - b.height / 2}px) scale(.3)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 520, delay: 60 + i * 55, easing: 'cubic-bezier(.25,1.35,.45,1)', fill: 'backwards' });
  });
  anello.querySelector('.mozzo').animate([{ opacity: 0, scale: .85 }, { opacity: 1, scale: 1 }], { duration: 380, easing: 'cubic-bezier(.25,1.3,.5,1)' });
  anello.querySelector('.orbita').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 120, fill: 'backwards' });
}

/** Fa volare una copia del cerchio da `daRect` fino all'elemento `aEl`, con un arco e un piccolo rimbalzo. */
export async function vola(daRect, aEl, strumento) {
  if (!daRect || !aEl || riduciMovimento()) return;
  const aRect = aEl.getBoundingClientRect();
  if (!aRect.width || !daRect.width) return;
  const f = document.createElement('div');
  f.className = 'volante'; f.style.setProperty('--h', strumento.tinta); f.innerHTML = strumento.icona;
  Object.assign(f.style, { left: daRect.left + 'px', top: daRect.top + 'px', width: daRect.width + 'px', height: daRect.height + 'px' });
  document.body.appendChild(f);
  aEl.style.visibility = 'hidden';
  const s = aRect.width / daRect.width, dx = aRect.left - daRect.left, dy = aRect.top - daRect.top;
  const anim = f.animate([
    { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', offset: 0 },
    { transform: `translate(${dx * .45}px, ${dy * .3 - 40}px) scale(${(1 + s) / 2 + .08}) rotate(-8deg)`, offset: .45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s * 1.06}) rotate(0deg)`, offset: .82 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, offset: 1 },
  ], { duration: 640, easing: 'cubic-bezier(.3,.6,.25,1)', fill: 'forwards' });
  try { await anim.finished; } catch (e) { /* animazione interrotta */ }
  aEl.style.visibility = ''; f.remove();
}

/** Le voci del sottomenu scendono una dopo l'altra, e la linea della cascata si allunga dall'alto. */
export function cascata(elementi, ritardo = 140, linea = null) {
  if (riduciMovimento()) return;
  if (linea) linea.animate([{ clipPath: 'inset(0 0 100% -24px)' }, { clipPath: 'inset(0 0 0% -24px)' }], { duration: 460, delay: ritardo - 40, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' });
  [...elementi].forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }],
    { duration: 340, delay: ritardo + i * 75, easing: 'cubic-bezier(.25,1.25,.5,1)', fill: 'backwards' }));
}
