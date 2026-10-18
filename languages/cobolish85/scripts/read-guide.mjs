import fs from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

if (!process.argv[2]) throw new Error('Usage: node scripts/read-guide.mjs guide.pdf [output.txt]');
const pdf = await getDocument({ data: new Uint8Array(await fs.readFile(process.argv[2])), useSystemFonts: true }).promise;
const pages = [];
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number);
  const content = await page.getTextContent();
  pages.push(`\n--- Page ${number} ---\n${content.items.map(item => item.str || '').join(' ')}`);
}
const text = pages.join('\n');
if (process.argv[3]) await fs.writeFile(process.argv[3], text);
else console.log(text);
await pdf.destroy();
