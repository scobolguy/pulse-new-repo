import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileCobolishToPcode } from './compile-cobolish-to-pcode.mjs';

export function compileTandemCobol85ToPcode(sourceText, options = {}) {
  const result = compileCobolishToPcode(sourceText, options);
  result.programMap.sourceLanguage = 'tandem-cobol85';
  result.programMap.executionModel = 'tandem-cobol85-program';
  if (result.programMap.sourceMap) {
    result.programMap.sourceMap.sourceLanguage = 'tandem-cobol85';
    for (const location of Object.values(result.programMap.sourceMap)) {
      if (location && typeof location === 'object') location.sourceLanguage = 'tandem-cobol85';
    }
  }
  return result;
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--in', '--out', '--map-out'].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    values.set(argument, value);
    index += 1;
  }
  const input = values.get('--in');
  if (!input) throw new Error('Usage: node compile-tandem-cobol85-to-pcode.mjs --in source.cob --out program.pcode [--map-out program.json]');
  return {
    input: path.resolve(input),
    output: path.resolve(values.get('--out') || `${input}.pcode`),
    mapOutput: path.resolve(values.get('--map-out') || `${input}.program.json`)
  };
}

export async function main() {
  const args = parseArguments(process.argv.slice(2));
  const sourceText = await fs.readFile(args.input, 'utf8');
  const result = compileTandemCobol85ToPcode(sourceText, { fileName: path.basename(args.input) });
  await fs.writeFile(args.output, result.pcodeText, 'utf8');
  await fs.writeFile(args.mapOutput, `${JSON.stringify(result.programMap, null, 2)}\n`, 'utf8');
  console.log(`[TANDEM-COBOL85] Compiled ${args.input} -> ${args.output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`[TANDEM-COBOL85] ${error.message}`);
    process.exitCode = 1;
  });
}
