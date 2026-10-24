// Scrittura di file Excel (.xlsx) nel browser, senza librerie dedicate: un .xlsx è uno ZIP di file XML (JSZip).
// Pensato per elenchi semplici: una riga di intestazione bloccata in alto, larghezze delle colonne,
// testo a capo dove serve, filtri sulle intestazioni.
import { escXml, colLetter } from './formati.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const STILE = { normale: 4, intestazione: 1, testo: 2, centro: 3, forte: 5 };
const pulisci = s => escXml(String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));

function nomiFogli(fogli) {
  const usati = new Set();
  return fogli.map((f, i) => {
    let base = String(f.nome || `Foglio${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Foglio${i + 1}`;
    let n = base, k = 2;
    while (usati.has(n.toLowerCase())) n = base.slice(0, 28) + ' ' + k++;
    usati.add(n.toLowerCase());
    return n;
  });
}

function foglioXml(f, primo) {
  const col = f.colonne || [];
  const righe = [col.map(c => c.titolo), ...(f.righe || [])];
  const larghezze = col.length ? `<cols>${col.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.larghezza || 14}" customWidth="1"/>`).join('')}</cols>` : '';
  const dati = righe.map((r, ri) => {
    const celle = r.map((v, ci) => {
      if (v == null || v === '') return '';
      const ref = colLetter(ci) + (ri + 1);
      const s = ri === 0 ? STILE.intestazione : STILE[col[ci]?.stile] ?? STILE.normale;
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${pulisci(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${celle}</row>`;
  }).join('');
  const blocca = f.blocca !== false && righe.length > 1 ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '';
  const filtro = f.filtri !== false && col.length && righe.length > 1 ? `<autoFilter ref="A1:${colLetter(col.length - 1)}${righe.length}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"${primo ? ' tabSelected="1"' : ''}>${blocca}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${larghezze}<sheetData>${dati}</sheetData>${filtro}</worksheet>`;
}

const STILI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EBF2"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFAEB8C6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// i filtri sulle intestazioni: Excel li vuole anche come nome nascosto nella cartella di lavoro
function filtri(fogli, nomi) {
  const d = fogli.map((f, i) => {
    const n = (f.colonne || []).length, r = (f.righe || []).length + 1;
    if (f.filtri === false || !n || r < 2) return '';
    return `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${pulisci(nomi[i].replace(/'/g, "''"))}'!$A$1:$${colLetter(n - 1)}$${r}</definedName>`;
  }).join('');
  return d ? `<definedNames>${d}</definedNames>` : '';
}

/**
 * Crea un file Excel.
 * @param fogli [{ nome, colonne: [{ titolo, larghezza, stile: 'testo'|'centro'|'forte' }], righe: [[...]], blocca?, filtri? }]
 * @returns Promise<Blob>
 */
export async function creaXlsx(fogli) {
  const nomi = nomiFogli(fogli);
  const z = new JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${fogli.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${NS}><bookViews><workbookView/></bookViews><sheets>${nomi.map((n, i) => `<sheet name="${pulisci(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${filtri(fogli, nomi)}</workbook>`);
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${fogli.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${fogli.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file('xl/styles.xml', STILI);
  fogli.forEach((f, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, foglioXml(f, i === 0)));
  return z.generateAsync({ type: 'blob', mimeType: XLSX, compression: 'DEFLATE' });
}
