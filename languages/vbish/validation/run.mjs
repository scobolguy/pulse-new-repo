import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CASES } from './cases.mjs';
import { SPECIFICATION, summarizeCoverage, validateInventory } from './coverage.mjs';
import { createValidationRunner } from '../../dotnet/validation/runner.mjs';
import { sharedCompilerFiles } from '../../dotnet/validation/shared-files.mjs';

export const { selectCases, runValidation } = createValidationRunner({
  cases: CASES, validateInventory, summarizeCoverage,
  root: new URL('../', import.meta.url), worker: new URL('./worker.mjs', import.meta.url),
  extension: '.vb', reportName: 'vb11-js-validation.json',
  suiteName: 'Pulse VBish Validation Suite', standard: 'Microsoft Visual Basic 11 (scalar profile)',
  specification: SPECIFICATION,
  compilerFiles: [
    ...sharedCompilerFiles,
    ...['../src/compile-vb11.mjs', '../grammar/Vbish.g4', '../grammar/generated/VbishLexer.js',
      '../grammar/generated/VbishParser.js'].map(file => new URL(file, import.meta.url))
  ],
  harnessFiles: ['run.mjs', 'worker.mjs', 'coverage.mjs', 'cases.mjs', 'overload-cases.mjs', 'numeric-cases.mjs', 'integer-cases.mjs'].map(file => new URL(file, import.meta.url))
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runValidation().then(report => { process.exitCode = report.subsetPassed ? 0 : 1; })
    .catch(error => { console.error(`[VB validation] ${error.message}`); process.exitCode = 2; });
}
