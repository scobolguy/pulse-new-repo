import assert from 'node:assert/strict';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4000';
const source = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. PAYMENTS-CORE.',
  'PULSE SERVICE "payments-core" ON LOCAL.',
  'PROCEDURE DIVISION.',
  '    DISPLAY "PAYMENTS READY".',
  '    GOBACK.',
  'END PROGRAM PAYMENTS-CORE.'
].join('\n');

const response = await fetch(`${baseUrl}/api/develop/compile`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ fileName: 'payments.cob', content: source, mode: 'compile-run' })
});
const payload = await response.json();

assert.equal(response.status, 200, payload.error || 'COBOLish compile-run request failed');
assert.equal(payload.language, 'cobolish');
assert.equal(payload.compile?.runtimeKind, 'service');
assert.equal(payload.compile?.programId, 'payments-core');
assert.ok(payload.run, 'COBOLish compile-run did not return a PMachine result');
assert.deepEqual(payload.run.stdout, ['PAYMENTS READY'], 'COBOLish DISPLAY output was not emitted');
assert.ok(Array.isArray(payload.run.deliveries), 'PMachine deliveries are missing');
console.log(JSON.stringify({ ok: true, compile: payload.compile, run: payload.run }, null, 2));