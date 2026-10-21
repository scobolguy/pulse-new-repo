import { compileRouterMapperDSL } from '../src/compile-pascal.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/aggregator/scripts/run-js-pmachine.mjs';
import { loadOpcodeMap } from '../../../virtualMachines/esp32/aggregator/scripts/pmachine-js-opcodes.mjs';

const pascalSrc = `
program "test-fib";
var
  i : integer;
  a : integer;
  b : integer;
  temp : integer;
begin
  a := 0;
  b := 1;
  writeln('Fib(1) = 1');
  for i := 2 to 10 do
  begin
    temp := a + b;
    a := b;
    b := temp;
    writeln('Fib(', i, ') = ', b);
  end;
end.
`;

const compiled = compileRouterMapperDSL(pascalSrc);
console.log('PCode:');
console.log(compiled.pcodeText);

const result = await executeProgram({
  instructions: parsePcode(compiled.pcodeText),
  opcodeMap: await loadOpcodeMap(),
  mappingsById: new Map(),
  queueTypesByName: new Map(),
  isoTypeIds: new Set(),
  inputQueue: 'test-fib.run',
  sourceMessage: '',
  runtimeContext: {}
});

console.log('Output lines:');
console.log(result.stdout);
