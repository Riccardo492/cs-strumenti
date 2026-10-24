// Batterie di domande: le richieste a Claude.
// Dentro Claude (l'anteprima su claude.ai) la pagina chiede direttamente, con l'account di chi la usa:
// alla prima richiesta Claude chiede il permesso. Altrove (sito GitHub) le stesse richieste si copiano
// in una chat con Claude e la risposta si incolla nella pagina: il formato è identico.
//
// Generazione e controllo sono richieste separate: chi controlla non vede come sono state scritte
// le domande e le giudica da revisore indipendente.
import { LETTERE, ripartisci } from './stato.js';

/* ---------- disponibilità ---------- */
let promessa = null, spento = false;
/** La funzione di Claude, oppure null (fuori da Claude, o permesso negato). */
export async function claude() {
  if (spento) return null;
  if (!promessa) promessa = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('sample').catch(() => null) : Promise.resolve(null);
  return promessa;
}
const DEFINITIVI = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

/** Messaggio in italiano per un errore di Claude; segnala anche se passare al copia e incolla. */
export function spiegaErrore(e) {
  const code = e && e.code;
  if (DEFINITIVI.has(code)) spento = true;
  const m = {
    not_granted: "Non è stato dato il permesso di usare Claude in questa pagina. Puoi continuare con il copia e incolla.",
    sampling_disabled: "Claude non è disponibile per questo account. Puoi continuare con il copia e incolla.",
    not_declared: "Questa pagina non può chiedere a Claude. Puoi continuare con il copia e incolla.",
    capability_disabled: "Claude non è disponibile in questa vista. Puoi continuare con il copia e incolla.",
    capability_removed: "Claude non è disponibile in questa vista. Puoi continuare con il copia e incolla.",
    rate_limited: "Troppe richieste a Claude o limite di utilizzo raggiunto. Riprova tra qualche minuto.",
    session_expired: "La sessione di Claude è scaduta: accedi di nuovo e riprova.",
    refused: "Claude non ha risposto a questa richiesta. Prova a riformulare materia o note.",
    invalid_json: "La risposta non era nel formato atteso. Riprova: se succede ancora, chiedi meno domande alla volta.",
    empty_completion: "Claude non ha scritto niente. Riprova chiedendo meno domande alla volta.",
    prompt_too_large: "Il testo inviato è troppo lungo: accorcia il programma del bando.",
    cancelled: "Interrotto.",
  }[code];
  return { messaggio: m || ((e && e.messaggio) || "Il collegamento con Claude si è interrotto. Riprova."), passaACopia: spento, annullato: code === 'cancelled' };
}

/* ---------- lettura delle risposte ---------- */
/** Trova il JSON in una risposta incollata (anche dentro ``` o con una frase prima e dopo). */
export function leggiJson(testo) {
  let t = String(testo || '').trim();
  const f = /```(?:json)?\s*([\s\S]*?)```/i.exec(t); if (f) t = f[1].trim();
  const a = Math.min(...['[', '{'].map(c => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  const b = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if (a === Infinity || b < a) throw new Error('Nel testo incollato non trovo le domande in formato JSON. Incolla tutta la risposta di Claude.');
  t = t.slice(a, b + 1).replace(/,\s*([\]}])/g, '$1');
  try { return JSON.parse(t); }
  catch (e) { throw new Error('La risposta incollata è incompleta o rovinata (' + e.message.replace(/^JSON\.parse: /, '') + '). Copiala di nuovo per intero.'); }
}

const lettera = (v, n) => {
  if (typeof v === 'number' && Number.isInteger(v)) return v >= 0 && v < n ? v : (v >= 1 && v <= n ? v - 1 : -1);
  const s = String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-H]$/.test(s)) return LETTERE.indexOf(s) < n ? LETTERE.indexOf(s) : -1;
  if (/^\d$/.test(s)) return +s >= 1 && +s <= n ? +s - 1 : -1;
  return -1;
};
const testo = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const LIVELLO = { facile: 'facile', semplice: 'facile', base: 'facile', media: 'media', medio: 'media', intermedia: 'media', difficile: 'difficile', alta: 'difficile', avanzata: 'difficile' };

/**
 * Domande scritte da Claude → formato della batteria. Le risposte vengono mescolate,
 * così la risposta esatta non finisce sempre nella stessa posizione.
 * @returns {{ buone: object[], scartate: { motivo: string, testo: string }[] }}
 */
export function normalizzaDomande(dati, { materie, materiaFissa, nRisposte }) {
  const lista = Array.isArray(dati) ? dati : Array.isArray(dati?.domande) ? dati.domande : [];
  const buone = [], scartate = [];
  const trovaMateria = nome => {
    if (materiaFissa) return materiaFissa;
    const n = testo(nome).toLowerCase();
    return (materie.find(m => m.nome.trim().toLowerCase() === n) || materie.find(m => n && (m.nome.toLowerCase().includes(n) || n.includes(m.nome.toLowerCase()))))?.id;
  };
  for (const o of lista) {
    const domanda = testo(o?.domanda ?? o?.testo);
    let risposte = Array.isArray(o?.risposte) ? o.risposte.map(r => testo(typeof r === 'object' ? (r.testo ?? r.text) : r).replace(/^[A-H][).]\s+/, '')) : [];
    risposte = risposte.filter(Boolean);
    const esatta = lettera(o?.esatta ?? o?.corretta, risposte.length);
    const materia = trovaMateria(o?.materia);
    if (!domanda) { scartate.push({ motivo: 'senza testo', testo: '' }); continue; }
    if (risposte.length < 2) { scartate.push({ motivo: 'meno di due risposte', testo: domanda }); continue; }
    if (esatta < 0) { scartate.push({ motivo: 'risposta esatta non indicata', testo: domanda }); continue; }
    if (!materia) { scartate.push({ motivo: `materia «${testo(o?.materia)}» non riconosciuta`, testo: domanda }); continue; }
    if (new Set(risposte.map(r => r.toLowerCase())).size < risposte.length) { scartate.push({ motivo: 'risposte ripetute', testo: domanda }); continue; }
    // mescola le risposte
    const giusta = risposte[esatta];
    for (let i = risposte.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [risposte[i], risposte[j]] = [risposte[j], risposte[i]]; }
    buone.push({
      materia, testo: domanda, risposte, esatta: risposte.indexOf(giusta),
      difficolta: LIVELLO[testo(o?.difficolta).toLowerCase()] || 'media',
      argomento: testo(o?.argomento), riferimento: testo(o?.riferimento),
      fuoriNumero: nRisposte && risposte.length !== nRisposte,
    });
  }
  return { buone, scartate };
}

/** Esiti del controllo → { id: controllo } */
export function normalizzaControllo(dati, domande) {
  const lista = Array.isArray(dati) ? dati : Array.isArray(dati?.controllo) ? dati.controllo : [];
  const ids = new Set(domande.map(q => q.id));
  const esito = v => { const s = testo(v).toLowerCase(); return s.startsWith('s') ? 'si' : s.startsWith('n') ? 'no' : s ? 'dubbio' : ''; };
  const out = {};
  for (const o of lista) {
    const id = testo(o?.id); if (!ids.has(id)) continue;
    const q = domande.find(x => x.id === id);
    const giusta = o?.rispostaGiusta == null || o.rispostaGiusta === '' ? null : lettera(o.rispostaGiusta, q.risposte.length);
    const doppio = testo(o?.doppioneDi);
    out[id] = {
      stato: 'fatto',
      attinenza: esito(o?.attinenza) || 'dubbio', motivoAttinenza: testo(o?.motivoAttinenza),
      risposta: esito(o?.risposta) || 'dubbio', motivoRisposta: testo(o?.motivoRisposta),
      rispostaGiusta: giusta != null && giusta >= 0 && giusta !== q.esatta ? giusta : null,
      doppioneDi: ids.has(doppio) && doppio !== id ? doppio : null,
    };
  }
  return out;
}

/* ---------- testi delle richieste ---------- */
const DESCRIZIONE_LIVELLI = `- facile: nozioni di base, definizioni, fonti principali;
- media: applicazione delle regole, distinzioni tra istituti simili, competenze e procedure;
- difficile: casi particolari, eccezioni, termini e passaggi specifici delle procedure.`;

const blocco = (titolo, t) => t ? `\n${titolo}:\n"""\n${t.trim().slice(0, 12000)}\n"""\n` : '';
const quote = r => LIVELLI_TESTO.filter(([k]) => r[k]).map(([k, uno, tanti]) => `${r[k]} ${r[k] === 1 ? uno : tanti}`).join(', ');
const LIVELLI_TESTO = [['facile', 'facile', 'facili'], ['media', 'di media difficoltà', 'di media difficoltà'], ['difficile', 'difficile', 'difficili']];
const formatoDomanda = (nRisposte, conMateria) => `{${conMateria ? '"materia": "nome della materia esattamente come sopra", ' : ''}"domanda": "testo", "risposte": [${Array.from({ length: nRisposte }, (_, i) => `"testo risposta ${LETTERE[i]}"`).join(', ')}], "esatta": "lettera della risposta esatta", "difficolta": "facile" | "media" | "difficile", "argomento": "argomento del programma", "riferimento": "norma o fonte, se esiste"}`;
const REGOLE_SCRITTURA = n => `Regole:
- Ogni quesito ha esattamente ${n} risposte e una sola è corretta; le altre sono plausibili ma sicuramente sbagliate.
- Risposte di lunghezza e forma simili, senza «tutte le precedenti» o «nessuna delle precedenti».
- Italiano corretto, formulazione chiara e non ambigua, niente doppie negazioni.
- Riferimenti normativi aggiornati alla normativa vigente: non usare norme abrogate o sostituite.
- Ogni quesito deve rientrare nella materia e nel programma d'esame; varia gli argomenti.
- Varia la posizione della risposta esatta.`;

/** Richiesta per scrivere le domande di una materia (una parte, se sono tante). */
export function richiestaGenera({ titolo, programma, materia, conteggi, nRisposte, giaScritte = [], motivo = '' }) {
  const tot = conteggi.facile + conteggi.media + conteggi.difficile;
  return `Sei un esperto nella preparazione di prove preselettive e scritte per concorsi pubblici italiani.
Scrivi ${tot} quesit${tot === 1 ? 'o' : 'i'} a risposta multipla per ${titolo ? `«${titolo}»` : 'un concorso pubblico'}.

Materia: «${materia.nome}»${materia.note ? `\nArgomenti da privilegiare: ${materia.note}` : ''}
Difficoltà: ${quote(conteggi)}.
${DESCRIZIONE_LIVELLI}
${blocco("Programma d'esame del bando (le domande devono restare dentro questi argomenti)", programma)}
${REGOLE_SCRITTURA(nRisposte)}
${motivo ? `\nNota: ${motivo}\n` : ''}${giaScritte.length ? `\nNon ripetere e non riformulare questi quesiti già presenti nella batteria:\n${giaScritte.slice(-60).map(t => '- ' + t).join('\n')}\n` : ''}
Rispondi solo con un array JSON, un oggetto per quesito:
[${formatoDomanda(nRisposte, false)}]`;
}

/** Una sola richiesta per tutte le materie (per il copia e incolla). */
export function richiestaGeneraTutto({ titolo, programma, materie, nRisposte, giaScritte = [] }) {
  const righe = materie.filter(m => m.nome.trim() && (m.conteggi ? m.conteggi.facile + m.conteggi.media + m.conteggi.difficile : m.quante) > 0).map(m => {
    const r = m.conteggi || ripartisci(m.quante, m.difficolta);
    return `- «${m.nome}»: ${r.facile + r.media + r.difficile} quesiti (${quote(r)})${m.note ? ` — argomenti da privilegiare: ${m.note}` : ''}`;
  }).join('\n');
  return `Sei un esperto nella preparazione di prove preselettive e scritte per concorsi pubblici italiani.
Scrivi i quesiti a risposta multipla per ${titolo ? `«${titolo}»` : 'un concorso pubblico'}, divisi per materia così:
${righe}

Livelli di difficoltà:
${DESCRIZIONE_LIVELLI}
${blocco("Programma d'esame del bando (le domande devono restare dentro questi argomenti)", programma)}
${REGOLE_SCRITTURA(nRisposte)}
${giaScritte.length ? `\nNon ripetere e non riformulare questi quesiti già presenti nella batteria:\n${giaScritte.slice(-80).map(t => '- ' + t).join('\n')}\n` : ''}
Rispondi solo con un array JSON, un oggetto per quesito, senza altro testo:
[${formatoDomanda(nRisposte, true)}]`;
}

/** Richiesta del secondo controllo, per un gruppo di domande. */
export function richiestaControllo({ titolo, programma, materie, domande }) {
  const nomeM = id => materie.find(m => m.id === id)?.nome || '';
  const elenco = domande.map(q => JSON.stringify({
    id: q.id, materia: nomeM(q.materia), domanda: q.testo,
    risposte: Object.fromEntries(q.risposte.map((r, i) => [LETTERE[i], r])), esatta: LETTERE[q.esatta],
  })).join('\n');
  const materieTxt = materie.filter(m => m.nome.trim()).map(m => `- «${m.nome}»${m.note ? `: ${m.note}` : ''}`).join('\n');
  return `Fai da revisore indipendente dei quesiti a risposta multipla di ${titolo ? `«${titolo}»` : 'un concorso pubblico'}.
Non li hai scritti tu: controllali con occhio critico, uno per uno.

Materie della prova:
${materieTxt}
${blocco("Programma d'esame del bando", programma)}
Per ogni quesito verifica:
1. attinenza: il quesito riguarda la sua materia e rientra nel programma d'esame? "si", "no" oppure "dubbio".
2. risposta: la risposta indicata come esatta è corretta ed è l'unica corretta secondo la normativa vigente? "si", "no" oppure "dubbio" (più risposte accettabili, formulazione ambigua, norma cambiata). Se è "no", indica in rispostaGiusta la lettera della risposta corretta, se c'è tra quelle proposte.
3. doppione: se il quesito chiede in sostanza la stessa cosa di un altro quesito dell'elenco, indica in doppioneDi l'id dell'altro (solo per il secondo dei due).

Quesiti (uno per riga):
${elenco}

Rispondi solo con un array JSON, un oggetto per quesito, nello stesso ordine:
[{"id": "q1", "attinenza": "si" | "no" | "dubbio", "motivoAttinenza": "", "risposta": "si" | "no" | "dubbio", "rispostaGiusta": null, "motivoRisposta": "", "doppioneDi": null}]
I motivi sono brevi (al massimo 30 parole) e restano vuoti quando l'esito è "si".`;
}

/** Richiesta per ricavare le materie dal programma del bando. */
export function richiestaMaterie(programma) {
  return `Questo è il programma d'esame di un bando di concorso pubblico italiano:
"""
${programma.trim().slice(0, 12000)}
"""
Elenca le materie d'esame che contiene, con un nome breve (al massimo 6 parole) e gli argomenti principali indicati per ciascuna.
Rispondi solo con un array JSON: [{"nome": "Diritto amministrativo", "argomenti": "procedimento amministrativo, accesso agli atti (L. 241/1990)"}]`;
}

/* ---------- chiamate ---------- */
/**
 * Chiede a Claude e restituisce il JSON della risposta.
 * `conta(n)` riceve quante domande sono già state scritte mentre la risposta arriva.
 */
export async function chiedi(prompt, { livello = 'default', signal, conta, nuova = true } = {}) {
  const sample = await claude();
  if (!sample) throw { code: 'not_declared' };
  const opz = { modelTier: livello };
  if (signal) opz.signal = signal;
  if (nuova) opz.cache = false;          // «genera» e «rigenera» devono dare domande nuove, non la risposta di prima
  if (conta) opz.onText = ({ text }) => conta((text.match(/"(?:domanda|id)"\s*:/g) || []).length);
  return sample.json(prompt, opz);
}

/** Divide un numero di domande per livello in parti da al massimo `max`. */
export function inParti(conteggi, max = 12) {
  const parti = [];
  const resto = { ...conteggi };
  while (resto.facile + resto.media + resto.difficile > 0) {
    const p = { facile: 0, media: 0, difficile: 0 };
    let spazio = max;
    for (const l of ['facile', 'media', 'difficile']) { const k = Math.min(resto[l], spazio); p[l] = k; resto[l] -= k; spazio -= k; }
    parti.push(p);
  }
  return parti;
}
