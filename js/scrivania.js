// Scrivania: la pagina iniziale, come una dashboard.
// - saluto (con il nome, se lo si è dato) e una frase che riassume la situazione;
// - quattro schede con il numero del mese che scorre e un mini-grafico;
// - un grafico ad area degli ultimi 12 mesi, con un selettore che lo trasforma da una misura all'altra;
// - «Da fare» (chiesto alle funzioni: promemoria()) e le attività recenti.
// I numeri vengono dal registro delle attività di questo browser (lib/attivita.js);
// finché è vuoto si vedono dati di esempio, segnalati come tali.
import { attivita } from '../lib/attivita.js';
import { escHtml } from '../lib/formati.js';
import { scorriNumero, comparsa } from './vivo.js';
import { riduciMovimento } from './movimento.js';

const NOME = 'cs.nome';
export const nomeUtente = () => { try { return (localStorage.getItem(NOME) || '').trim(); } catch (e) { return ''; } };

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
const numero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });
const fmtE = c => euro.format(Math.round(c / 100));
const fmtN = n => numero.format(Math.round(n));
const GIORNO = 864e5;
const saluto = h => h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
const plur = (n, uno, tanti) => `${fmtN(n)} ${n === 1 ? uno : tanti}`;

const METRICHE = [
  { id: 'ricevute', nome: 'Ricevute', f: 'ricevute', a: 'generate', campo: 'n', formato: fmtN, unita: n => n === 1 ? 'ricevuta' : 'ricevute' },
  { id: 'compensi', nome: 'Compensi netti', breve: 'Compensi', f: 'ricevute', a: 'generate', campo: 'importo', formato: fmtE, unita: () => 'netti' },
  { id: 'pdf', nome: 'PDF rinominati', breve: 'PDF', f: 'rinomina-pdf', a: 'rinominati', campo: 'n', formato: fmtN, unita: n => n === 1 ? 'PDF' : 'PDF' },
  { id: 'domande', nome: 'Domande preparate', breve: 'Domande', f: 'batterie-domande', a: 'generate', campo: 'n', formato: fmtN, unita: n => n === 1 ? 'domanda' : 'domande' },
];

/** Un anno di attività inventata, sempre uguale, per mostrare la Scrivania prima di usarla davvero. */
function esempio() {
  let s = 20261;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const ev = [], oggi = Date.now();
  for (let d = 364; d >= 0; d--) {
    const t = oggi - d * GIORNO - Math.floor(r() * 6) * 36e5;
    if (new Date(t).getDay() === 0) continue;
    const stagione = .55 + .45 * Math.sin(d / 365 * Math.PI * 2 + 1.1);
    if (r() < .34 * stagione) { const n = 2 + Math.floor(r() * 14); ev.push({ f: 'ricevute', a: 'generate', t, n, importo: n * (6000 + Math.floor(r() * 4) * 1500) }); }
    if (r() < .17) ev.push({ f: 'rinomina-pdf', a: 'rinominati', t, n: 8 + Math.floor(r() * 64) });
    if (r() < .06) ev.push({ f: 'batterie-domande', a: 'generate', t, n: 10 + Math.floor(r() * 46) });
  }
  return ev;
}

const somma = (ev, m, da, a) => ev.reduce((t, e) => e.f === m.f && e.a === m.a && e.t >= da && e.t < a ? t + (e[m.campo] || 0) : t, 0);
const inizioMese = (d, delta = 0) => new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime();
const inizioGiorno = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/* ---------- curve ---------- */
/** Curva morbida che non va mai sotto lo zero né oltre i picchi (interpolazione monotona). */
function curva(xs, ys) {
  const n = xs.length;
  if (n < 2) return `M${xs[0] || 0},${ys[0] || 0}`;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = xs[i + 1] - xs[i]; m[i] = (ys[i + 1] - ys[i]) / dx[i]; }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) d += ` C${(xs[i] + dx[i] / 3).toFixed(1)},${(ys[i] + t[i] * dx[i] / 3).toFixed(1)} ${(xs[i + 1] - dx[i] / 3).toFixed(1)},${(ys[i + 1] - t[i + 1] * dx[i] / 3).toFixed(1)} ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(1)}`;
  return d;
}
function passoBello(max) {
  if (max <= 0) return 1;
  const grezzo = max / 3, p = Math.pow(10, Math.floor(Math.log10(grezzo))), f = grezzo / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Mini-grafico di una scheda. */
function scintilla(valori, id) {
  const W = 112, H = 38, max = Math.max(...valori, 1);
  const xs = valori.map((_, i) => 2 + i * (W - 4) / (valori.length - 1)), ys = valori.map(v => H - 4 - v / max * (H - 10));
  const d = curva(xs, ys);
  return `<svg class="sc-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><linearGradient id="sg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${xs[xs.length - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z" fill="url(#sg-${id})"/>
    <path class="sc-spark-linea" d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" pathLength="1"/>
  </svg>`;
}

/* ---------- grafico grande ---------- */
function creaGrafico(box, etichette) {
  box.innerHTML = `<svg class="sc-area" aria-hidden="true">
      <defs><linearGradient id="sc-area-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".32"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      <g class="sc-griglia-y"></g><path class="sc-area-fondo" fill="url(#sc-area-g)"/><path class="sc-area-linea" fill="none"/>
      <line class="sc-guida" y1="0" y2="0" hidden/><circle class="sc-punto" r="5" hidden/><g class="sc-asse-x"></g>
    </svg><div class="sc-suggerimento" hidden></div>`;
  const svg = box.querySelector('svg'), fondo = box.querySelector('.sc-area-fondo'), linea = box.querySelector('.sc-area-linea');
  const griglia = box.querySelector('.sc-griglia-y'), asse = box.querySelector('.sc-asse-x'), guida = box.querySelector('.sc-guida'), punto = box.querySelector('.sc-punto'), sugg = box.querySelector('.sc-suggerimento');
  const P = { l: 52, r: 14, t: 14, b: 30 };
  let W = 0, H = 0, xs = [], ys = null, valori = [], metrica = null, anim = 0;

  function misura() { W = box.clientWidth; H = Math.max(200, Math.min(300, W * .42)); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', H); xs = etichette.map((_, i) => P.l + i * (W - P.l - P.r) / (etichette.length - 1)); }
  function scala(vals) { const passo = passoBello(Math.max(...vals)); const top = Math.max(passo, Math.ceil(Math.max(...vals) / passo) * passo); return { top, passo }; }
  const yDi = (v, top) => H - P.b - v / top * (H - P.t - P.b);
  function assi(sc) {
    griglia.innerHTML = Array.from({ length: Math.round(sc.top / sc.passo) + 1 }, (_, i) => {
      const v = i * sc.passo, y = yDi(v, sc.top);
      return `<line x1="${P.l}" x2="${W - P.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text x="${P.l - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${escHtml(metrica.formato(v))}</text>`;
    }).join('');
    asse.innerHTML = etichette.map((e, i) => `<text x="${xs[i].toFixed(1)}" y="${H - 8}" text-anchor="middle">${escHtml(e)}</text>`).join('');
    if (!riduciMovimento()) griglia.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  }
  function disegna(yy) {
    const d = curva(xs, yy);
    linea.setAttribute('d', d);
    fondo.setAttribute('d', `${d} L${xs[xs.length - 1].toFixed(1)},${H - P.b} L${xs[0].toFixed(1)},${H - P.b} Z`);
  }
  /** Mostra una misura; se ce n'era già una, la curva si trasforma nella nuova. */
  function mostra(vals, m, anima = true) {
    valori = vals; metrica = m;
    const sc = scala(vals);
    const lunga = Math.max(...Array.from({ length: Math.round(sc.top / sc.passo) + 1 }, (_, i) => m.formato(i * sc.passo).length));
    P.l = Math.max(30, 16 + lunga * 6.6);
    misura();
    const nuovi = vals.map(v => yDi(v, sc.top));
    assi(sc);
    const da = ys || vals.map(() => H - P.b);
    cancelAnimationFrame(anim);
    if (!anima || riduciMovimento()) { ys = nuovi; disegna(ys); return; }
    const t0 = performance.now(), durata = 720;
    const passo = t => {
      const k = Math.min(1, (t - t0) / durata), e = 1 - Math.pow(1 - k, 3);
      ys = da.map((y, i) => y + (nuovi[i] - y) * e); disegna(ys);
      if (k < 1 && box.isConnected) anim = requestAnimationFrame(passo);
    };
    anim = requestAnimationFrame(passo);
  }
  // suggerimento al passaggio del puntatore
  svg.addEventListener('pointermove', e => {
    if (!xs.length || !ys) return;
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
    let i = 0; for (let j = 1; j < xs.length; j++) if (Math.abs(xs[j] - x) < Math.abs(xs[i] - x)) i = j;
    guida.hidden = punto.hidden = sugg.hidden = false;
    guida.setAttribute('x1', xs[i]); guida.setAttribute('x2', xs[i]); guida.setAttribute('y1', P.t); guida.setAttribute('y2', H - P.b);
    punto.setAttribute('cx', xs[i]); punto.setAttribute('cy', ys[i]);
    sugg.innerHTML = `<b>${escHtml(metrica.formato(valori[i]))}</b> ${escHtml(metrica.unita(valori[i]))}<small>${escHtml(etichette.lunghe[i])}</small>`;
    const px = xs[i] * (r.width / W);
    sugg.style.left = Math.max(60, Math.min(r.width - 60, px)) + 'px'; sugg.style.top = (ys[i] * (r.height / H) - 12) + 'px';
  });
  svg.addEventListener('pointerleave', () => { guida.hidden = punto.hidden = sugg.hidden = true; });
  return { mostra, ridisegna: () => metrica && mostra(valori, metrica, false) };
}

/* ---------- tempo relativo ---------- */
function quando(t) {
  const d = new Date(t), oggi = inizioGiorno(Date.now()), g = Math.round((oggi - inizioGiorno(t)) / GIORNO);
  const ora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (g <= 0) return `oggi alle ${ora}`;
  if (g === 1) return `ieri alle ${ora}`;
  if (g < 7) return `${g} giorni fa`;
  return `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)}`;
}
function descrivi(e) {
  if (e.f === 'ricevute') return { testo: `${e.n === 1 ? 'Generata 1 ricevuta' : `Generate ${fmtN(e.n)} ricevute`}`, dettaglio: e.importo ? `${fmtE(e.importo)} netti` : '' };
  if (e.f === 'rinomina-pdf') return { testo: `Rinominati ${plur(e.n, 'PDF', 'PDF')}`, dettaglio: '' };
  if (e.f === 'batterie-domande' && e.a === 'stampate') return { testo: 'Stampata una batteria', dettaglio: plur(e.n, 'domanda', 'domande') };
  if (e.f === 'batterie-domande') return { testo: `Preparate ${plur(e.n, 'domanda', 'domande')}`, dettaglio: '' };
  return { testo: `${e.a} · ${e.n}`, dettaglio: '' };
}

/* ====================== montaggio ====================== */
export async function montaScrivania(el, { strumenti, primoGiro }) {
  const reali = attivita();
  const ev = reali.length ? reali : esempio();
  const conEsempio = !reali.length;
  const adesso = new Date(), oggi = inizioGiorno(Date.now());
  const da = inizioMese(adesso), prec = inizioMese(adesso, -1), fine = Date.now() + 1;
  const strumento = id => strumenti.find(s => s.id === id);
  const promemoria = (await Promise.all(strumenti.map(async s => { try { return (await s.promemoria?.() || []).map(p => ({ ...p, s })); } catch (e) { return []; } }))).flat();
  const mese = MESI[adesso.getMonth()];

  // numeri delle schede
  const val = m => somma(ev, m, da, fine);
    const settimane = (m, n = 12) => Array.from({ length: n }, (_, i) => { const g = oggi + GIORNO - (n - i) * 7 * GIORNO; return somma(ev, m, g, g + 7 * GIORNO); });
  const [mRic, mComp, mPdf, mDom] = METRICHE;
  // confronto onesto: i giorni passati di questo mese con gli stessi giorni del mese prima
  const nettiMese = val(mComp), nettiPrec = somma(ev, mComp, prec, Math.min(da, prec + (Date.now() - da)));
  const delta = nettiPrec ? Math.round((nettiMese - nettiPrec) / nettiPrec * 100) : null;
  const archivi = ev.filter(e => e.f === mPdf.f && e.t >= da).length;
  const daRivedere = promemoria.filter(p => p.s.id === 'batterie-domande' && p.livello === 'alto').reduce((t, p) => t + (p.n || 0), 0);
  const schede = [
    { m: mRic, valore: val(mRic), nota: nettiMese ? `${fmtE(nettiMese)} netti` : 'nessuna ancora', serie: settimane(mRic) },
    { m: mComp, valore: nettiMese, nota: delta == null ? (nettiMese ? 'primo mese registrato' : 'nessun compenso ancora') : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}% sugli stessi giorni di ${MESI[(adesso.getMonth() + 11) % 12]}`, su: delta != null && delta >= 0, serie: settimane(mComp) },
    { m: mPdf, valore: val(mPdf), nota: archivi ? `in ${plur(archivi, 'archivio', 'archivi')}` : 'nessuno ancora', serie: settimane(mPdf) },
    { m: mDom, valore: val(mDom), nota: daRivedere ? `${daRivedere} da rivedere` : 'per le batterie di quiz', serie: settimane(mDom) },
  ].filter(c => strumento(c.m.f));
  const iconeUsate = new Set();

  // riassunto in una frase
  const fatto = [];
  if (val(mRic)) fatto.push(plur(val(mRic), 'ricevuta generata', 'ricevute generate'));
  if (val(mPdf)) fatto.push(`${plur(val(mPdf), 'PDF rinominato', 'PDF rinominati')}`);
  if (val(mDom)) fatto.push(plur(val(mDom), 'domanda preparata', 'domande preparate'));
  const urgenti = promemoria.filter(p => p.livello === 'alto');
  const frase = conEsempio
    ? 'Qui trovi i numeri del tuo lavoro: per ora sono di esempio, i tuoi compaiono appena usi una funzione.'
    : [urgenti.length ? urgenti.map(p => `${p.testo.toLowerCase()} in «${p.dettaglio}»`).join(', ') : '',
      fatto.length ? `da inizio ${mese}: ${fatto.length > 1 ? fatto.slice(0, -1).join(', ') + ' e ' + fatto[fatto.length - 1] : fatto[0]}` : `da inizio ${mese} ancora nessuna attività`].filter(Boolean).join(' · ');

  // da fare e recenti
  const recenti = [...ev].sort((a, b) => b.t - a.t).slice(0, 5);
  const inArrivo = strumenti.filter(s => s.stato !== 'pronto');
  const LIV = { alto: ['err', 'da fare'], medio: ['warn', 'in sospeso'], ok: ['ok', 'pronta'] };

  const etichette = Array.from({ length: 12 }, (_, i) => MESI[new Date(inizioMese(adesso, i - 11)).getMonth()].slice(0, 3));
  etichette.lunghe = Array.from({ length: 12 }, (_, i) => { const d = new Date(inizioMese(adesso, i - 11)); return `${MESI[d.getMonth()]} ${d.getFullYear()}`; });
  const perMese = m => Array.from({ length: 12 }, (_, i) => somma(ev, m, inizioMese(adesso, i - 11), inizioMese(adesso, i - 10)));
  const metricheGrafico = METRICHE.filter(m => strumento(m.f));
  let scelta = metricheGrafico[0];

  const nome = nomeUtente();
  const azioni = ['batterie-domande', 'ricevute'].map(strumento).filter(Boolean);
  el.innerHTML = `
    <header class="pagina-testa sc-testa">
      <div class="pt-testo">
        <div class="pt-riga"><span class="pt-funzione">${GIORNI[adesso.getDay()]} ${adesso.getDate()} ${mese}</span></div>
        <h1 class="pt-titolo"><span class="sc-saluto">${saluto(adesso.getHours())}</span><span class="sc-nome">${nome ? ', ' + escHtml(nome) : ''}</span></h1>
        <p class="pt-desc">${escHtml(frase.charAt(0).toUpperCase() + frase.slice(1))}${frase.endsWith('.') ? '' : '.'}</p>
        ${nome ? '' : '<p class="pt-siti"><button class="linkbtn" type="button" id="sc-come-ti-chiami">Dimmi come ti chiami</button></p>'}
      </div>
      <div class="pt-azioni">${azioni.map((s, i) => `<a class="btn${i === azioni.length - 1 ? ' primary' : ''}" href="#${s.id}">${i === azioni.length - 1 ? '<span aria-hidden="true">+</span> ' : ''}${escHtml(s.id === 'ricevute' ? 'Nuove ricevute' : s.nome)}</a>`).join('')}</div>
    </header>
    <div class="sc-corpo">
    ${conEsempio ? '<p class="sc-esempio"><span class="chip info"><span class="dot"></span>Dati di esempio</span><span>I numeri qui sotto sono inventati: i tuoi compaiono appena scarichi ricevute, rinomini PDF o prepari domande, e restano in questo browser.</span></p>' : ''}
    <section class="sc-kpi" aria-label="Il mese in numeri">
      ${schede.map((c, i) => {
        const s = strumento(c.m.f), vt = !iconeUsate.has(s.id);
        iconeUsate.add(s.id);
        return `<a class="sc-scheda" href="#${s.id}" style="--h:${s.tinta}">
          <span class="sc-scheda-testa"><span class="sc-icona${vt ? ' vt-ico' : ''}"${vt ? ` style="--vt: ico-${s.id}"` : ''}>${s.icona}</span><span>${escHtml(c.m.nome)} · ${mese}</span></span>
          <span class="sc-valore" data-i="${i}">${c.m.formato(c.valore)}</span>
          <span class="sc-nota${c.su ? ' su' : ''}" title="${escHtml(c.nota)}">${escHtml(c.nota)}</span>
          ${scintilla(c.serie, i)}
        </a>`;
      }).join('')}
    </section>
    <section class="sc-griglia">
      <div class="sc-pannello sc-grafico">
        <div class="sc-pannello-testa">
          <div><h2>Attività negli ultimi 12 mesi</h2><p>Mese per mese, da ${etichette.lunghe[0]} a oggi</p></div>
          <div class="sc-segmenti" role="tablist" aria-label="Misura">
            <span class="sc-seg-attivo" aria-hidden="true"></span>
            ${metricheGrafico.map(m => `<button type="button" role="tab" class="sc-seg" data-m="${m.id}" aria-selected="${m === scelta}">${escHtml(m.breve || m.nome)}</button>`).join('')}
          </div>
        </div>
        <div class="sc-area-box" id="sc-area" style="--h:${strumento(scelta.f).tinta}"></div>
      </div>
      <div class="sc-pannello sc-dafare" id="sc-dafare">
        <div class="sc-pannello-testa"><div><h2>Da fare</h2><p>${promemoria.length ? plur(promemoria.length, 'cosa in sospeso', 'cose in sospeso') : 'Niente in sospeso'}</p></div></div>
        <ul class="sc-lista">
          ${promemoria.map(p => `<li><a href="${escHtml(p.href)}" style="--h:${p.s.tinta}"><span class="sc-icona">${p.s.icona}</span><span class="sc-voce"><b>${escHtml(p.testo)}</b><small>${escHtml(p.dettaglio || p.s.nome)}</small></span><span class="chip ${LIV[p.livello]?.[0] || 'ghost'}">${LIV[p.livello]?.[1] || ''}</span></a></li>`).join('')
            || '<li class="sc-vuoto">Quando una funzione ha qualcosa in sospeso (per esempio domande da rivedere) compare qui.</li>'}
        </ul>
        <h3 class="sc-sotto">Attività recenti${conEsempio ? ' <span class="chip ghost">esempio</span>' : ''}</h3>
        <ul class="sc-lista sc-recenti">
          ${recenti.map(e => { const s = strumento(e.f); if (!s) return ''; const d = descrivi(e); return `<li><a href="#${s.id}" style="--h:${s.tinta}"><span class="sc-icona">${s.icona}</span><span class="sc-voce"><b>${escHtml(d.testo)}</b><small>${escHtml([d.dettaglio, s.etichetta || s.nome].filter(Boolean).join(' · '))}</small></span><span class="sc-quando">${quando(e.t)}</span></a></li>`; }).join('') || '<li class="sc-vuoto">Nessuna attività ancora.</li>'}
        </ul>
        ${inArrivo.length ? `<p class="sc-arrivo">In arrivo: ${inArrivo.map(s => `<a href="#${s.id}" style="--h:${s.tinta}">${escHtml(s.nome)}</a>`).join(', ')}</p>` : ''}
      </div>
    </section>
    </div>`;

  // numeri che scorrono, mini-grafici che si disegnano
  const anima = !riduciMovimento();
  if (anima) {
    el.querySelectorAll('.sc-valore').forEach(v => { const c = schede[+v.dataset.i]; scorriNumero(v, 0, c.valore, c.m.formato, 900); });
    el.querySelectorAll('.sc-spark-linea').forEach((p, i) => p.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: '1 0' }], { duration: 900, delay: 150 + i * 90, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' }));
    if (primoGiro) comparsa(el.querySelectorAll('.sc-scheda, .sc-pannello'), { passo: 70, distanza: 12 });
  }

  // grafico e selettore
  const box = el.querySelector('#sc-area');
  const grafico = creaGrafico(box, etichette);
  const segmenti = el.querySelector('.sc-segmenti'), cursore = segmenti.querySelector('.sc-seg-attivo');
  const posaCursore = () => { const b = segmenti.querySelector('[aria-selected="true"]'); if (b) { cursore.style.setProperty('--x', b.offsetLeft + 'px'); cursore.style.setProperty('--w', b.offsetWidth + 'px'); } };
  const scegli = (m, conAnim = true) => {
    scelta = m;
    segmenti.querySelectorAll('.sc-seg').forEach(b => b.setAttribute('aria-selected', String(b.dataset.m === m.id)));
    box.style.setProperty('--h', strumento(m.f).tinta);
    posaCursore();
    grafico.mostra(perMese(m), m, conAnim);
  };
  segmenti.addEventListener('click', e => { const b = e.target.closest('.sc-seg'); if (b) scegli(METRICHE.find(m => m.id === b.dataset.m)); });
  requestAnimationFrame(() => scegli(scelta, anima));
  const ro = new ResizeObserver(() => { grafico.ridisegna(); posaCursore(); });
  ro.observe(box);

  // nome nel saluto
  const suNome = () => {
    const n = nomeUtente();
    const s = el.querySelector('.sc-nome'); if (s) s.textContent = n ? ', ' + n : '';
    const b = el.querySelector('#sc-come-ti-chiami'); if (b && n) b.closest('p').remove();
  };
  window.addEventListener('cs:nome', suNome);
  el.querySelector('#sc-come-ti-chiami')?.addEventListener('click', e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('cs:chiedi-nome')); });

  return () => { ro.disconnect(); window.removeEventListener('cs:nome', suNome); };
}
