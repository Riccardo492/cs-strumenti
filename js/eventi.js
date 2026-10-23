// Piccolo canale di eventi tra le funzioni e il resto della pagina (per esempio l'assistente).
// Nomi degli eventi: "<id funzione>:<nome>", per esempio "ricevute:file-caricato".
const canale = new EventTarget();

export function emetti(nome, dati) {
  canale.dispatchEvent(new CustomEvent(nome, { detail: dati }));
}

/** Ascolta un evento; ritorna la funzione per smettere di ascoltare. */
export function ascolta(nome, fn) {
  const h = e => fn(e.detail);
  canale.addEventListener(nome, h);
  return () => canale.removeEventListener(nome, h);
}
