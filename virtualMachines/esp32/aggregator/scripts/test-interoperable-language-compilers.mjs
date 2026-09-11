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
  'ROLE CODE_LIBRARIAN.',
  'LIBRARY "payments-common" FROM LIBRARIAN.',
  'USE "payments-common" AS CORE.',
  'IMPORT MAPPER "cbds-mt103-to-pacs008" FROM MAPPER.',
  'ROUTE "swift.mt103.parsed" TO "cbds.pacs.outbound" USING MAPPER "cbds-mt103-to-pacs008".',
  'DATA DIVISION.',
  'WORKING-STORAGE SECTION.',
  '01 INBOUND-DATA PIC X(200).',
  'PROCEDURE DIVISION.',
  '    INTEROP PASCALISH "router-mapper" AS ROUTER-MAPPER.',
  '    DISPLAY "READY".',
  '    GOBACK.',
  'END PROGRAM PAYMENTS.'
].join('\n');

const vbish = [
  'Daemon "sync-daemon" On Local Every 5 S',
  'Role Code_Librarian',
  'Library "payments-common" From Librarian',
  'Use "payments-common" As Core',
  'Import Mapper "cbds-mt103-to-pacs008" From Mapper',
  'Interop COBOLISH "payments-core" As PaymentsCore',
  'Sub Main()',
  '  Dim inbound As String From Librarian',
  '  inbound = "ready"',
  'End Sub'
].join('\n');

const cobolArtifact = compileCobolishToPmachine(cobolish, { fileName: 'payments.cob' });
const vbArtifact = compileVbishToPmachine(vbish, { fileName: 'sync.vbs' });

assertPmachineArtifact('cobolish', cobolArtifact, 'service', 'payments-core');
assertPmachineArtifact('vbish', vbArtifact, 'daemon', 'sync-daemon');
assert.equal(cobolArtifact.interoperability[0]?.kind, 'PASCALISH');
assert.equal(vbArtifact.interoperability[0]?.kind, 'COBOLISH');
assert.ok(cobolArtifact.portableSource.includes('role code_librarian'));
assert.ok(cobolArtifact.portableSource.includes('library "payments-common" from librarian'));
assert.ok(cobolArtifact.portableSource.includes('import mapper "cbds-mt103-to-pacs008" from mapper'));
assert.ok(vbArtifact.portableSource.includes('role code_librarian'));
assert.ok(vbArtifact.portableSource.includes('library "payments-common" from librarian'));
assert.ok(vbArtifact.portableSource.includes('import mapper "cbds-mt103-to-pacs008" from mapper'));
console.log('[interoperable-language-compilers] PASS: COBOLish and VBish emit shared PMachine artifacts');