// Registro delle attività fatte in questo browser: alimenta i numeri e i grafici della Scrivania.
// Resta solo nel browser di chi usa la pagina (niente server); se il browser non salva, i numeri si azzerano.
//
// Ogni evento: { f: 'ricevute', a: 'generate', t: quando (ms), n: quante, importo?: centesimi, chiave? }
// `chiave` evita i doppioni: riscaricare lo stesso lotto (per esempio ZIP e poi Word unico) aggiorna l'evento invece di aggiungerne un altro.
const CHIAVE = 'cs.attivita';
const MAX = 3000;
const DODICI_ORE = 12 * 3600 * 1000;

function leggi() {
  try { const v = JSON.parse(localStorage.getItem(CHIAVE) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function scrivi(lista) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(lista.slice(-MAX))); } catch (e) { /* il browser non salva */ }
}

/** Registra un'attività di una funzione. */
export function registra(funzione, { azione = 'fatto', n = 1, importo, chiave } = {}) {
  const lista = leggi();
  const ev = { f: funzione, a: azione, t: Date.now(), n: Math.max(0, Math.round(n) || 0) };
  if (importo != null && Number.isFinite(importo)) ev.importo = Math.round(importo);
  if (chiave) {
    ev.chiave = String(chiave).slice(0, 80);
    const i = lista.findIndex(e => e.f === funzione && e.a === azione && e.chiave === ev.chiave && ev.t - e.t < DODICI_ORE);
    if (i >= 0) { lista[i] = ev; scrivi(lista); return ev; }
  }
  lista.push(ev);
  scrivi(lista);
  window.dispatchEvent(new CustomEvent('cs:attivita', { detail: ev }));
  return ev;
}

/** Tutte le attività registrate (dalla più vecchia). */
export const attivita = () => leggi();

/** Breve impronta di un testo, per costruire le chiavi. */
export function impronta(testo) {
  let h = 2166136261;
  for (let i = 0; i < testo.length; i++) { h ^= testo.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
