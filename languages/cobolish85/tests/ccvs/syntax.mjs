import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck } from '../support/trace.mjs';
import { parseCobolishWithAntlr } from '../../src/cobolish-antlr-compiler.mjs';
import { preprocessCobolText } from '../../src/cobol-text-preprocessor.mjs';
import { fixedToFree } from '../../validation/corpus.mjs';

export function registerSyntaxTests(cases, fileUrl) {
  for (const entry of cases) {
    test(`${entry.id} syntax only — ${entry.description}`, () => {
      traceProgram(fileUrl, entry.source, {
        category: `${entry.module} syntax only`,
        module: `${entry.module} (syntax only)`,
        ccvs: entry.ccvs.join(', ')
      });
      const source = entry.format === 'fixed'
        ? fixedToFree(entry.source, { debug: /WITH\s+DEBUGGING\s+MODE/i.test(entry.source) })
        : entry.source;
      const { errors } = parseCobolishWithAntlr(preprocessCobolText(source, { copybooks: entry.copybooks ?? undefined }));
      traceCheck(fileUrl, {
        description: entry.requires.length
          ? `Syntax only; execution NOT validated. Requires: ${entry.requires.join(', ')}.`
          : 'Syntax only; execution is checked separately by the CCVS coverage suite.',
        expected: [],
        actual: errors
      });
      assert.deepEqual(errors, [], `${entry.id}: ${errors.join('\n')}`);
    });
  }
}
