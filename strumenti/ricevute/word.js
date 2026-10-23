// Ricevute: compilazione del modello Word (modello-ricevuta.docx).
// Il modello contiene segnaposto come {{NOMINATIVO}}, {{CF}}, {{NETTO}}; la riga del «Report attività»
// che contiene {{R_ENTE}} viene ripetuta per ogni attività della ricevuta.
// Per cambiare l'aspetto della ricevuta si modifica il .docx in Word lasciando intatti i segnaposto.
import { escXml } from '../../lib/formati.js';

const URL_MODELLO = new URL('./modello-ricevuta.docx', import.meta.url);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
let M = null;

async function modello() {
  if (M) return M;
  const r = await fetch(URL_MODELLO);
  if (!r.ok) throw new Error('Non trovo il modello della ricevuta (modello-ricevuta.docx).');
  const zip = await JSZip.loadAsync(await r.arrayBuffer());
  const files = {};
  for (const [path, f] of Object.entries(zip.files)) if (!f.dir) files[path] = await f.async('uint8array');
  const doc = new TextDecoder().decode(files['word/document.xml']);
  const k = doc.indexOf('{{R_ENTE}}');
  if (k < 0) throw new Error('Nel modello manca la riga del report con {{R_ENTE}}.');
  const s = doc.lastIndexOf('<w:tr>', k), e = doc.indexOf('</w:tr>', k) + 7;
  M = { files, prima: doc.slice(0, s), riga: doc.slice(s, e), dopo: doc.slice(e) };
  return M;
}

const riempi = (xml, valori) => xml.replace(/\{\{(\w+)\}\}/g, (m, k) => escXml(valori[k] ?? ''));
const documento = r => riempi(M.prima, r.campi) + r.righeReport.map(x => riempi(M.riga, x)).join('') + riempi(M.dopo, r.campi);

function nuovoZip(sostituzioni) {
  const z = new JSZip();
  for (const [p, d] of Object.entries(M.files)) if (!(p in sostituzioni)) z.file(p, d);
  for (const [p, d] of Object.entries(sostituzioni)) z.file(p, d);
  return z;
}

/** Una ricevuta → Blob .docx */
export async function creaDocx(r) {
  await modello();
  return nuovoZip({ 'word/document.xml': documento(r) }).generateAsync({ type: 'blob', mimeType: DOCX, compression: 'DEFLATE' });
}

/** Più ricevute → Blob .zip con un .docx per ricevuta */
export async function creaZip(lista) {
  await modello();
  const out = new JSZip();
  for (const r of lista) out.file(r.file, await nuovoZip({ 'word/document.xml': documento(r) }).generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
  return out.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'STORE' });
}

/** Più ricevute → un unico .docx, una dopo l'altra (per stampare). */
export async function creaUnico(lista) {
  await modello();
  const dec = p => new TextDecoder().decode(M.files[p]);
  // nel modello la pagina 1 non ha intestazione: in un documento unico erediterebbe quella della ricevuta precedente,
  // quindi le assegniamo un'intestazione vuota
  const senzaIntestazione = s => s.replace(/<w:sectPr\b([^>]*)>(?!<w:headerReference)/g, '<w:sectPr$1><w:headerReference w:type="default" r:id="rIdHdrVuota"/>');
  let corpo = '';
  lista.forEach((r, i) => {
    const xml = documento(r);
    const b = xml.slice(xml.indexOf('<w:body>') + 8, xml.lastIndexOf('</w:body>'));
    const sp = b.lastIndexOf('<w:sectPr');
    corpo += senzaIntestazione(b.slice(0, sp)) + (i < lista.length - 1 ? '<w:p><w:pPr>' + b.slice(sp) + '</w:pPr></w:p>' : b.slice(sp));
  });
  const primo = documento(lista[0]);
  const unito = primo.slice(0, primo.indexOf('<w:body>') + 8) + corpo + '</w:body></w:document>';
  const rels = dec('word/_rels/document.xml.rels').replace('</Relationships>', '<Relationship Id="rIdHdrVuota" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header-vuota.xml"/></Relationships>');
  const ct = dec('[Content_Types].xml').replace('</Types>', '<Override PartName="/word/header-vuota.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');
  const hdr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:pPr><w:pStyle w:val="Intestazione"/></w:pPr></w:p></w:hdr>';
  return nuovoZip({ 'word/document.xml': unito, 'word/_rels/document.xml.rels': rels, '[Content_Types].xml': ct, 'word/header-vuota.xml': hdr })
    .generateAsync({ type: 'blob', mimeType: DOCX, compression: 'DEFLATE' });
}
