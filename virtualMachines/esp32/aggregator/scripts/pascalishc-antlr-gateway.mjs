import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    mapOut: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('-') && !args.input) {
      args.input = token;
      continue;
    }
    if (token === '--in') {
      args.input = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '-o' || token === '--out') {
      args.out = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === '--map-out') {
      args.mapOut = argv[index + 1];
      index += 1;
      continue;
    }
  }

  if (!args.input) {
    throw new Error('Usage: pascalishc <input.pas> -o <output.pcode> [--map-out <output.program.json>]');
  }

  if (!args.out) {
    args.out = args.input.replace(/\.[^.]+$/, '') + '.pcode';
  }

  if (!args.mapOut) {
    args.mapOut = args.out.replace(/\.pcode$/i, '.program.json');
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outPath = path.resolve(args.out);
  const mapOutPath = path.resolve(args.mapOut);

  const sourceText = await fs.readFile(inputPath, 'utf-8');
  const compiled = compilePascalishProgramWithAntlr(sourceText);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.mkdir(path.dirname(mapOutPath), { recursive: true });

  await fs.writeFile(outPath, compiled.pcodeText, 'utf-8');
  await fs.writeFile(mapOutPath, `${JSON.stringify(compiled.programMap, null, 2)}\n`, 'utf-8');

  console.log(`[pascalishc-antlr] Input: ${path.relative(process.cwd(), inputPath)}`);
  console.log(`[pascalishc-antlr] Output (.pcode): ${path.relative(process.cwd(), outPath)}`);
  console.log(`[pascalishc-antlr] Output (program map): ${path.relative(process.cwd(), mapOutPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[pascalishc-antlr] Failed: ${error.message}`);
    process.exitCode = 1;
  });
}
