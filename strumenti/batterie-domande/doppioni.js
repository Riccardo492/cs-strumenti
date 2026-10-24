// Batterie di domande: ricerca dei doppioni confrontando i testi, senza intelligenza artificiale.
// Due domande sono «uguali» o «molto simili» se usano quasi le stesse parole (radici, senza parole vuote)
// o quasi le stesse sequenze di lettere; pesa anche una risposta esatta identica.
// Le riformulazioni con parole diverse le trova il controllo di Claude («chiede la stessa cosa»).
import { norm } from '../../lib/formati.js';

const VUOTE = new Set(`il lo la i gli le un uno una un di a da in con su per tra fra e ed o od ma che chi cui non si ne ci vi
del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle
sul sullo sulla sui sugli sulle col coi quale quali qual cosa come quando dove quanto quanti quante quanta e sono essere
viene vengono deve devono puo possono ha hanno seguenti seguente indicare indica secondo sensi questo questa questi queste
quello quella tale tali ogni piu meno anche gia solo stato stata`.split(/\s+/));

const radice = w => w.length > 4 ? w.replace(/(?:i|e|a|o)$/, '') : w;
const parole = s => new Set(norm(s).split(' ').filter(w => w.length > 1 && !VUOTE.has(w)).map(radice));
function trigrammi(s) {
  const t = ' ' + norm(s) + ' ', out = new Set();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
const dice = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return 2 * n / (a.size + b.size); };

/** Somiglianza tra due testi, da 0 a 1. */
export function somiglianza(a, b) {
  return .55 * jaccard(parole(a), parole(b)) + .45 * dice(trigrammi(a), trigrammi(b));
}

/**
 * Doppioni in un elenco di domande (nell'ordine della batteria): la seconda di una coppia è il doppione della prima.
 * Le parole pesano di più quanto più sono rare nella batteria: «procedimento» o «Comune» compaiono
 * ovunque e contano poco, «nominato» o «sostituito» fanno la differenza.
 * → Map(id → { di, tipo: 'uguale'|'simile', valore })
 */
export function trovaDoppioni(domande) {
  const pre = domande.map(q => ({ id: q.id, p: parole(q.testo), t: trigrammi(q.testo), r: trigrammi(q.risposte?.[q.esatta] ?? '') }));
  const df = new Map();
  for (const x of pre) for (const w of x.p) df.set(w, (df.get(w) || 0) + 1);
  const N = Math.max(pre.length, 8);
  const peso = w => Math.log(1 + N / (df.get(w) || 1));
  const jPesato = (a, b) => {
    let comune = 0, tutto = 0;
    for (const w of a) { const p = peso(w); tutto += p; if (b.has(w)) comune += p; }
    for (const w of b) if (!a.has(w)) tutto += peso(w);
    return tutto ? comune / tutto : 0;
  };
  const out = new Map();
  for (let j = 1; j < pre.length; j++) {
    let best = null;
    for (let i = 0; i < j; i++) {
      const a = pre[i], b = pre[j];
      const v = .6 * jPesato(a.p, b.p) + .4 * dice(a.t, b.t);
      const stessaRisposta = dice(a.r, b.r) >= .85;
      let tipo = null;
      if (v >= .85) tipo = 'uguale';
      else if (v >= .6 || (stessaRisposta && v >= .52)) tipo = 'simile';
      if (tipo && (!best || v > best.valore)) best = { di: a.id, tipo, valore: Math.round(v * 100) / 100 };
    }
    if (best) out.set(pre[j].id, best);
  }
  return out;
}
