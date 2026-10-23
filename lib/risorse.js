// Caricamento dei file che accompagnano una funzione (modelli Word, modelli Excel…).
// Tutte le funzioni passano da qui: se un domani i modelli staranno altrove (un'altra cartella,
// un servizio), basta cambiare questo file.

/** Restituisce il file come Blob. `url` di solito è new URL('./file.docx', import.meta.url). */
export async function caricaRisorsa(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('File non trovato: ' + decodeURIComponent(String(url).split('/').pop()));
  return r.blob();
}
