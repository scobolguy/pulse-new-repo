import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileAssemblerish } from './src/compiler.mjs';

export { AssemblerishCompileError, compileAssemblerish } from './src/compiler.mjs';
export { simulateAssemblerish } from './src/simulator.mjs';

function option(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  return index < 0 ? fallback : argv[index + 1] ?? fallback;
}

export async function runCompilerCli(argv = process.argv.slice(2)) {
  const input = option(argv, '--source');
  const output = option(argv, '--out');
  if (!input || !output) throw new Error('Usage: node compile.mjs --source handler.asmish --out handler.json');
  const sourcePath = path.resolve(input);
  const compiled = compileAssemblerish(await fs.readFile(sourcePath, 'utf8'), {
    fileName: path.basename(sourcePath)
  });
  const outputPath = path.resolve(output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, 'utf8');
  console.log(`Compiled ${path.relative(process.cwd(), sourcePath)} -> ${path.relative(process.cwd(), outputPath)}`);
  return compiled;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCompilerCli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
