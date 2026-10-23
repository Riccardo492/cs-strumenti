// Controlli formali su codice fiscale e IBAN.

const CF_DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };

/** Codice fiscale di persona fisica (16 caratteri, con carattere di controllo) o numerico di 11 cifre. */
export function cfOk(cf) {
  if (/^\d{11}$/.test(cf)) return true;
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  let s = 0;
  for (let i = 0; i < 15; i++) { const c = cf[i]; s += i % 2 === 0 ? CF_DISPARI[c] : (/\d/.test(c) ? +c : c.charCodeAt(0) - 65); }
  return String.fromCharCode(65 + s % 26) === cf[15];
}

/** IBAN con verifica mod 97; per l'Italia anche la lunghezza (27). */
export function ibanOk(iban) {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('IT') && iban.length !== 27) return false;
  const r = iban.slice(4) + iban.slice(0, 4);
  let m = 0;
  for (const ch of r) { const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55); for (const d of v) m = (m * 10 + +d) % 97; }
  return m === 1;
}
