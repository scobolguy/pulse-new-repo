import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck } from './support/trace.mjs';
import { parseCobolishWithAntlr } from '../src/cobolish-antlr-compiler.mjs';
import { preprocessCobolText } from '../src/cobol-text-preprocessor.mjs';
import { fixedToFree } from '../validation/corpus.mjs';
import { ncCases } from './ccvs/nucleus.mjs';
import { fileCases } from './ccvs/files.mjs';
import { sortCases } from './ccvs/sort.mjs';
import { icCases } from './ccvs/ic.mjs';
import { smCases } from './ccvs/sm.mjs';
import { functionCases } from './ccvs/functions.mjs';
import { segmentationDebugCases } from './ccvs/segmentation-debug.mjs';

const cases = [...ncCases, ...fileCases, ...sortCases, ...icCases, ...smCases, ...functionCases, ...segmentationDebugCases];

for (const entry of cases) {
  test(`${entry.id} syntax — ${entry.description}`, () => {
    traceProgram(import.meta.url, entry.source, { category: entry.module, ccvs: entry.ccvs.join(', ') });
    const source = entry.format === 'fixed'
      ? fixedToFree(entry.source, { debug: /WITH\s+DEBUGGING\s+MODE/i.test(entry.source) })
      : entry.source;
    const { errors } = parseCobolishWithAntlr(preprocessCobolText(source, { copybooks: entry.copybooks ?? undefined }));
    traceCheck(import.meta.url, {
      description: 'Lexer/parser diagnostics only; execution is checked by the CCVS coverage suite',
      expected: [],
      actual: errors
    });
    assert.deepEqual(errors, [], `${entry.id}: ${errors.join('\n')}`);
  });
}
