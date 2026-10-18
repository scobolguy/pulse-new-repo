import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';
import { extractCorpus, fixedToFree, configureSource, evaluateReport } from '../validation/corpus.mjs';
import { runWorker } from '../validation/run.mjs';

test('extract executable and support units, including sequence text on terminators', () => {
  const units = extractCorpus('*HEADER,COBOL,NC101A\n000100 STOP RUN.\n*END-OF,NC101A\n'
    + '*HEADER,COBOL,IC101A,SUBPRG,IC101B\n000100 GOBACK.\n*END-OF,IC101B     TES001\n'
    + '*HEADER,CLBRY,ALTLB\ncopy\n*END-OF,ALTLB\n');
  assert.equal(units.length, 3);
  assert.equal(units[0].role, 'program');
  assert.equal(units[1].role, 'support');
  assert.equal(units[2].role, 'data');
  assert.throws(() => extractCorpus('*HEADER,COBOL,NC101A\n'), /Unterminated/);
  assert.throws(() => extractCorpus('*HEADER,COBOL,NC101A\n*END-OF,NC102A'), /Mismatched/);
});

test('fixed-format adapter retains card lines, literals and token continuation', () => {
  const source = '000100 IDENTIFICATION DIVISION.                                         NC1014.2\n'
    + '000200*COMMENT\n000300     DISPLAY "HELLO\n000400-    " WORLD".\n';
  const free = fixedToFree(source);
  assert.match(free, /DISPLAY "HELLO WORLD"\./);
  assert.doesNotMatch(free, /NC1014|COMMENT/);
  assert.equal(free.split('\n').length, source.split('\n').length);
  assert.equal(fixedToFree('000100     DIS\n000200-    PLAY "X".'), '    DISPLAY "X".\n');
  assert.equal(configureSource('ASSIGN TO XXXXX055.'), 'ASSIGN TO "data/XXXXX055".');
});

function report(pass, total, fail = 0, deleted = 0, inspect = 0) {
  return `${pass} OF ${total} TESTS WERE EXECUTED SUCCESSFULLY\n${fail} TESTS FAILED\n`
    + `${deleted} TESTS DELETED\n${inspect} TESTS REQUIRE INSPECTION\n`;
}
test('report evaluation never treats missing output or incomplete totals as a pass', () => {
  assert.equal(evaluateReport('').outcome, 'missing_report');
  assert.equal(evaluateReport('exited 0').outcome, 'malformed_report');
  assert.equal(evaluateReport(report(1, 2)).outcome, 'malformed_report');
  assert.equal(evaluateReport(report(2, 2)).outcome, 'pass');
  assert.equal(evaluateReport(report(1, 2, 1)).outcome, 'test_failure');
  assert.equal(evaluateReport(report(1, 2, 0, 1)).outcome, 'deleted_tests');
  assert.equal(evaluateReport(report(1, 2, 0, 0, 1)).outcome, 'manual_inspection');
});

test('stuck workers time out and terminate', async () => {
  const worker = new Worker('setInterval(() => {}, 1000)', { eval: true });
  assert.equal((await runWorker(worker, {}, 100)).outcome, 'timeout');
});

test('worker errors remain errors', async () => {
  const worker = new Worker('throw new Error("fixture failure")', { eval: true });
  try {
    await assert.rejects(() => runWorker(worker, null, 30000), /fixture failure/);
  } finally {
    await worker.terminate();
  }
});
