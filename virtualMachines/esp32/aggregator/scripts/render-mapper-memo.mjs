import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(packageDir, '../../..');
const memoDir = path.join(repoRoot, 'documents', 'memos');
const markdownPath = path.join(memoDir, 'PULSE_MAPPER_DEPLOYMENT_MEMO.md');
const htmlPath = path.join(memoDir, 'PULSE_MAPPER_DEPLOYMENT_MEMO.html');
const pdfPath = path.join(memoDir, 'PULSE_MAPPER_DEPLOYMENT_MEMO.pdf');
const mermaidPath = path.join(packageDir, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  if (lang === 'mermaid') {
    return `<div class="mermaid">${escapeHtml(text)}</div>`;
  }
  const languageClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
};

const markdown = await readFile(markdownPath, 'utf8');
const article = marked.parse(markdown, { renderer, gfm: true });
const mermaidUrl = pathToFileURL(mermaidPath).href;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Creating and Deploying Data Mappers with Pulse</title>
  <style>
    :root { --ink: #182536; --muted: #536273; --rule: #c9d3df; --accent: #126e82; --wash: #f2f6f8; }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: white; font: 10.5pt/1.48 Georgia, 'Times New Roman', serif; }
    article { max-width: 7.35in; margin: 0 auto; }
    h1, h2, h3 { color: #123451; font-family: 'Segoe UI', Calibri, sans-serif; break-after: avoid; letter-spacing: 0; }
    h1 { margin: 0 0 12pt; padding-bottom: 9pt; border-bottom: 3px solid var(--accent); font-size: 25pt; line-height: 1.12; }
    h2 { margin: 22pt 0 7pt; font-size: 16pt; line-height: 1.2; }
    h3 { margin: 16pt 0 6pt; font-size: 12.5pt; }
    p { margin: 0 0 9pt; }
    li { margin: 2pt 0; }
    blockquote { margin: 12pt 0; padding: 8pt 12pt; border-left: 4px solid var(--accent); background: var(--wash); color: #2d4053; }
    blockquote p { margin: 0; }
    code { font: 9pt Consolas, 'Courier New', monospace; }
    p code, li code, td code { padding: 1pt 3pt; border: 1px solid #dce3e8; background: #f7f9fa; border-radius: 2px; }
    pre { margin: 10pt 0 12pt; padding: 10pt; overflow-wrap: anywhere; white-space: pre-wrap; border: 1px solid var(--rule); background: #f7f9fa; break-inside: avoid; }
    table { width: 100%; margin: 10pt 0 14pt; border-collapse: collapse; font-size: 9.5pt; break-inside: avoid; }
    th, td { padding: 6pt 7pt; border: 1px solid var(--rule); text-align: left; vertical-align: top; }
    th { color: #123451; background: #eaf1f4; font-family: 'Segoe UI', Calibri, sans-serif; }
    img { display: block; width: 100%; max-height: 6.35in; margin: 13pt auto 5pt; object-fit: contain; object-position: left top; border: 1px solid var(--rule); }
    p:has(> img) { margin-bottom: 0; break-after: avoid; }
    p:has(> img) + p { color: var(--muted); font-size: 9pt; line-height: 1.35; break-before: avoid; }
    .mermaid { display: flex; justify-content: center; margin: 12pt auto 15pt; break-inside: avoid; }
    .mermaid svg { max-width: 100%; max-height: 3in; }
    hr { margin: 20pt 0; border: 0; border-top: 1px solid var(--rule); }
    a { color: #075d70; text-decoration: none; }
    @page { size: Letter; margin: 0.7in 0.65in 0.68in; }
    @media print {
      article { max-width: none; }
      h2 { break-before: auto; }
      tr, img, blockquote { break-inside: avoid; }
    }
  </style>
  <script src="${mermaidUrl}"></script>
</head>
<body>
  <article>${article}</article>
  <script>
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });
  </script>
</body>
</html>`;

await writeFile(htmlPath, html, 'utf8');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => mermaid.run({ querySelector: '.mermaid' }));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: pdfPath,
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;padding:0 0.65in;color:#687686;font:8px Segoe UI,sans-serif;text-align:right"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '0.7in', right: '0.65in', bottom: '0.68in', left: '0.65in' },
  });
} finally {
  await browser.close();
}

console.log(`HTML: ${htmlPath}`);
console.log(`PDF:  ${pdfPath}`);