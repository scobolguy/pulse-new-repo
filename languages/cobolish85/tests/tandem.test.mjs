import assert from 'node:assert/strict';
import { traceProgram, traceCheck, traceCompileError } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createIsamBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/isam-bindings.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';

const source = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. CUSTOMER-INDEX.',
  'ENVIRONMENT DIVISION.',
  'INPUT-OUTPUT SECTION.',
  'FILE-CONTROL.',
  'SELECT CUSTOMER-FILE ASSIGN TO "data/customers.isam"',
  '  ORGANIZATION IS INDEXED',
  '  ACCESS MODE IS DYNAMIC',
  '  RECORD KEY IS CUSTOMER-ID',
  '  FILE STATUS IS FS-CODE.',
  'DATA DIVISION.',
  'FILE SECTION.',
  'FD CUSTOMER-FILE.',
  '01 CUSTOMER-RECORD PIC X(80).',
  'WORKING-STORAGE SECTION.',
  '01 CUSTOMER-ID PIC X(8).',
  '01 FS-CODE PIC X(2).',
  'PROCEDURE DIVISION.',
  'MOVE "001" TO CUSTOMER-ID.',
  'MOVE "customer-one" TO CUSTOMER-RECORD.',
  'OPEN OUTPUT CUSTOMER-FILE.',
  'WRITE CUSTOMER-RECORD.',
  'CLOSE CUSTOMER-FILE.',
  'OPEN I-O CUSTOMER-FILE.',
  'READ CUSTOMER-FILE KEY IS CUSTOMER-ID INTO CUSTOMER-RECORD.',
  'START CUSTOMER-FILE KEY IS >= CUSTOMER-ID.',
  'READ CUSTOMER-FILE NEXT RECORD INTO CUSTOMER-RECORD',
  '  AT END DISPLAY "EOF"',
  'END-READ.',
  'REWRITE CUSTOMER-RECORD FROM CUSTOMER-RECORD',
  '  NOT INVALID KEY DISPLAY "REWRITE OK".',
  'DELETE CUSTOMER-FILE.',
  'CLOSE CUSTOMER-FILE.',
  'STOP RUN.'
].join('\n');

traceProgram(import.meta.url, source);
const result = compileTandemCobol85ToPcode(source, { fileName: 'customer-index.cob' });
const isamBindings = ['host.isam_open', 'host.isam_write', 'host.isam_close', 'host.isam_start',
  'host.isam_read_next', 'host.isam_rewrite', 'host.isam_delete'];
traceCheck(import.meta.url, {
  description: 'Program map and ISAM host calls emitted by the compiler',
  expected: {
    sourceLanguage: 'tandem-cobol85', organization: 'INDEXED', keyName: 'CUSTOMER_ID',
    isamCalls: isamBindings, requiredHostCapabilities: ['filesystem.read', 'filesystem.write']
  },
  actual: {
    sourceLanguage: result.programMap.sourceLanguage,
    organization: result.programMap.files.CUSTOMER_FILE?.organization,
    keyName: result.programMap.files.CUSTOMER_FILE?.keyName,
    isamCalls: isamBindings.filter(binding => new RegExp(`CALL_EXT ${binding}\\b`).test(result.pcodeText)),
    requiredHostCapabilities: result.programMap.requiredHostCapabilities
  }
});
assert.equal(result.programMap.sourceLanguage, 'tandem-cobol85');
assert.equal(result.programMap.executionModel, 'tandem-cobol85-program');
assert.equal(result.programMap.files.CUSTOMER_FILE.organization, 'INDEXED');
assert.equal(result.programMap.files.CUSTOMER_FILE.keyName, 'CUSTOMER_ID');
for (const binding of [
  'host.isam_open', 'host.isam_write', 'host.isam_close', 'host.isam_start',
  'host.isam_read_next', 'host.isam_rewrite', 'host.isam_delete'
]) {
  assert.match(result.pcodeText, new RegExp(`CALL_EXT ${binding}\\b`));
}
assert.match(result.pcodeText, /PUSH_STR "REWRITE OK"/);
assert.deepEqual(result.programMap.requiredHostCapabilities, ['filesystem.read', 'filesystem.write']);

const storedFiles = new Map();
const persistedRecords = [];
const storageHandlers = {
  'host.fs_exists': async (_root, filePath) => Number(storedFiles.has(filePath)),
  'host.fs_read_text': async (_root, filePath) => storedFiles.get(filePath),
  'host.fs_write_text': async (_root, filePath, contents) => {
    storedFiles.set(filePath, contents);
    persistedRecords.push(JSON.parse(contents).records);
    return 0;
  }
};
const bindings = { ...createDesktopTextBindings(), ...createIsamBindings(storageHandlers) };
const execution = await executeProgram({
  instructions: parsePcode(result.pcodeText),
  inputQueue: '',
  sourceMessage: '',
  runtimeContext: {
    callHost: (name, args) => bindings[name](...args, { signal: new AbortController().signal })
  }
});
const finalRecords = storedFiles.has('customers.isam') ? JSON.parse(storedFiles.get('customers.isam')).records : 'file not written';
traceCheck(import.meta.url, {
  description: 'DISPLAY output contains REWRITE OK; ISAM file is empty after DELETE',
  expected: { stdoutContains: 'REWRITE OK', finalRecords: [] },
  actual: { stdout: execution.error ? `Runtime error: ${execution.error}` : execution.stdout, finalRecords },
  matched: execution.error === null && execution.stdout.join('\n').includes('REWRITE OK')
    && Array.isArray(finalRecords) && finalRecords.length === 0
});
assert.equal(execution.error, null);
assert.match(execution.stdout.join('\n'), /REWRITE OK/);
assert.ok(persistedRecords.some(records =>
  JSON.stringify(records) === JSON.stringify([['001'.padEnd(8), 'customer-one'.padEnd(80)]])));
assert.deepEqual(JSON.parse(storedFiles.get('customers.isam')).records, []);

const badFileSource = [
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. BAD-FILE.',
  'ENVIRONMENT DIVISION.',
  'INPUT-OUTPUT SECTION.',
  'FILE-CONTROL.',
  'SELECT CUSTOMER-FILE ASSIGN TO "data/customers.dat" ORGANIZATION IS SEQUENTIAL.',
  'DATA DIVISION.',
  'FILE SECTION.',
  'FD CUSTOMER-FILE.',
  '01 CUSTOMER-RECORD PIC X(80).',
  'WORKING-STORAGE SECTION.',
  '01 CUSTOMER-ID PIC X(8).',
  'PROCEDURE DIVISION.',
  'OPEN INPUT CUSTOMER-FILE.',
  'START CUSTOMER-FILE KEY IS >= CUSTOMER-ID.',
  'STOP RUN.'
].join('\n');
traceCompileError(import.meta.url, compileTandemCobol85ToPcode, badFileSource, /START is not valid for sequential files/);
assert.throws(() => compileTandemCobol85ToPcode(badFileSource), /START is not valid for sequential files/);

console.log('[tandem-cobol85-compiler] PASS');
