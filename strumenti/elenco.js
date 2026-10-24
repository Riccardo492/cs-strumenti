// Elenco delle funzioni mostrate nel menu circolare, nell'ordine in senso orario partendo dall'alto.
// Per aggiungere una funzione: crea la cartella strumenti/<nome>/ con il suo index.js e aggiungila qui.
//
// Ogni funzione si carica per conto suo: se una ha un errore, il menu mostra le altre
// e l'errore compare solo nella console del browser. Così si lavora su una funzione senza rischiare le altre.
const CARTELLE = ['ricevute', 'abbinamento', 'controllo-domande', 'batterie-domande', 'rinomina-pdf'];

const caricate = await Promise.allSettled(CARTELLE.map(c => import(`./${c}/index.js`)));
caricate.forEach((r, i) => {
  if (r.status === 'rejected') console.error(`CS Strumenti: la funzione «${CARTELLE[i]}» non si è caricata ed è nascosta dal menu.`, r.reason);
});

export default caricate.filter(r => r.status === 'fulfilled').map(r => r.value.default);
