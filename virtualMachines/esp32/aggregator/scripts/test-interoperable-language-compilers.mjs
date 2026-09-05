import assert from 'node:assert/strict';
import { compileCobolishToPmachine, compileVbishToPmachine } from './compile-interoperable-language.mjs';

function assertPmachineArtifact(language, artifact, runtimeKind, runtimeId) {
  assert.equal(artifact.language, language);
  assert.equal(artifact.runtimeUnit?.kind, runtimeKind);
  assert.equal(artifact.runtimeUnit?.id, runtimeId);
  assert.equal(typeof artifact.pcodeText, 'string');
  assert.ok(artifact.pcodeText.length > 0, `${language} did not emit pcode`);
  assert.ok(artifact.programMap, `${language} did not emit a program map`);
  assert.ok(artifact.native?.valid, `${language} native parse was not valid`);
}

const cobolish = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. PAYMENTS.',
  'PULSE SERVICE "payments-core" ON LOCAL.',
  'PROCEDURE DIVISION.',
  '    INTEROP PASCALISH "router-mapper" AS ROUTER-MAPPER.',
  '    DISPLAY "READY".',
  '    GOBACK.',
  'END PROGRAM PAYMENTS.'
].join('\n');

const vbish = [
  'Daemon "sync-daemon" On Local Every 5 S',
  'Interop COBOLISH "payments-core" As PaymentsCore',
  'Sub Main()',
  '  Dim status As String',
  '  status = "ready"',
  'End Sub'
].join('\n');

const cobolArtifact = compileCobolishToPmachine(cobolish, { fileName: 'payments.cob' });
const vbArtifact = compileVbishToPmachine(vbish, { fileName: 'sync.vbs' });

assertPmachineArtifact('cobolish', cobolArtifact, 'service', 'payments-core');
assertPmachineArtifact('vbish', vbArtifact, 'daemon', 'sync-daemon');
assert.equal(cobolArtifact.interoperability[0]?.kind, 'PASCALISH');
assert.equal(vbArtifact.interoperability[0]?.kind, 'COBOLISH');
console.log('[interoperable-language-compilers] PASS: COBOLish and VBish emit shared PMachine artifacts');