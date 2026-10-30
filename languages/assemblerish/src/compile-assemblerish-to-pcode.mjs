import { compileAssemblerish } from './compiler.mjs';

export function compileAssemblerishToPcode(source, { fileName = 'program.asmish' } = {}) {
  return compileAssemblerish(source, { fileName });
}
