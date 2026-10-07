import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { loadOpcodeMap } from '../../pmachines/javascript/src/opcodes.mjs';
import { parseProgramMapMappings } from '../../pmachines/javascript/src/runtime.mjs';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { parsePcode, executeProgram } from './run-js-pmachine.mjs';

const definitions = new Map();
for (const serviceId of ['blink10', 'factorialService']) {
  const source = await fs.readFile(new URL(`../../src/${serviceId}.pas`, import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source);
  const endpoint = compiled.programMap.serviceEndpoints.find((item) => item.verb === 'GET');
  assert.ok(endpoint?.entryLabel, `${serviceId} must have an executable GET endpoint`);
  definitions.set(serviceId, { compiled, endpoint });
}

const opcodeMap = await loadOpcodeMap();
const blinkFsmCalls = [];

function invokeGet(serviceId, query = {}) {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      const definition = definitions.get(serviceId);
      if (!definition) throw new Error(`service not registered: ${serviceId}`);
      const sourceMessage = JSON.stringify({ httpVerb: 'GET', ...query });
      let pcodeText = definition.compiled.pcodeText;
      if (serviceId === 'blink10') {
        pcodeText = pcodeText.replace(/PUSH_INT 1000(?=\r?\nDELAY_MS)/g, 'PUSH_INT 0');
      }
      const result = await executeProgram({
        instructions: parsePcode(pcodeText),
        opcodeMap,
        mappingsById: parseProgramMapMappings(definition.compiled.programMap),
        queueTypesByName: new Map(),
        isoTypeIds: new Set(),
        inputQueue: `${serviceId}.in`,
        sourceMessage,
        startLabel: definition.endpoint.entryLabel,
        runtimeContext: {
          serviceId,
          invokeFsm: async (request) => {
            blinkFsmCalls.push(request);
            return request.operation === 'open' ? { success: true, handle: 7 } : { success: true };
          }
        },
        debugLogger: () => {}
      });
      resolve({ serviceId, response: result.response, result });
    };
    execute().catch(reject);
  });
}

const [blink, factorialFive, factorialTen, invalidFactorial] = await Promise.all([
  invokeGet('blink10'),
  invokeGet('factorialService', { n: '5' }),
  invokeGet('factorialService', { n: '10' }),
  invokeGet('factorialService', { n: '11' })
]);

assert.equal(blink.response, 'blink10 complete');
assert.equal(factorialFive.response, 120);
assert.equal(factorialTen.response, 3628800);
assert.equal(invalidFactorial.response, 0);
assert.equal(blinkFsmCalls.filter((call) => call.operation === 'set' && call.value === 'on').length, 10);
assert.equal(blinkFsmCalls.filter((call) => call.operation === 'set' && call.value === 'off').length, 10);

console.log('[pascalish-named-service-promises] PASS: Promise dispatch selected both services and preserved numeric factorial results');
