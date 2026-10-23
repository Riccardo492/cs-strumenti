"""Prepara una copia del sito per l'anteprima su claude.ai.

L'anteprima non può servire file .docx/.xlsx: questo script li incorpora in un modulo JavaScript
e sostituisce lib/risorse.js con una versione che li legge da lì. Il sito vero (GitHub Pages)
non usa niente di tutto questo.

Uso:  python3 tools/anteprima.py <cartella di destinazione>
"""
import base64, os, re, shutil, subprocess, sys

dest = sys.argv[1]
radice = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
file_git = subprocess.check_output(['git', 'ls-files'], cwd=radice, text=True).split()
shutil.rmtree(dest, ignore_errors=True)
incorporati = {}
for f in file_git:
    if f.startswith('tools/') or f in ('README.md', '.nojekyll'):
        continue
    src = os.path.join(radice, f)
    if f.endswith(('.docx', '.xlsx')):
        incorporati[f] = base64.b64encode(open(src, 'rb').read()).decode()
        continue
    os.makedirs(os.path.dirname(os.path.join(dest, f)) or dest, exist_ok=True)
    shutil.copy(src, os.path.join(dest, f))

righe = ',\n'.join(f'  {f!r}: {b!r}' for f, b in incorporati.items())
open(os.path.join(dest, 'lib/risorse.js'), 'w', encoding='utf8').write(f'''// Versione per l'anteprima: i modelli sono incorporati qui sotto.
const FILE = {{
{righe}
}};
const TIPI = {{ docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }};
export async function caricaRisorsa(url) {{
  const u = decodeURIComponent(new URL(url, location.href).pathname);
  const chiave = Object.keys(FILE).find(k => u.endsWith('/' + k));
  if (!chiave) throw new Error('File non trovato: ' + u.split('/').pop());
  const bin = atob(FILE[chiave]); const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Blob([b], {{ type: TIPI[chiave.split('.').pop()] }});
}}
''')

# pagina senza <html>/<head>/<body>: le aggiunge il visualizzatore
s = open(os.path.join(radice, 'index.html'), encoding='utf8').read()
head = re.search(r'<head>(.*?)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', s, re.S).group(1)
head = re.sub(r'\s*<meta (charset|name="viewport")[^>]*>\s*', '\n', head)
open(os.path.join(dest, 'index.html'), 'w', encoding='utf8').write(head.strip() + '\n' + body)
print('\n'.join(sorted(os.path.relpath(os.path.join(d, x), dest) for d, _, fs in os.walk(dest) for x in fs)))
