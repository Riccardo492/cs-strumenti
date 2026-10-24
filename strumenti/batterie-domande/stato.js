// Batterie di domande: lo stato della batteria in lavorazione, condiviso dalle quattro sezioni.
// La bozza resta salvata nel browser di chi la sta preparando (se il browser lo permette),
// così si può chiudere la pagina e riprendere. Senza bozza si parte da una batteria di esempio.
import { norm } from '../../lib/formati.js';

const CHIAVE = 'cs.batterie.bozza';

export const DIFFICOLTA = [
  { id: 'facile', nome: 'Facile' },
  { id: 'media', nome: 'Media' },
  { id: 'difficile', nome: 'Difficile' },
  { id: 'mista', nome: 'Mista (30% facili, 50% medie, 20% difficili)', breve: 'Mista' },
];
const MISTA = { facile: .3, media: .5, difficile: .2 };
export const LIVELLI = ['facile', 'media', 'difficile'];
export const nomeDifficolta = id => (DIFFICOLTA.find(d => d.id === id) || {}).breve || (DIFFICOLTA.find(d => d.id === id) || {}).nome || id;
export const LETTERE = 'ABCDEFGH';

export const ISTRUZIONI_BASE = 'Ogni domanda ha una sola risposta esatta. Segna la risposta scelta sul modulo risposte. Non sono ammessi testi, appunti o dispositivi elettronici.';

/** Quante domande per livello: «mista» si divide 30/50/20 (resti alle quote maggiori). */
export function ripartisci(quante, difficolta) {
  const n = Math.max(0, Math.round(quante) || 0);
  if (difficolta !== 'mista') return { facile: 0, media: 0, difficile: 0, [difficolta]: n };
  const base = LIVELLI.map(l => ({ l, v: n * MISTA[l] }));
  const out = Object.fromEntries(base.map(x => [x.l, Math.floor(x.v)]));
  let resto = n - Object.values(out).reduce((a, b) => a + b, 0);
  for (const x of [...base].sort((a, b) => (b.v % 1) - (a.v % 1))) { if (resto <= 0) break; out[x.l]++; resto--; }
  return out;
}

/* ---------- esempio ---------- */
const PROGRAMMA_ESEMPIO = `Materie della prova preselettiva:
- diritto amministrativo, con particolare riferimento al procedimento amministrativo e al diritto di accesso ai documenti (L. 241/1990);
- ordinamento degli enti locali (D.Lgs. 267/2000);
- nozioni di informatica e dei principali strumenti d'ufficio (posta elettronica certificata, fogli di calcolo, videoscrittura).`;

function esempio() {
  const fatto = (attinenza, risposta, extra = {}) => ({ stato: 'fatto', attinenza, risposta, motivoAttinenza: '', motivoRisposta: '', rispostaGiusta: null, doppioneDi: null, ...extra });
  const q = (id, materia, testo, risposte, esatta, difficolta, argomento, riferimento, controllo) =>
    ({ id, materia, testo, risposte, esatta, difficolta, argomento, riferimento, origine: 'esempio', controllo, accettata: false });
  return {
    esempio: true, prossimo: 11,
    titolo: 'Concorso per istruttore amministrativo (esempio)',
    programma: PROGRAMMA_ESEMPIO,
    nRisposte: 3,
    materie: [
      { id: 'm1', nome: 'Diritto amministrativo', quante: 4, difficolta: 'mista', note: 'Procedimento amministrativo e accesso ai documenti (L. 241/1990)' },
      { id: 'm2', nome: 'Ordinamento degli enti locali', quante: 4, difficolta: 'media', note: 'Organi del Comune (D.Lgs. 267/2000)' },
      { id: 'm3', nome: 'Informatica', quante: 2, difficolta: 'facile', note: 'PEC, fogli di calcolo, videoscrittura' },
    ],
    domande: [
      q('q1', 'm1', 'Se la legge o i regolamenti non prevedono un termine diverso, entro quanti giorni deve concludersi il procedimento amministrativo?',
        ['30 giorni', '60 giorni', '90 giorni'], 0, 'facile', 'Termini del procedimento', 'L. 241/1990, art. 2, c. 2', fatto('si', 'si')),
      q('q2', 'm1', 'Quale legge detta le norme generali sul procedimento amministrativo e sul diritto di accesso ai documenti amministrativi?',
        ['D.Lgs. 165/2001', 'L. 241/1990', 'D.Lgs. 267/2000'], 1, 'media', 'Fonti', 'L. 241/1990', fatto('si', 'si')),
      q('q3', 'm1', 'In mancanza di un termine diverso stabilito da legge o regolamento, il procedimento amministrativo deve concludersi entro:',
        ['90 giorni', '45 giorni', '30 giorni'], 2, 'difficile', 'Termini del procedimento', 'L. 241/1990, art. 2, c. 2', fatto('si', 'si', { doppioneDi: 'q1' })),
      q('q4', 'm1', 'In quale anno è iniziata la Rivoluzione francese?',
        ['1789', '1815', '1848'], 0, 'media', 'Storia', '', fatto('no', 'si', { motivoAttinenza: "È una domanda di storia: non rientra in nessuna materia del programma." })),
      q('q5', 'm2', 'Quale organo del Comune approva il bilancio di previsione?',
        ['La Giunta comunale', 'Il Consiglio comunale', 'Il Sindaco'], 1, 'media', 'Competenze del Consiglio', 'D.Lgs. 267/2000, art. 42', fatto('si', 'si')),
      q('q6', 'm2', 'Chi nomina il Segretario comunale?',
        ['Il Sindaco', 'Il Consiglio comunale', 'Il Prefetto'], 0, 'media', 'Segretario comunale', 'D.Lgs. 267/2000, art. 99', fatto('si', 'si')),
      q('q7', 'm2', 'Quanto dura il mandato del Sindaco?',
        ['Quattro anni', 'Sei anni', 'Cinque anni'], 2, 'media', 'Organi del Comune', 'D.Lgs. 267/2000, art. 51', fatto('si', 'si')),
      q('q8', 'm2', 'Chi presiede la Giunta comunale?',
        ['Il Sindaco', 'Il Presidente del Consiglio comunale', 'Il Segretario comunale'], 1, 'media', 'Organi del Comune', 'D.Lgs. 267/2000, art. 50',
        fatto('si', 'no', { rispostaGiusta: 0, motivoRisposta: "La Giunta è presieduta dal Sindaco (art. 50 TUEL), non dal Presidente del Consiglio." })),
      q('q9', 'm3', "Che cosa indica l'acronimo PEC?",
        ['Protocollo Elettronico Comunale', 'Posta Elettronica Certificata', 'Procedura Elettronica Concorsuale'], 1, 'facile', 'Posta elettronica certificata', 'D.P.R. 68/2005', fatto('si', 'si')),
      q('q10', 'm3', 'Quale di questi è il formato dei fogli di calcolo di Microsoft Excel?',
        ['.docx', '.pptx', '.xlsx'], 2, 'facile', 'Fogli di calcolo', '', fatto('si', 'si')),
    ],
    versioni: { quante: 2, ordine: 'materia', risposte: true, seme: 2026 },
    stampa: { istruzioni: ISTRUZIONI_BASE, campi: true, titoliMaterie: true, soluzioni: false },
  };
}

/** Una batteria vuota, quando si comincia davvero. */
function vuota() {
  return {
    esempio: false, prossimo: 1,
    titolo: '', programma: '', nRisposte: 3,
    materie: [{ id: 'm1', nome: '', quante: 10, difficolta: 'mista', note: '' }],
    domande: [],
    versioni: { quante: 2, ordine: 'materia', risposte: true, seme: Math.floor(Math.random() * 9000) + 1000 },
    stampa: { istruzioni: ISTRUZIONI_BASE, campi: true, titoliMaterie: true, soluzioni: false },
  };
}

function leggi() {
  try { const t = localStorage.getItem(CHIAVE); if (t) { const s = JSON.parse(t); if (s && Array.isArray(s.domande) && Array.isArray(s.materie)) return { ...vuota(), ...s }; } } catch (e) { /* bozza illeggibile: si riparte */ }
  return esempio();
}

/** Lo stato condiviso. Si modifica direttamente, poi si chiama salva(). */
export const S = leggi();

let timer = 0;
export function salva() {
  clearTimeout(timer);
  timer = setTimeout(() => { try { if (S.esempio) localStorage.removeItem(CHIAVE); else localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch (e) { /* il browser non salva: la bozza vale finché la pagina è aperta */ } }, 250);
}
function sostituisciTutto(nuovo) { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, nuovo); salva(); }
/** Ricomincia da zero (toglie anche l'esempio). */
export const ricomincia = () => sostituisciTutto(vuota());
/** Torna alla batteria di esempio. */
export const tornaEsempio = () => sostituisciTutto(esempio());
/** Alla prima modifica vera l'esempio diventa una batteria tua: da lì in poi si salva. */
export function diventaMia() {
  if (!S.esempio) return false;
  S.esempio = false;
  S.domande = S.domande.filter(q => q.origine !== 'esempio');
  if (S.titolo.endsWith('(esempio)')) S.titolo = S.titolo.replace(/\s*\(esempio\)$/, '');
  return true;
}

/* ---------- materie e domande ---------- */
export const materia = id => S.materie.find(m => m.id === id);
export const nomeMateria = id => materia(id)?.nome || 'Materia senza nome';
export function nuovaMateria(dati = {}) {
  let n = 1; while (S.materie.some(m => m.id === 'm' + n)) n++;
  const m = { id: 'm' + n, nome: '', quante: 10, difficolta: 'mista', note: '', ...dati };
  S.materie.push(m); return m;
}
export function togliMateria(id) {
  S.materie = S.materie.filter(m => m.id !== id);
  S.domande = S.domande.filter(q => q.materia !== id);
}
export const domandeDi = id => S.domande.filter(q => q.materia === id);
export const domanda = id => S.domande.find(q => q.id === id);

/** Aggiunge domande già controllate nel formato interno. */
export function aggiungiDomande(lista, origine) {
  const nuove = lista.map(d => ({
    id: 'q' + (S.prossimo++), materia: d.materia, testo: d.testo, risposte: d.risposte, esatta: d.esatta,
    difficolta: d.difficolta || 'media', argomento: d.argomento || '', riferimento: d.riferimento || '',
    origine, controllo: { stato: 'da-fare' }, accettata: false,
  }));
  S.domande.push(...nuove);
  return nuove;
}
/** Sostituisce una domanda con una nuova (stessa posizione, stesso id). */
export function sostituisci(id, d, origine) {
  const q = domanda(id); if (!q) return null;
  Object.assign(q, { testo: d.testo, risposte: d.risposte, esatta: d.esatta, difficolta: d.difficolta || q.difficolta, argomento: d.argomento || '', riferimento: d.riferimento || '', origine, controllo: { stato: 'da-fare' }, accettata: false });
  return q;
}
export function togliDomanda(id) { S.domande = S.domande.filter(q => q.id !== id); }

/** Le domande nell'ordine delle materie. */
export const domandeOrdinate = () => S.materie.flatMap(m => domandeDi(m.id)).concat(S.domande.filter(q => !materia(q.materia)));

/* ---------- esiti del secondo controllo ---------- */
/**
 * Problemi di una domanda: doppioni (calcolati sui testi, in `doppi`) ed esito del controllo di Claude.
 * → [{ tipo: 'fuori-tema'|'attinenza-dubbia'|'risposta-errata'|'risposta-dubbia'|'doppione'|'da-controllare', testo }]
 */
export function problemi(q, doppi) {
  const out = [];
  const c = q.controllo || {};
  const d = doppi?.get(q.id);
  if (d) out.push({ tipo: 'doppione', testo: `${d.tipo === 'uguale' ? 'Uguale' : 'Molto simile'} alla domanda ${numero(d.di)}`, di: d.di });
  else if (c.doppioneDi && domanda(c.doppioneDi)) out.push({ tipo: 'doppione', testo: `Chiede la stessa cosa della domanda ${numero(c.doppioneDi)}`, di: c.doppioneDi });
  if (c.stato !== 'fatto') { out.push({ tipo: 'da-controllare', testo: 'Da controllare' }); return out; }
  if (c.attinenza === 'no') out.push({ tipo: 'fuori-tema', testo: c.motivoAttinenza || 'Non attinente alla materia o al programma' });
  else if (c.attinenza === 'dubbio') out.push({ tipo: 'attinenza-dubbia', testo: c.motivoAttinenza || 'Attinenza dubbia' });
  if (c.risposta === 'no') out.push({ tipo: 'risposta-errata', testo: c.motivoRisposta || 'La risposta indicata come esatta non è corretta', giusta: c.rispostaGiusta });
  else if (c.risposta === 'dubbio') out.push({ tipo: 'risposta-dubbia', testo: c.motivoRisposta || 'Risposta da verificare', giusta: c.rispostaGiusta });
  return out;
}
/** Numero progressivo di una domanda nella batteria ordinata (per i messaggi). */
export function numero(id) { const i = domandeOrdinate().findIndex(q => q.id === id); return i < 0 ? '?' : i + 1; }

/** Testo normalizzato, utile per confronti veloci. */
export const chiaveTesto = s => norm(s);
