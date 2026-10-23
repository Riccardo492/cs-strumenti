// Preferenza di sistema «riduci movimento»: se attiva, niente animazioni né effetti continui.
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export const riduciMovimento = () => mq.matches;
export const quandoCambiaMovimento = fn => mq.addEventListener('change', fn);
