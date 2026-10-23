// Assistente passo passo.
// Ogni funzione descrive i passi nella sua scheda (campo `guida`), sezione per sezione:
//   { titolo, testo (HTML), punta: 'selettore CSS da evidenziare', apri: 'selettore di un <details> da aprire',
//     avanzaQuando: 'nome-evento' | ['evento', ...] }
// Con `avanzaQuando` l'assistente passa da solo al passo successivo quando la funzione emette quell'evento
// (vedi ctx.emetti nella scheda della funzione).
//
// Per collegare in futuro un assistente AI basta aggiungere qui un metodo `chiedi(domanda, contesto)`
// che chiami un servizio esterno: il pannello e il contesto (funzione e sezione aperte) sono già pronti.
import { ascolta } from './eventi.js';
import { riduciMovimento } from './menu.js';

export function creaAssistente() {
  const P = id => document.getElementById(id);
  const box = P('assistente');
  let passi = [], i = 0, prefisso = '', stacca = null, punto = null;

  function pulisci() {
    if (stacca) { stacca(); stacca = null; }
    if (punto) { punto.classList.remove('guida-punto'); punto = null; }
  }
  function mostra() {
    pulisci();
    const p = passi[i];
    P('ass-contatore').textContent = `Passo ${i + 1} di ${passi.length}`;
    P('ass-titolo').textContent = p.titolo;
    P('ass-testo').innerHTML = p.testo;
    P('ass-puntini').innerHTML = passi.map((_, j) => `<li class="${j < i ? 'fatto' : j === i ? 'ora' : ''}"></li>`).join('');
    P('ass-indietro').disabled = i === 0;
    P('ass-avanti').textContent = i === passi.length - 1 ? 'Fine' : 'Avanti';
    P('ass-attesa').hidden = !p.avanzaQuando;
    if (p.apri) document.querySelector(p.apri)?.setAttribute('open', '');
    if (p.punta) {
      const el = document.querySelector(p.punta);
      if (el) {
        punto = el; el.classList.add('guida-punto');
        // sui telefoni il pannello sta in basso: l'elemento va in alto
        el.scrollIntoView({ behavior: riduciMovimento() ? 'auto' : 'smooth', block: window.innerWidth <= 600 ? 'start' : 'center' });
      }
    }
    if (p.avanzaQuando) {
      const qui = i;
      const off = [].concat(p.avanzaQuando).map(n => ascolta(prefisso + n, () => setTimeout(() => { if (i === qui && !box.hidden) avanti(); }, 450)));
      stacca = () => off.forEach(f => f());
    }
  }
  function avanti() { if (i < passi.length - 1) { i++; mostra(); } else chiudi(); }
  function indietro() { if (i > 0) { i--; mostra(); } }

  /** Avvia una guida. `prefisso` è l'id della funzione, per ascoltare i suoi eventi. */
  function avvia({ contesto, passi: lista, prefisso: pre }) {
    if (!lista || !lista.length) return;
    passi = lista; i = 0; prefisso = pre ? pre + ':' : '';
    P('ass-contesto').textContent = contesto || '';
    box.hidden = false;
    mostra();
    P('ass-avanti').focus({ preventScroll: true });
  }
  function chiudi() { pulisci(); box.hidden = true; }

  P('ass-avanti').addEventListener('click', avanti);
  P('ass-indietro').addEventListener('click', indietro);
  P('ass-chiudi').addEventListener('click', chiudi);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) chiudi(); });

  return { avvia, chiudi, aperto: () => !box.hidden };
}
