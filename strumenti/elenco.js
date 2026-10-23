// Elenco delle funzioni mostrate nel menu circolare, nell'ordine in senso orario partendo dall'alto.
// Per aggiungere una funzione: crea la cartella strumenti/<nome>/ con il suo index.js e aggiungila qui.
import ricevute from './ricevute/index.js';
import abbinamento from './abbinamento/index.js';
import controlloDomande from './controllo-domande/index.js';
import batterieDomande from './batterie-domande/index.js';
import rinominaPdf from './rinomina-pdf/index.js';

export default [ricevute, abbinamento, controlloDomande, batterieDomande, rinominaPdf];
