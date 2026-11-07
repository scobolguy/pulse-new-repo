import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CASES } from './cases.mjs';
import { SPECIFICATION, summarizeCoverage, validateInventory } from './coverage.mjs';
import { createValidationRunner } from '../../dotnet/validation/runner.mjs';
import { sharedCompilerFiles } from '../../dotnet/validation/shared-files.mjs';

export const { selectCases, runValidation } = createValidationRunner({
  cases: CASES, validateInventory, summarizeCoverage,
  root: new URL('../', import.meta.url), worker: new URL('./worker.mjs', import.meta.url),
  extension: '.cs', reportName: 'ecma334-js-validation.json',
  suiteName: 'Pulse C# Validation Suite', standard: 'ECMA-334 C# 7', specification: SPECIFICATION,
  compilerFiles: [
    ...sharedCompilerFiles,
    ...['Csharp.g4', 'generated/CsharpLexer.js', 'generated/CsharpParser.js']
      .map(file => new URL(`../grammar/${file}`, import.meta.url)),
    ...['parser.mjs', 'semantics.mjs', 'compile-csharp-to-pcode.mjs'].map(file => new URL(`../src/${file}`, import.meta.url))
  ],
  harnessFiles: ['run.mjs', 'worker.mjs', 'evaluate.mjs', 'coverage.mjs', 'cases.mjs', 'extended-cases.mjs', 'overload-cases.mjs', 'numeric-cases.mjs', 'integer-cases.mjs']
    .map(file => new URL(file, import.meta.url))
});

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runValidation().then(report => { process.exitCode = report.subsetPassed ? 0 : 1; })
    .catch(error => { console.error(`[C# validation] ${error.message}`); process.exitCode = 2; });
}
