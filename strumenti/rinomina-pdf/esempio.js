// Dati di esempio: quattro piccoli PDF creati al volo e un Excel di abbinamento, con persone inventate.

/** PDF minimale di una pagina A4 con alcune righe di testo (solo caratteri ASCII). */
export function pdfDiProva(righe) {
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const flusso = righe.map((r, i) => `BT /F1 ${i === 0 ? 15 : 12} Tf 72 ${760 - i * 24} Td (${esc(r)}) Tj ET`).join('\n');
  const oggetti = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${flusso.length} >>\nstream\n${flusso}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const pos = oggetti.map((o, i) => { const p = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return p; });
  const xref = out.length;
  out += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([out], { type: 'application/pdf' });
}

// codici inventati, nello stesso formato degli ID elaborato della piattaforma
export const ID_ESEMPIO = ['k3m9xq2pa', 'p2vh8sy6e', 'r7td4wn1c', 'x5bq1lm9t'];

export function fileDiEsempio() {
  return ID_ESEMPIO.map(id => ({
    nome: `ID_Elaborato_${id}.pdf`,
    blob: pdfDiProva([`ID Elaborato: ${id}`, 'Domanda #: 1', 'Risposta:', 'Elaborato di esempio con dati inventati.']),
  }));
}

/* Come l'elenco candidati esportato dalla piattaforma (Test Code). L'elaborato x5bq1lm9t non è
   nell'elenco e la candidata Neri non ha il suo PDF: così si vedono entrambi gli avvisi. */
export const EXCEL_ESEMPIO = {
  nome: 'elenco candidati di esempio',
  intestazioni: ['Test Code', 'First Name', 'Last Name', 'CF', 'ID', 'External ID'],
  righe: [
    ['TC-0101', 'Mario', 'Rossi', 'RSSMRA80A01H501U', 'INPA-0001', 'k3m9xq2pa'],
    ['TC-0102', 'Laura', 'Bianchi', 'BNCLRA92C55B354B', 'INPA-0002', 'p2vh8sy6e'],
    ['TC-0103', 'Giovanni', 'Verdi', 'VRDGNN88S07H118A', 'INPA-0003', 'r7td4wn1c'],
    ['TC-0104', 'Anna', 'Neri', '', 'INPA-0004', 'w8nc3hd5k'],
  ],
};
export const MODELLO_ESEMPIO = '{Last Name}_{First Name}_{CF}';
export const OPZIONI_ESEMPIO = { maiuscole: 'su' };
