// Sfondo vivo: una mappa topografica che respira.
// - Il terreno è un rumore morbido che cambia forma molto lentamente.
// - Nel menu ogni funzione è un rilievo nel suo colore e il cerchio centrale il rilievo più alto;
//   la funzione indicata si alza, il puntatore solleva una piccola collina.
// - Le curve di livello scivolano piano verso il basso: dai rilievi sembrano partire anelli.
// - Piccole luci scorrono lungo le curve: intorno a ogni rilievo girano in tondo, come satelliti.
// - Un clic su una funzione, sullo sfondo o un cambio di tema manda un'onda che attraversa la mappa.
// - Dietro i testi principali (sottomenu, titoli) le curve si diradano.
// - Aperta una funzione, il rilievo diventa il suo cerchio in alto a sinistra e la mappa prende la sua tinta.
// Colori e intensità sono nei token --campo-* (css/tokens.css). Con «riduci movimento» la mappa resta ferma.
import { riduciMovimento, quandoCambiaMovimento } from './movimento.js';

const TAU = Math.PI * 2;
const PASSO = .12;             // distanza tra due curve di livello
const MAESTRA = 5;             // una curva ogni 5 è più marcata, come sulle carte
const DISCESA = PASSO / 9000;  // le curve scendono di un passo ogni 9 secondi
const FOTOGRAMMA = 1000 / 31;  // lo sfondo si muove piano: 30 fotogrammi al secondo bastano e risparmiano batteria
const FOTOGRAMMA_STRUMENTO = 1000 / 16;  // dentro una funzione lo sfondo si vede poco: ancora meno fotogrammi
const DERIVA = .000013;        // velocità con cui il terreno cambia forma

/* rumore simplex 2D (Gustavson), con permutazione fissa */
function creaRumore(seme = 20240) {
  const base = Array.from({ length: 256 }, (_, i) => i);
  let s = seme;
  const caso = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 255; i > 0; i--) { const j = Math.floor(caso() * (i + 1)); [base[i], base[j]] = [base[j], base[i]]; }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return (x, y) => {
    const t0 = (x + y) * F2, i = Math.floor(x + t0), j = Math.floor(y + t0);
    const t1 = (i + j) * G2, x0 = x - i + t1, y0 = y - j + t1;
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, t, g;
    t = .5 - x0 * x0 - y0 * y0; if (t > 0) { g = p[ii + p[jj]] & 7; t *= t; n += t * t * (GX[g] * x0 + GY[g] * y0); }
    t = .5 - x1 * x1 - y1 * y1; if (t > 0) { g = p[ii + i1 + p[jj + j1]] & 7; t *= t; n += t * t * (GX[g] * x1 + GY[g] * y1); }
    t = .5 - x2 * x2 - y2 * y2; if (t > 0) { g = p[ii + 1 + p[jj + 1]] & 7; t *= t; n += t * t * (GX[g] * x2 + GY[g] * y2); }
    return 70 * n;
  };
}

function hslRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function creaCampo(canvas, { tinte }) {
  const ctx = canvas.getContext('2d');
  const rumore = creaRumore();
  let W = 0, H = 0, dpr = 1, raf = 0, ultimo = 0, tempo = 0;
  let cella = 14, cols = 0, rows = 0, x0 = 0, y0 = 0, val = null;
  let terreno = null, tctx = null, pixel = null;
  let segN = new Float32Array(1 << 15), segM = new Float32Array(1 << 13), nN = 0, nM = 0;
  let modo = 'menu', attivo = null, geometria = null, fuoco = null, tintaStrumento = tinte[0];
  let forza = 1, col = {}, lut = null, firmaLut = '';
  let impulsi = [], scintille = [], onde = [];
  let mediaMs = 6, contaFrame = 0;
  const pt = { x: -9999, y: -9999, sx: -9999, sy: -9999, dentro: false, a: 0 };
  const rilievi = new Map();   // id → { x, y, s, a, meta, h }
  const centro = { x: 0, y: 0, s: 1, a: 0, meta: 0 };

  /* ---------- colori dai token ---------- */
  function leggiColori() {
    const cs = getComputedStyle(document.documentElement);
    const n = (v, d) => { const x = parseFloat(cs.getPropertyValue(v)); return Number.isFinite(x) ? x : d; };
    col = {
      s: n('--campo-s', 42), l: n('--campo-l', 36), linea: n('--campo-linea', .17), maestra: n('--campo-maestra', .3),
      rs: n('--campo-rilievo-s', 62), rl: n('--campo-rilievo-l', 62), rilievo: n('--campo-rilievo', .13), viandante: n('--campo-viandante', .5), vs: n('--campo-viandante-s', 60), vl: n('--campo-viandante-l', 46),
      sat: n('--tinta-s', 46), ink: n('--tinta-ink-l', 32),
    };
    firmaLut = '';
    if (riduciMovimento()) richiediFermo();
  }

  /* ---------- dimensioni e griglia ---------- */
  function preparaGriglia() {
    cols = Math.ceil(W / cella) + 3; rows = Math.ceil(H / cella) + 3;
    x0 = -cella; y0 = -cella;
    val = new Float32Array(cols * rows);
    terreno = terreno || document.createElement('canvas');
    terreno.width = cols; terreno.height = rows;
    tctx = terreno.getContext('2d');
    pixel = tctx.createImageData(cols, rows);
  }
  function dimensiona() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cella = W * H > 2.2e6 ? 14 : W < 700 ? 11 : 12;
    preparaGriglia();
    if (riduciMovimento()) richiediFermo();
  }

  /* ---------- rilievi: funzioni del menu, centro, funzione aperta ---------- */
  function aggiornaRilievi(dt, fermo) {
    const g = modo === 'menu' && geometria ? geometria() : null;
    const segui = fermo ? 1 : 1 - Math.exp(-dt / 260);
    if (g) {
      centro.x = g.cx; centro.y = g.cy; centro.s = g.rMozzo * .95; centro.meta = .78;
      for (const n of g.nodi) {
        let r = rilievi.get(n.id);
        if (!r) { r = { a: 0 }; rilievi.set(n.id, r); }
        r.x = n.x; r.y = n.y; r.s = n.r * 1.3; r.h = n.h; r.meta = n.id === attivo ? 1.05 : .58;
      }
    } else {
      centro.meta = 0;
      for (const r of rilievi.values()) r.meta = 0;
    }
    if (modo === 'strumento' && fuoco) {
      const f = fuoco();
      let r = rilievi.get('·fuoco');
      if (!r) { r = { a: 0 }; rilievi.set('·fuoco', r); }
      if (f) { r.x = f.x; r.y = f.y; r.s = f.r * 1.9; r.meta = .95; } else r.meta = 0;
    } else if (rilievi.has('·fuoco')) rilievi.get('·fuoco').meta = 0;
    centro.a += (centro.meta - centro.a) * segui;
    for (const r of rilievi.values()) r.a += (r.meta - r.a) * segui;
    // il puntatore: una collina che lo segue con un po' di ritardo
    if (!fermo) {
      const k = 1 - Math.exp(-dt / 90);
      if (pt.sx < -9000) { pt.sx = pt.x; pt.sy = pt.y; }
      pt.sx += (pt.x - pt.sx) * k; pt.sy += (pt.y - pt.sy) * k;
      pt.a += ((pt.dentro ? .46 : 0) - pt.a) * (1 - Math.exp(-dt / 400));
    } else pt.a = 0;
    forza += ((modo === 'menu' ? 1 : .72) - forza) * segui;
  }

  /* ---------- il terreno ---------- */
  function calcola() {
    const fx = [], fy = [], fa = [], fk = [], fc = [];
    const aggiungi = (x, y, s, a) => { if (a < .005) return; fx.push(x); fy.push(y); fa.push(a); fk.push(1 / (2 * s * s)); fc.push(9 * s * s); };
    aggiungi(centro.x, centro.y, centro.s, centro.a);
    for (const r of rilievi.values()) aggiungi(r.x, r.y, r.s, r.a);
    aggiungi(pt.sx, pt.sy, 95, pt.a);
    const nR = fx.length;
    const ox1 = tempo * DERIVA * .8, oy1 = -tempo * DERIVA * .5, ox2 = -tempo * DERIVA * 1.1 + 40.3, oy2 = tempo * DERIVA * .7 + 17.9;
    const f1 = 1 / 600, f2 = 1 / 290;
    let k = 0;
    for (let j = 0; j < rows; j++) {
      const y = y0 + j * cella;
      for (let i = 0; i < cols; i++) {
        const x = x0 + i * cella;
        let v = .66 * rumore(x * f1 + ox1, y * f1 + oy1) + .2 * rumore(x * f2 + ox2, y * f2 + oy2);
        for (let r = 0; r < nR; r++) {
          const dx = x - fx[r], dy = y - fy[r], d2 = dx * dx + dy * dy;
          if (d2 < fc[r]) v += fa[r] * Math.exp(-d2 * fk[r]);
        }
        for (let o = 0; o < onde.length; o++) {
          const q = onde[o], dx = x - q.x, dy = y - q.y, d = Math.sqrt(dx * dx + dy * dy) - q.r;
          if (d > -140 && d < 140) v += q.a * Math.exp(-d * d / 3200);
        }
        val[k++] = v;
      }
    }
  }

  /* ---------- colori della mappa: nel menu ogni settore prende il colore della sua funzione ---------- */
  function preparaColori() {
    const nodi = modo === 'menu' ? [...rilievi.entries()].filter(([id, r]) => id !== '·fuoco' && r.h != null && r.a > .05) : [];
    const angoli = nodi.map(([, r]) => ({ ang: (Math.atan2(r.y - centro.y, r.x - centro.x) + TAU) % TAU, h: r.h })).sort((a, b) => a.ang - b.ang);
    const firma = `${modo}|${tintaStrumento}|${col.s}|${col.l}|${col.rl}|${col.vl}|` + angoli.map(a => a.ang.toFixed(2) + a.h).join(',');
    if (firma === firmaLut) return;
    firmaLut = firma;
    const tab = { linea: [], rilievo: [], luce: [] };
    if (angoli.length < 2) {
      const h = angoli[0]?.h ?? tintaStrumento;
      tab.unico = { linea: hslRgb(h, col.s, col.l), rilievo: hslRgb(h, col.rs, col.rl), luce: hslRgb(h, col.vs, col.vl) };
    } else {
      for (let g = 0; g < 360; g++) {
        const a = g / 360 * TAU;
        let i = angoli.findIndex(x => x.ang > a); if (i < 0) i = 0;
        const B = angoli[i], A = angoli[(i - 1 + angoli.length) % angoli.length];
        let span = (B.ang - A.ang + TAU) % TAU || TAU, k = ((a - A.ang + TAU) % TAU) / span;
        k = k * k * (3 - 2 * k);
        const mix = (ca, cb) => ca.map((v, n) => Math.round(v + (cb[n] - v) * k));
        tab.linea.push(mix(hslRgb(A.h, col.s, col.l), hslRgb(B.h, col.s, col.l)));
        tab.rilievo.push(mix(hslRgb(A.h, col.rs, col.rl), hslRgb(B.h, col.rs, col.rl)));
        tab.luce.push(mix(hslRgb(A.h, col.vs, col.vl), hslRgb(B.h, col.vs, col.vl)));
      }
    }
    lut = tab;
  }
  function stileLinee(alfa) {
    if (lut.unico) return rgba(lut.unico.linea, alfa);
    if (!ctx.createConicGradient) return rgba(lut.linea[0], alfa);
    const g = ctx.createConicGradient(0, centro.x, centro.y);
    for (let d = 0; d < 360; d += 15) g.addColorStop(d / 360, rgba(lut.linea[d], alfa));
    g.addColorStop(1, rgba(lut.linea[0], alfa));
    return g;
  }

  /* ---------- rilievi colorati: la griglia diventa una piccola immagine sfumata e ingrandita ---------- */
  function riempi() {
    const d = pixel.data, amax = col.rilievo * forza * 255;
    const unico = lut.unico?.rilievo;
    let k = 0, p = 0;
    for (let j = 0; j < rows; j++) {
      const y = y0 + j * cella;
      for (let i = 0; i < cols; i++, k++, p += 4) {
        const v = val[k];
        let a = (v - .18) / 1.0; a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
        let c = unico;
        if (!c) { const x = x0 + i * cella; const g = Math.floor(((Math.atan2(y - centro.y, x - centro.x) + TAU) % TAU) / TAU * 360) % 360; c = lut.rilievo[g]; }
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = a * amax;
      }
    }
    tctx.putImageData(pixel, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(terreno, x0 - cella / 2, y0 - cella / 2, cols * cella, rows * cella);
  }

  /* ---------- curve di livello (marching squares) ---------- */
  function curve(scarto) {
    nN = 0; nM = 0;
    const c = cella;
    const seg = (ax, ay, bx, by, maestra) => {
      if (maestra) { if (nM + 4 > segM.length) { const n = new Float32Array(segM.length * 2); n.set(segM); segM = n; } segM[nM++] = ax; segM[nM++] = ay; segM[nM++] = bx; segM[nM++] = by; }
      else { if (nN + 4 > segN.length) { const n = new Float32Array(segN.length * 2); n.set(segN); segN = n; } segN[nN++] = ax; segN[nN++] = ay; segN[nN++] = bx; segN[nN++] = by; }
    };
    for (let j = 0; j < rows - 1; j++) {
      const yA = y0 + j * c, yB = yA + c;
      for (let i = 0; i < cols - 1; i++) {
        const k = j * cols + i;
        const a = val[k], b = val[k + 1], d = val[k + cols], e = val[k + cols + 1];   // a ↖  b ↗  e ↘  d ↙
        const mn = Math.min(a, b, d, e), mx = Math.max(a, b, d, e);
        const l0 = Math.ceil((mn - scarto) / PASSO), l1 = Math.floor((mx - scarto) / PASSO);
        if (l1 < l0) continue;
        const xA = x0 + i * c, xB = xA + c;
        for (let l = l0; l <= l1; l++) {
          const L = l * PASSO + scarto, m = ((l % MAESTRA) + MAESTRA) % MAESTRA === 0;
          const caso = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (e > L ? 2 : 0) | (d > L ? 1 : 0);
          if (caso === 0 || caso === 15) continue;
          const sopraX = xA + c * (L - a) / (b - a), destraY = yA + c * (L - b) / (e - b);
          const sottoX = xA + c * (L - d) / (e - d), sinistraY = yA + c * (L - a) / (d - a);
          switch (caso) {
            case 1: case 14: seg(xA, sinistraY, sottoX, yB, m); break;
            case 2: case 13: seg(sottoX, yB, xB, destraY, m); break;
            case 3: case 12: seg(xA, sinistraY, xB, destraY, m); break;
            case 4: case 11: seg(sopraX, yA, xB, destraY, m); break;
            case 6: case 9: seg(sopraX, yA, sottoX, yB, m); break;
            case 7: case 8: seg(sopraX, yA, xA, sinistraY, m); break;
            case 5: case 10: {
              const centroAlto = (a + b + d + e) / 4 > L;
              if ((caso === 5) === centroAlto) { seg(sopraX, yA, xA, sinistraY, m); seg(sottoX, yB, xB, destraY, m); }
              else { seg(sopraX, yA, xB, destraY, m); seg(xA, sinistraY, sottoX, yB, m); }
            }
          }
        }
      }
    }
  }
  function tracciaSegmenti(buf, n, stile, spessore) {
    if (!n) return;
    ctx.strokeStyle = stile; ctx.lineWidth = spessore; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i += 4) { ctx.moveTo(buf[i], buf[i + 1]); ctx.lineTo(buf[i + 2], buf[i + 3]); }
    ctx.stroke();
  }

  /* ---------- viandanti: piccole luci che scorrono lungo le curve di livello (intorno ai rilievi girano in tondo) ---------- */
  let viandanti = [];
  const nuovoViandante = () => ({ x: Math.random() * W, y: Math.random() * H, t: 0, vita: 5000 + Math.random() * 6000, verso: Math.random() < .5 ? 1 : -1, scia: [] });
  function pendenza(x, y) {
    const fx = (x - x0) / cella, fy = (y - y0) / cella, i = Math.floor(fx), j = Math.floor(fy);
    if (i < 1 || j < 1 || i >= cols - 2 || j >= rows - 2) return null;
    const u = fx - i, v = fy - j;
    const gx = k => val[k + 1] - val[k - 1], gy = k => val[k + cols] - val[k - cols];
    const k = j * cols + i, w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v], ks = [k, k + 1, k + cols, k + cols + 1];
    let ax = 0, ay = 0;
    for (let n = 0; n < 4; n++) { ax += gx(ks[n]) * w[n]; ay += gy(ks[n]) * w[n]; }
    return [ax, ay];
  }
  function muoviViandanti(dt) {
    const quanti = Math.round(Math.max(10, Math.min(42, W * H / 34000)));
    while (viandanti.length < quanti) { const v = nuovoViandante(); v.t = Math.random() * v.vita * .7; viandanti.push(v); }
    viandanti.length = quanti;
    for (const v of viandanti) {
      v.t += dt;
      const g = v.t < v.vita ? pendenza(v.x, v.y) : null;
      if (!g) { Object.assign(v, nuovoViandante()); continue; }
      const m = Math.hypot(g[0], g[1]);
      if (m < 1e-4) continue;
      const passo = .042 * dt * v.verso * Math.min(1, m * 40);
      v.x += -g[1] / m * passo; v.y += g[0] / m * passo;
      v.scia.push(v.x, v.y); if (v.scia.length > 72) v.scia.splice(0, 2);
    }
  }
  function disegnaViandanti() {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const v of viandanti) {
      const s = v.scia; if (s.length < 6) continue;
      const vita = Math.sin(Math.PI * Math.min(1, v.t / v.vita)), a = col.viandante * vita * forza;
      if (a < .02) continue;
      let c = lut.unico?.luce;
      if (!c) c = lut.luce[Math.floor(((Math.atan2(v.y - centro.y, v.x - centro.x) + TAU) % TAU) / TAU * 360) % 360];
      const n = s.length, gr = ctx.createLinearGradient(s[0], s[1], s[n - 2], s[n - 1]);
      gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(.7, rgba(c, a * .55)); gr.addColorStop(1, rgba(c, a));
      ctx.strokeStyle = gr; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s[0], s[1]); for (let i = 2; i < n; i += 2) ctx.lineTo(s[i], s[i + 1]); ctx.stroke();
    }
  }

  /* ---------- radure: dietro i testi principali le curve si diradano, così si legge meglio ---------- */
  const RADURE = '.menu-nota, .lat-nome, .laterale .sottomenu, .laterale .siti, .laterale .lat-azioni, .sez-testa';
  function radure() {
    const els = document.querySelectorAll(RADURE);
    if (!els.length) return;
    const lontano = 30000;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 24 * dpr; ctx.shadowOffsetX = lontano * dpr;
    ctx.beginPath();
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < -20 || r.top > H + 20) continue;
      if (ctx.roundRect) ctx.roundRect(r.left - 10 - lontano, r.top - 6, r.width + 20, r.height + 12, 16);
      else ctx.rect(r.left - 10 - lontano, r.top - 6, r.width + 20, r.height + 12);
    }
    ctx.fill();
    ctx.restore();
  }

  /* ---------- un fotogramma ---------- */
  function disegna(dt, fermo = false) {
    const t0 = performance.now();
    aggiornaRilievi(dt, fermo);
    onde = onde.filter(q => { q.t += dt; q.r = q.t * .5; q.a = q.a0 * Math.pow(1 - q.t / q.dur, 1.6); return q.t < q.dur; });
    calcola();
    preparaColori();
    ctx.clearRect(0, 0, W, H);
    riempi();
    curve(-tempo * DISCESA % (PASSO * MAESTRA));
    tracciaSegmenti(segN, nN, stileLinee(col.linea * forza), 1);
    tracciaSegmenti(segM, nM, stileLinee(col.maestra * forza), 1.6);
    if (!fermo) { muoviViandanti(dt); disegnaViandanti(); }
    radure();
    if (!fermo) dettagliMenu(dt);
    // la risoluzione si adatta al computer: se un fotogramma costa troppo la griglia si allarga
    if (!fermo) {
      mediaMs = mediaMs * .95 + (performance.now() - t0) * .05;
      if (++contaFrame % 90 === 0) {
        if (mediaMs > 9 && cella < 24) { cella += 2; preparaGriglia(); }
        else if (mediaMs < 3.5 && cella > (W < 700 ? 11 : 12)) { cella -= 2; preparaGriglia(); }
      }
    }
  }

  /* ---------- nel menu: satelliti sull'orbita, impulsi lungo i raggi; scintille al clic ---------- */
  function dettagliMenu(dt) {
    const g = modo === 'menu' && geometria ? geometria() : null;
    const tinta = (h, a) => `hsla(${h}, ${col.sat}%, ${col.ink}%, ${a})`;
    if (g) {
      const t = tempo / 1000;
      for (let k = 0; k < 3; k++) {
        const ang = t * (k % 2 ? -.11 : .16) + k * 2.1;
        ctx.fillStyle = tinta(g.nodi[k % g.nodi.length].h, .7);
        ctx.beginPath(); ctx.arc(g.cx + Math.cos(ang) * g.rOrbita, g.cy + Math.sin(ang) * g.rOrbita, k === 0 ? 3 : 2.2, 0, TAU); ctx.fill();
      }
      for (const n of g.nodi) {
        const freq = n.id === attivo ? 650 : 2800 * g.nodi.length;
        if (Math.random() < dt / freq) impulsi.push({ id: n.id, t: 0, dur: 900 + Math.random() * 500 });
      }
      impulsi = impulsi.filter(q => (q.t += dt) < q.dur);
      for (const q of impulsi) {
        const n = g.nodi.find(x => x.id === q.id); if (!n) continue;
        const dx = n.x - g.cx, dy = n.y - g.cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const xa = g.cx + ux * g.rMozzo, ya = g.cy + uy * g.rMozzo, xb = n.x - ux * n.r, yb = n.y - uy * n.r;
        const k = q.t / q.dur, e = 1 - Math.pow(1 - k, 1.6);
        const x = xa + (xb - xa) * e, y = ya + (yb - ya) * e, a = Math.sin(k * Math.PI) * (n.id === attivo ? .8 : .5);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 7);
        grad.addColorStop(0, tinta(n.h, a)); grad.addColorStop(.35, tinta(n.h, a * .6)); grad.addColorStop(1, tinta(n.h, 0));
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      }
    }
    scintille = scintille.filter(s => (s.t += dt) < s.dur);
    for (const s of scintille) {
      const k = s.t / s.dur, e = 1 - Math.pow(1 - k, 3);
      ctx.fillStyle = tinta(s.h, 1 - k); ctx.beginPath(); ctx.arc(s.x + s.vx * e, s.y + s.vy * e, 2.4 * (1 - k) + .6, 0, TAU); ctx.fill();
    }
  }

  /* ---------- ciclo ---------- */
  function ciclo(t) {
    raf = requestAnimationFrame(ciclo);
    if (t - ultimo < (modo === 'menu' ? FOTOGRAMMA : FOTOGRAMMA_STRUMENTO) - 4) return;
    const dt = Math.min(64, (t - ultimo) || 32); ultimo = t;
    tempo += dt;
    disegna(dt);
  }
  function avvia() { if (!raf && !riduciMovimento() && !document.hidden) { ultimo = performance.now(); raf = requestAnimationFrame(ciclo); } }
  function ferma() { cancelAnimationFrame(raf); raf = 0; }
  let fermoChiesto = 0;
  function richiediFermo() {
    if (fermoChiesto) return;
    fermoChiesto = requestAnimationFrame(() => { fermoChiesto = 0; if (!raf) disegna(16, true); });
  }

  leggiColori(); dimensiona();
  window.addEventListener('resize', dimensiona);
  window.addEventListener('pointermove', e => { pt.x = e.clientX; pt.y = e.clientY; pt.dentro = e.pointerType !== 'touch'; }, { passive: true });
  document.addEventListener('pointerleave', () => { pt.dentro = false; });
  window.addEventListener('blur', () => { pt.dentro = false; });
  window.addEventListener('pointerout', e => { if (!e.relatedTarget) pt.dentro = false; });
  document.addEventListener('visibilitychange', () => document.hidden ? ferma() : avvia());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', leggiColori);
  new MutationObserver(leggiColori).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-stile'] });
  quandoCambiaMovimento(() => { if (riduciMovimento()) { ferma(); richiediFermo(); } else avvia(); });
  avvia();
  if (riduciMovimento()) richiediFermo();

  return {
    /** 'menu' oppure 'strumento'. Per una funzione aperta: { tinta, fuoco: () => ({ x, y, r }) } (il suo cerchio). */
    modalita(m, { tinta, fuoco: f } = {}) {
      modo = m; impulsi = [];
      if (tinta != null) tintaStrumento = tinta;
      fuoco = m === 'strumento' ? (f || null) : null;
      if (riduciMovimento()) setTimeout(richiediFermo, 30);
    },
    /** Funzione che restituisce { cx, cy, rMozzo, rOrbita, nodi: [{ id, x, y, r, h }] } in coordinate di schermo. */
    geometria(fn) { geometria = fn; if (riduciMovimento()) richiediFermo(); },
    /** Funzione indicata: il suo rilievo si alza e gli impulsi verso di lei si infittiscono. */
    evidenzia(id) { attivo = id; },
    /** Un'onda che parte da un punto e attraversa la mappa. */
    onda(x, y, forzaOnda = .55) {
      if (riduciMovimento()) return;
      onde.push({ x, y, t: 0, r: 0, dur: 2200, a0: forzaOnda, a: forzaOnda });
      if (onde.length > 4) onde.shift();
    },
    /** Esplosione di scintille in un punto (con la sua onda). */
    scintille(x, y, h, n = 14) {
      if (riduciMovimento()) return;
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 26 + Math.random() * 44; scintille.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, h, t: 0, dur: 500 + Math.random() * 300 }); }
      this.onda(x, y);
    },
  };
}
