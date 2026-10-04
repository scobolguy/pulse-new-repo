import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../pmachines/javascript/src/runtime.mjs';
import { loadOpcodeMap } from '../../pmachines/javascript/src/opcodes.mjs';

const pcode = [
  'FSM "OPEN", "device", "thermometer", "dht11", 4',
  'STORE handle',
  'LOAD handle',
  'PUSH_STR "on"',
  'FSM "SET", "power"',
  'STORE writeOk',
  'LOAD handle',
  'FSM "EVENT", "read"',
  'STORE actionOk',
  'LOAD handle',
  'FSM "OBSERVE", "temperature"',
  'STORE temperature',
  'LOAD handle',
  'FSM "CLOSE"',
  'STORE closeOk',
  'HALT'
].join('\n');

const requests = [];
const opcodeMap = await loadOpcodeMap();
const result = await executeProgram({
  instructions: parsePcode(pcode),
  opcodeMap,
  runtimeContext: {
    async invokeFsm(request) {
      requests.push(request);
      if (request.operation === 'open') return { success: true, handle: 41 };
      if (request.handle !== 41) return { success: false, errorMessage: 'unknown handle' };
      if (request.operation === 'set') return { success: request.member === 'power' && request.value === 'on' };
      if (request.operation === 'event') return { success: request.member === 'read' };
      if (request.operation === 'observe') return { success: true, value: '23.5' };
      if (request.operation === 'close') return { success: true };
      return { success: false, errorMessage: 'unsupported operation' };
    }
  }
});

assert.equal(result.globals.handle, 41);
assert.equal(result.globals.writeOk, 1);
assert.equal(result.globals.actionOk, 1);
assert.equal(result.globals.temperature, '23.5');
assert.equal(result.globals.closeOk, 1);
assert.deepEqual(result.fsms, []);
assert.deepEqual(requests.map(({ operation }) => operation), ['open', 'set', 'event', 'observe', 'close']);
assert.equal(requests[1].handle, 41);
assert.equal(requests[1].value, 'on');
assert.equal(requests[3].member, 'temperature');

const compiled = compilePascalishProgramWithAntlr(`
program fsm_compile_test;
var sensorHandle: integer;
var temperature: string;
begin
  sensorHandle := FSM.OPEN("device", "room-temp", "dht11", 4);
  FSM.SET(sensorHandle, "power", "on");
  FSM.EVENT(sensorHandle, "read");
  temperature := FSM.OBSERVE(sensorHandle, "temperature");
  FSM.CLOSE(sensorHandle)
end.
`);
assert.match(compiled.pcodeText, /FSM "OPEN", "device", "room-temp", "dht11", 4/);
assert.match(compiled.pcodeText, /FSM "SET", "power"/);
assert.match(compiled.pcodeText, /FSM "EVENT", "read"/);
assert.match(compiled.pcodeText, /FSM "OBSERVE", "temperature"/);
assert.match(compiled.pcodeText, /FSM "CLOSE"/);

const compiledRequests = [];
const compiledResult = await executeProgram({
  instructions: parsePcode(compiled.pcodeText),
  opcodeMap,
  runtimeContext: {
    async invokeFsm(request) {
      compiledRequests.push(request);
      if (request.operation === 'open') return { success: true, handle: 42 };
      if (request.operation === 'set') return { success: request.value === 'on' };
      if (request.operation === 'event') return { success: request.member === 'read' };
      if (request.operation === 'observe') return { success: true, value: '23.5' };
      if (request.operation === 'close') return { success: true };
      return { success: false, errorMessage: 'unsupported operation' };
    }
  }
});
assert.equal(compiledResult.globals.sensorHandle, 42);
assert.equal(compiledResult.globals.temperature, '23.5');
assert.deepEqual(compiledRequests.map(({ operation }) => operation), ['open', 'set', 'event', 'observe', 'close']);
assert.equal(compiledRequests[0].name, 'room-temp');
assert.equal(compiledRequests[0].pin, 4);

console.log('[pmachine-fsm] PASS: generic FSM handles, operations, and close lifecycle');