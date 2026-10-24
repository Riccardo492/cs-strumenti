// Batterie di domande: la batteria in Word (.docx), una versione per file.
// Il documento è costruito da zero (niente modello): A4, Arial 11, intestazione con titolo e versione,
// «Pagina X di Y» a piè di pagina, domande numerate che non si spezzano tra due pagine.
// La «copia per la commissione» evidenzia in grassetto le risposte esatte.
import { escXml } from '../../lib/formati.js';
import { LETTERE } from './stato.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const LARGHEZZA = 9638;   // A4 con margini di 2 cm, in ventesimi di punto
const t = s => `<w:t xml:space="preserve">${escXml(String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''))}</w:t>`;
const run = (s, { b = false, sz = 0, colore = '' } = {}) => `<w:r>${b || sz || colore ? `<w:rPr>${b ? '<w:b/>' : ''}${colore ? `<w:color w:val="${colore}"/>` : ''}${sz ? `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` : ''}</w:rPr>` : ''}${t(s)}</w:r>`;
const par = (contenuto, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${contenuto}</w:p>`;
const PIEDE = '<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
const campo = codice => `<w:r>${PIEDE}<w:fldChar w:fldCharType="begin"/></w:r><w:r>${PIEDE}<w:instrText xml:space="preserve"> ${codice} </w:instrText></w:r><w:r>${PIEDE}<w:fldChar w:fldCharType="separate"/></w:r><w:r>${PIEDE}<w:t>1</w:t></w:r><w:r>${PIEDE}<w:fldChar w:fldCharType="end"/></w:r>`;

function corpo({ titolo, versione, istruzioni, campi, domande, titoliMaterie, soluzioni, nomeMateria }) {
  const out = [];
  out.push(par(run(titolo || 'Prova', { b: true, sz: 28 }), '<w:jc w:val="center"/><w:spacing w:after="60"/>'));
  out.push(par(run(`${soluzioni ? 'Copia per la commissione – ' : ''}Versione ${versione}`, { b: true, sz: 24, colore: soluzioni ? 'A3332B' : '' }), '<w:jc w:val="center"/><w:spacing w:after="240"/>'));
  if (campi) {
    // le righe da riempire sono tabulazioni con riempimento a trattino basso: occupano esattamente la riga
    out.push(par(run('Cognome e nome ') + '<w:r><w:tab/></w:r>' + run('   Codice ') + '<w:r><w:tab/></w:r>',
      `<w:tabs><w:tab w:val="left" w:leader="underscore" w:pos="6900"/><w:tab w:val="right" w:leader="underscore" w:pos="${LARGHEZZA}"/></w:tabs><w:spacing w:after="240"/>`));
  }
  if (istruzioni && istruzioni.trim()) {
    const bordo = '<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="9AA5B3"/><w:left w:val="single" w:sz="4" w:space="4" w:color="9AA5B3"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="9AA5B3"/><w:right w:val="single" w:sz="4" w:space="4" w:color="9AA5B3"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F1F3F6"/>';
    out.push(par(run('Istruzioni: ', { b: true }) + run(istruzioni.trim()), `${bordo}<w:spacing w:after="320"/><w:ind w:left="85" w:right="85"/>`));
  }
  let materiaPrima = null;
  for (const d of domande) {
    if (titoliMaterie && d.q.materia !== materiaPrima) {
      materiaPrima = d.q.materia;
      out.push(par(run(nomeMateria(d.q.materia).toUpperCase(), { b: true, sz: 20, colore: '4A5563' }), '<w:keepNext/><w:spacing w:before="280" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="C4CBD4"/></w:pBdr>'));
    }
    out.push(par(run(`${d.n}.`, { b: true }) + '<w:r><w:tab/></w:r>' + run(d.q.testo), '<w:keepNext/><w:keepLines/><w:spacing w:before="200" w:after="60"/><w:ind w:left="425" w:hanging="425"/>'));
    d.risposte.forEach((r, i) => {
      const giusta = soluzioni && i === d.esatta;
      const ultima = i === d.risposte.length - 1;
      out.push(par(run(`${LETTERE[i]})`, { b: giusta }) + '<w:r><w:tab/></w:r>' + run(r, { b: giusta }) + (giusta ? run('  ✓', { b: true, colore: '226C48' }) : ''),
        `${ultima ? '' : '<w:keepNext/>'}<w:keepLines/><w:spacing w:after="${ultima ? 40 : 20}"/><w:ind w:left="765" w:hanging="340"/>`));
    });
  }
  return out.join('');
}

function file({ titolo, versione, ...resto }) {
  const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
  return {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdT" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
    'word/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`,
    'word/settings.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${W}><w:defaultTabStop w:val="425"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
    'word/header1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${W}>${par(run(titolo || '', { sz: 18, colore: '5A6574' }) + '<w:r><w:tab/></w:r>' + run(`Versione ${versione}`, { b: true, sz: 18 }), `<w:tabs><w:tab w:val="right" w:pos="${LARGHEZZA}"/></w:tabs><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="C4CBD4"/></w:pBdr>`)}</w:hdr>`,
    'word/footer1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${W}>${par(`<w:r>${PIEDE}<w:t xml:space="preserve">Versione ${escXml(versione)} · Pagina </w:t></w:r>${campo('PAGE')}<w:r>${PIEDE}<w:t xml:space="preserve"> di </w:t></w:r>${campo('NUMPAGES')}`, '<w:jc w:val="center"/>')}</w:ftr>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${corpo({ titolo, versione, ...resto })}${sect}</w:body></w:document>`,
  };
}

/** Una versione della batteria → Blob .docx */
export async function creaDocx(opz) {
  const z = new JSZip();
  for (const [p, d] of Object.entries(file(opz))) z.file(p, d);
  return z.generateAsync({ type: 'blob', mimeType: DOCX, compression: 'DEFLATE' });
}

/** Più file → Blob .zip */
export async function creaZip(voci) {
  const z = new JSZip();
  for (const v of voci) z.file(v.nome, v.blob);
  return z.generateAsync({ type: 'blob', mimeType: 'application/zip', compression: 'STORE' });
}
