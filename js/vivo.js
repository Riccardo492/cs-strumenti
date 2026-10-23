// Ciò che rende l'interfaccia «viva»:
// - il campo: particelle che vagano sullo sfondo, si collegano tra loro e reagiscono al puntatore;
//   nel menu anche satelliti sull'orbita e impulsi che partono dal cerchio centrale verso le funzioni;
// - micro-interazioni: onda sui bottoni, luce che segue il puntatore sulle schede;
// - aiuti per animare numeri e comparse.
// Con «riduci movimento» attivo nel sistema il campo resta fermo e gli effetti si spengono.
import { riduciMovimento, quandoCambiaMovimento } from './movimento.js';

/* ====================== campo ====================== */
export function creaCampo(canvas, { tinte }) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, ultimo = 0;
  let particelle = [], impulsi = [], scintille = [];
  let modo = 'menu', attivo = null, geometria = null, col = {};
  const pt = { x: -9999, y: -9999, dentro: false };

  function leggiColori() {
    const cs = getComputedStyle(document.documentElement);
    col = { s: cs.getPropertyValue('--tinta-s').trim() || '58%', l: cs.getPropertyValue('--tinta-ink-l').trim() || '34%', accent: cs.getPropertyValue('--accent').trim() };
  }
  const hsla = (h, a) => `hsla(${h}, ${col.s}, ${col.l}, ${a})`;
  const nuova = () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .03, vy: (Math.random() - .5) * .03, r: .8 + Math.random() * 1.7, h: tinte[Math.floor(Math.random() * tinte.length)] });

  function dimensiona() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.max(18, Math.min(70, W * H / 20000)));
    while (particelle.length < n) particelle.push(nuova());
    particelle.length = n;
    for (const p of particelle) { p.x = Math.min(p.x, W); p.y = Math.min(p.y, H); }
    if (riduciMovimento()) disegna(16, true);
  }

  function muovi(dt) {
    const vmax = .045;
    for (const p of particelle) {
      const dx = p.x - pt.x, dy = p.y - pt.y, d2 = dx * dx + dy * dy;
      if (d2 < 110 * 110 && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / 110) * .00022 * dt; p.vx += dx / d * f; p.vy += dy / d * f; }
      p.vx += (Math.random() - .5) * .0016; p.vy += (Math.random() - .5) * .0016;
      const v = Math.hypot(p.vx, p.vy); if (v > vmax) { p.vx *= vmax / v; p.vy *= vmax / v; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
    }
  }

  function disegna(dt, fermo = false) {
    ctx.clearRect(0, 0, W, H);
    const forza = modo === 'menu' ? 1 : .5;
    // collegamenti tra particelle vicine
    const L = 120;
    for (let i = 0; i < particelle.length; i++) {
      const a = particelle[i];
      for (let j = i + 1; j < particelle.length; j++) {
        const b = particelle[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < L * L) { ctx.strokeStyle = hsla(a.h, (1 - Math.sqrt(d2) / L) * .22 * forza); ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      if (pt.dentro) {
        const dx = a.x - pt.x, dy = a.y - pt.y, d = Math.hypot(dx, dy);
        if (d < 170) { ctx.strokeStyle = hsla(a.h, (1 - d / 170) * .35 * forza); ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pt.x, pt.y); ctx.stroke(); }
      }
    }
    for (const p of particelle) { ctx.fillStyle = hsla(p.h, .55 * forza); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
    if (fermo) return;

    // menu: satelliti sull'orbita e impulsi lungo i raggi
    const g = modo === 'menu' && geometria ? geometria() : null;
    if (g) {
      const t = performance.now() / 1000;
      for (let k = 0; k < 3; k++) {
        const ang = t * (k % 2 ? -.11 : .16) + k * 2.1;
        const x = g.cx + Math.cos(ang) * g.rOrbita, y = g.cy + Math.sin(ang) * g.rOrbita;
        ctx.fillStyle = hsla(g.nodi[k % g.nodi.length].h, .75); ctx.beginPath(); ctx.arc(x, y, k === 0 ? 3 : 2.2, 0, 6.2832); ctx.fill();
      }
      for (const n of g.nodi) {
        const freq = n.id === attivo ? 380 : 2600 * g.nodi.length;
        if (Math.random() < dt / freq) impulsi.push({ id: n.id, t: 0, dur: 900 + Math.random() * 500 });
      }
      impulsi = impulsi.filter(q => (q.t += dt) < q.dur);
      for (const q of impulsi) {
        const n = g.nodi.find(x => x.id === q.id); if (!n) continue;
        const dx = n.x - g.cx, dy = n.y - g.cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const x0 = g.cx + ux * g.rMozzo, y0 = g.cy + uy * g.rMozzo, x1 = n.x - ux * n.r, y1 = n.y - uy * n.r;
        const k = q.t / q.dur, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e;
        const a = Math.sin(k * Math.PI) * (n.id === attivo ? 1 : .7);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 9);
        grad.addColorStop(0, hsla(n.h, a)); grad.addColorStop(1, hsla(n.h, 0));
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.2832); ctx.fill();
      }
    }
    // scintille (al clic su una funzione)
    scintille = scintille.filter(s => (s.t += dt) < s.dur);
    for (const s of scintille) {
      const k = s.t / s.dur, e = 1 - Math.pow(1 - k, 3);
      ctx.fillStyle = hsla(s.h, 1 - k); ctx.beginPath(); ctx.arc(s.x + s.vx * e, s.y + s.vy * e, 2.4 * (1 - k) + .6, 0, 6.2832); ctx.fill();
    }
  }

  function ciclo(t) {
    raf = requestAnimationFrame(ciclo);
    const dt = Math.min(48, (t - ultimo) || 16); ultimo = t;
    muovi(dt); disegna(dt);
  }
  function avvia() { if (!raf && !riduciMovimento() && !document.hidden) { ultimo = performance.now(); raf = requestAnimationFrame(ciclo); } }
  function ferma() { cancelAnimationFrame(raf); raf = 0; }

  leggiColori(); dimensiona();
  window.addEventListener('resize', dimensiona);
  window.addEventListener('pointermove', e => { pt.x = e.clientX; pt.y = e.clientY; pt.dentro = e.pointerType !== 'touch'; }, { passive: true });
  document.addEventListener('pointerleave', () => { pt.dentro = false; pt.x = pt.y = -9999; });
  document.addEventListener('visibilitychange', () => document.hidden ? ferma() : avvia());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', leggiColori);
  new MutationObserver(leggiColori).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  quandoCambiaMovimento(() => { if (riduciMovimento()) { ferma(); disegna(16, true); } else avvia(); });
  avvia();

  return {
    /** 'menu' oppure 'strumento' (nella vista di una funzione il campo si fa più discreto). */
    modalita(m) { modo = m; impulsi = []; },
    /** Funzione che restituisce { cx, cy, rMozzo, rOrbita, nodi: [{ id, x, y, r, h }] } in coordinate di schermo. */
    geometria(fn) { geometria = fn; },
    /** Funzione evidenziata: gli impulsi verso di lei si infittiscono. */
    evidenzia(id) { attivo = id; },
    /** Esplosione di scintille in un punto. */
    scintille(x, y, h, n = 14) {
      if (riduciMovimento()) return;
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.2832, v = 26 + Math.random() * 44; scintille.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, h, t: 0, dur: 500 + Math.random() * 300 }); }
    },
  };
}

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
