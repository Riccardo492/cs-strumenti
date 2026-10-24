// Batterie di domande: le versioni della prova (A, B, C…), con domande e risposte mescolate.
// Il mescolamento parte da un «seme»: con lo stesso seme si ottengono sempre le stesse versioni,
// così le griglie di correzione restano valide anche se si riscarica la batteria più tardi.
import { LETTERE } from './stato.js';

/** Generatore pseudo-casuale ripetibile (mulberry32). */
export function generatore(seme) {
  let a = (seme >>> 0) || 1;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function mescola(arr, caso) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(caso() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const ORDINI = [
  { id: 'materia', nome: 'Mescolate dentro ogni materia', breve: 'Le materie restano nell\'ordine indicato, le domande cambiano posto al loro interno.' },
  { id: 'tutte', nome: 'Tutte mescolate', breve: 'Le domande delle varie materie si alternano.' },
  { id: 'no', nome: 'Nell\'ordine della batteria', breve: 'Stesso ordine in tutte le versioni (cambiano solo le risposte, se scelto).' },
];

/**
 * @param domande  domande nell'ordine della batteria (già raggruppate per materia)
 * @returns [{ lettera, domande: [{ q, n, risposte: string[], esatta, ordine: indici originali }] }]
 */
export function creaVersioni(domande, materie, { quante = 1, ordine = 'materia', risposte = true, seme = 1 }) {
  const caso = generatore(seme);
  const out = [];
  for (let v = 0; v < Math.max(1, Math.min(26, quante)); v++) {
    let lista;
    if (ordine === 'tutte') lista = mescola(domande, caso);
    else if (ordine === 'materia') lista = materie.flatMap(m => mescola(domande.filter(q => q.materia === m.id), caso)).concat(domande.filter(q => !materie.some(m => m.id === q.materia)));
    else lista = [...domande];
    out.push({
      lettera: String.fromCharCode(65 + v),
      domande: lista.map((q, i) => {
        const idx = q.risposte.map((_, k) => k);
        const ord = risposte ? mescola(idx, caso) : idx;
        return { q, n: i + 1, risposte: ord.map(k => q.risposte[k]), esatta: ord.indexOf(q.esatta), ordine: ord };
      }),
    });
  }
  return out;
}

export const letteraRisposta = i => LETTERE[i] || '?';
