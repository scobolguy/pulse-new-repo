import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateParser } from '../../dotnet/generate-parser.mjs';

export async function generateVbishParser() {
  await generateParser(new URL('../', import.meta.url), 'Vbish');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateVbishParser().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
