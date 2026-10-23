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

export const ID_ESEMPIO = ['0012', '0027', '0031', '0045'];

export function fileDiEsempio() {
  return ID_ESEMPIO.map(id => ({
    nome: `elaborato_${id}.pdf`,
    blob: pdfDiProva(['CONCORSO PUBBLICO - PROVA SCRITTA', `ID elaborato: ${id}`, 'Data della prova: 28/10/2026', 'Documento di esempio con dati inventati.']),
  }));
}

/* L'elaborato 0045 non è nell'Excel e la riga 0050 non ha il suo PDF: così si vedono entrambi gli avvisi. */
export const EXCEL_ESEMPIO = {
  nome: 'abbinamento di esempio',
  intestazioni: ['ID ELABORATO', 'COGNOME', 'NOME', 'CODICE FISCALE'],
  righe: [
    ['0012', 'ROSSI', 'MARIO', 'RSSMRA80A01H501U'],
    ['0027', 'BIANCHI', 'LAURA', 'BNCLRA92C55B354B'],
    ['0031', 'VERDI', 'GIOVANNI', 'VRDGNN88S07H118A'],
    ['0050', 'NERI', 'ANNA', ''],
  ],
};
export const MODELLO_ESEMPIO = '{COGNOME}_{NOME}_{CODICE FISCALE}';
