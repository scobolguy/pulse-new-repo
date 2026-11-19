import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compilePascalishProgramWithAntlr, assertNativeServicePcode } from '../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';

export async function buildLinkerBootstrap() {
  const source = new URL('./bootstrap-service.pas', import.meta.url);
  const compiled = compilePascalishProgramWithAntlr(await readFile(source, 'utf8'), {
    fileName: fileURLToPath(source), hostServices: true
  });
  assertNativeServicePcode(compiled.pcodeText);
  delete compiled.programMap.generatedAt;
  return compiled;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const compiled = await buildLinkerBootstrap();
  await Promise.all([
    writeFile(new URL('./linker.pcode', import.meta.url), compiled.pcodeText),
    writeFile(new URL('./linker.program.json', import.meta.url), `${JSON.stringify(compiled.programMap, null, 2)}\n`)
  ]);
}
