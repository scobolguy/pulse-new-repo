import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { chromium } from 'playwright';

const repoRoot = path.resolve(process.cwd());
const inputPath = path.join(repoRoot, 'docs', 'operator-runbook-mt-pacs-sailpoint.md');
const outputPath = path.join(repoRoot, 'docs', 'operator-runbook-mt-pacs-sailpoint.pdf');

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

async function inlineMarkdownImages(markdown, docsRoot) {
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let output = '';
  let lastIndex = 0;

  for (const match of markdown.matchAll(imagePattern)) {
    const [fullMatch, altText, rawSrc] = match;
    const matchIndex = match.index ?? 0;
    output += markdown.slice(lastIndex, matchIndex);

    const src = String(rawSrc || '').trim();
    const isRemote = /^https?:\/\//i.test(src) || /^data:/i.test(src);

    if (isRemote) {
      output += fullMatch;
      lastIndex = matchIndex + fullMatch.length;
      continue;
    }

    const cleanSrc = src.replace(/^<|>$/g, '');
    const absolutePath = path.resolve(docsRoot, cleanSrc);

    try {
      const bytes = await fs.readFile(absolutePath);
      const mime = getMimeType(absolutePath);
      const dataUri = `data:${mime};base64,${bytes.toString('base64')}`;
      output += `![${altText}](${dataUri})`;
    } catch {
      output += fullMatch;
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  output += markdown.slice(lastIndex);
  return output;
}

const markdown = await fs.readFile(inputPath, 'utf8');
const docsRoot = path.dirname(inputPath);
const inlinedMarkdown = await inlineMarkdownImages(markdown, docsRoot);
const rendered = marked.parse(inlinedMarkdown);
const docsDir = path.join(repoRoot, 'docs').replace(/\\/g, '/');
const baseHref = `file:///${docsDir}/`;

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="${baseHref}">
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Segoe UI, Arial, sans-serif; line-height: 1.45; color: #111; }
    h1, h2, h3 { page-break-after: avoid; }
    img { max-width: 100%; height: auto; page-break-inside: avoid; border: 1px solid #ddd; }
    pre, code { font-family: Consolas, 'Courier New', monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px; }
  </style>
</head>
<body>${rendered}</body>
</html>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
} finally {
  await browser.close();
}

console.log(outputPath);
