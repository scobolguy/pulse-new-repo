import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadOpcodeMap } from '../../pmachines/javascript/src/opcodes.mjs';
import { parseProgramMapMappings } from '../../pmachines/javascript/src/runtime.mjs';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { parsePcode, executeProgram } from './run-js-pmachine.mjs';

const source = await fs.readFile(new URL('../data/blink10.pas', import.meta.url), 'utf8');
const compiled = compilePascalishProgramWithAntlr(source);
const endpoint = compiled.programMap.serviceEndpoints.find((item) => item.verb === 'GET');
assert.ok(endpoint, 'GET endpoint should be present');
assert.equal(endpoint.path, '/');
assert.equal(endpoint.entryLabel, 'SERVICE_ENDPOINT_1');
assert.ok(compiled.pcodeText.includes(`${endpoint.entryLabel}:`), 'GET entry label should be emitted');
assert.equal(Object.hasOwn(endpoint, 'body'), false, 'AST body should not be serialized into the program map');

const fastPcode = compiled.pcodeText.replace(/PUSH_INT 1000(?=\r?\nDELAY_MS)/g, 'PUSH_INT 0');
const calls = [];
const result = await executeProgram({
  instructions: parsePcode(fastPcode),
  opcodeMap: await loadOpcodeMap(),
  mappingsById: parseProgramMapMappings(compiled.programMap),
  queueTypesByName: new Map(),
  isoTypeIds: new Set(),
  inputQueue: 'blink10.in',
  sourceMessage: JSON.stringify({ httpVerb: 'GET' }),
  startLabel: endpoint.entryLabel,
  runtimeContext: {
    serviceId: 'blink10',
    invokeFsm: async (request) => {
      calls.push(request);
      return request.operation === 'open'
        ? { success: true, handle: 7 }
        : { success: true };
    }
  },
  debugLogger: () => {}
});

assert.equal(result.response, 'blink10 complete');
assert.equal(calls.length, 22);
assert.equal(calls[0].operation, 'open');
assert.equal(calls[0].name, 'LEDPIN');
assert.equal(calls[0].pin, 2);
assert.equal(calls.filter((call) => call.operation === 'set' && call.value === 'on').length, 10);
assert.equal(calls.filter((call) => call.operation === 'set' && call.value === 'off').length, 10);
assert.equal(calls.at(-1).operation, 'close');
assert.equal(result.globals.i, 11);
console.log('[pascalish-service-endpoint-execution] PASS: GET endpoint ran ten LED cycles and returned its response');
