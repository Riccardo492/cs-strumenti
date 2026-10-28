// Percorso a tappe, sopra le funzioni che si fanno per passi (per esempio Batterie di domande).
// Una linea morbida con una tappa per sezione: il tratto già percorso si colora e un aeroplanino
// scivola lungo la curva fino alla tappa aperta, girandosi con lei.
// Le tappe sono link: si può saltare a una sezione cliccandola.
import { riduciMovimento } from './movimento.js';
import { escHtml } from '../lib/formati.js';

const ONDA = [0, -5, 4, -4, 5, -4, 3];          // piccole variazioni di altezza tra una tappa e l'altra (i punti si spostano in CSS: --onda)
const AEREO = 'M12 0 L-9 -8.5 L-4.5 0 L-9 8.5 Z';

export function creaPercorso(el, { tappe, href }) {
  el.innerHTML = `
    <svg class="pc-svg" aria-hidden="true"><path class="pc-base"/><path class="pc-fatto"/></svg>
    <ol class="pc-tappe" style="--n:${tappe.length}">
      ${tappe.map((t, i) => `<li data-id="${escHtml(t.id)}" style="--onda:${ONDA[i % ONDA.length]}px"><a href="${escHtml(href(t.id))}"><span class="pc-punto" aria-hidden="true"></span><b>${escHtml(t.nome)}</b><small></small></a></li>`).join('')}
    </ol>
    <svg class="pc-svg pc-sopra" aria-hidden="true">
      <g class="pc-nave"><circle class="pc-alone" r="15"/><g class="pc-gira"><path class="pc-aereo" d="${AEREO}"/><path class="pc-piega" d="M-4.5 0 L12 0"/></g></g>
    </svg>`;
  const svgs = el.querySelectorAll('.pc-svg'), base = el.querySelector('.pc-base'), fatto = el.querySelector('.pc-fatto');
  const nave = el.querySelector('.pc-nave'), gira = el.querySelector('.pc-gira');
  let lunghezze = [], totale = 0, ora = 0, attuale = null, anim = 0;

  /** Ricostruisce la curva sui punti delle tappe (anche quando cambia la larghezza). */
  function geometria() {
    const box = el.getBoundingClientRect();
    if (!box.width) return;
    const punti = [...el.querySelectorAll('.pc-punto')].map(p => {
      const r = p.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    });
    svgs.forEach(svg => { svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`); svg.setAttribute('width', box.width); svg.setAttribute('height', box.height); });
    // curva morbida che passa per tutti i punti (Catmull-Rom → Bézier)
    const seg = [];
    for (let i = 0; i < punti.length - 1; i++) {
      const p0 = punti[i - 1] || punti[i], p1 = punti[i], p2 = punti[i + 1], p3 = punti[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      seg.push(`C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`);
    }
    // lunghezza alla tappa i: si misura la curva fino a lì
    lunghezze = punti.map((_, i) => { base.setAttribute('d', `M${punti[0][0]} ${punti[0][1]} ${seg.slice(0, i).join(' ')}`); return i ? base.getTotalLength() : 0; });
    base.setAttribute('d', `M${punti[0][0]} ${punti[0][1]} ${seg.join(' ')}`);
    fatto.setAttribute('d', base.getAttribute('d'));
    totale = base.getTotalLength();
    if (attuale != null) ora = lunghezze[indice(attuale)] ?? ora;
    posa(ora);
  }
  const indice = id => Math.max(0, tappe.findIndex(t => t.id === id));

  /** Mette l'aeroplanino al punto L della curva e colora il tratto percorso. */
  function posa(L) {
    if (!totale) return;
    L = Math.max(0, Math.min(totale, L));
    const p = base.getPointAtLength(L), q = base.getPointAtLength(Math.min(totale, L + 2)), q0 = base.getPointAtLength(Math.max(0, L - 2));
    const ang = Math.atan2(q.y - q0.y, q.x - q0.x) * 180 / Math.PI;
    nave.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    gira.setAttribute('transform', `rotate(${(ang * .6).toFixed(1)})`);
    fatto.setAttribute('stroke-dasharray', `${L.toFixed(1)} ${totale.toFixed(1)}`);
  }

  /** Va alla tappa `id`; `info` = { idTappa: { fatto, nota } }. */
  function vai(id, info = {}, anima = true) {
    el.querySelectorAll('.pc-tappe li').forEach((li, i) => {
      const t = info[li.dataset.id] || {};
      li.classList.toggle('fatto', !!t.fatto);
      li.classList.toggle('qui', li.dataset.id === id);
      li.querySelector('a').toggleAttribute('aria-current', li.dataset.id === id);
      li.querySelector('small').textContent = t.nota || '';
    });
    const cambia = id !== attuale;
    attuale = id;
    if (!lunghezze.length) geometria();
    if (!cambia || !lunghezze.length) return;
    const da = ora, a = lunghezze[indice(id)];
    cancelAnimationFrame(anim);
    if (!anima || riduciMovimento() || Math.abs(a - da) < 1) { ora = a; posa(a); return; }
    const t0 = performance.now(), durata = Math.min(1400, 500 + Math.abs(a - da) * 1.2);
    const passo = t => {
      const k = Math.min(1, (t - t0) / durata), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      ora = da + (a - da) * e; posa(ora);
      if (k < 1 && el.isConnected) anim = requestAnimationFrame(passo);
    };
    anim = requestAnimationFrame(passo);
  }

  const ro = new ResizeObserver(() => geometria());
  ro.observe(el);
  requestAnimationFrame(geometria);
  return { vai };
}
