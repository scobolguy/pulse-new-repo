#!/usr/bin/env node
/**
 * Test VBish compiler with Fibonacci(1..10) calculation and execution
 */
import assert from 'node:assert/strict';
import { compileVbishToPmachine } from '../../../virtualMachines/esp32/aggregator/scripts/compile-interoperable-language.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/aggregator/scripts/run-js-pmachine.mjs';
import { loadOpcodeMap } from '../../../virtualMachines/esp32/aggregator/scripts/pmachine-js-opcodes.mjs';

const fibonacciProgram = `
Program "fibonacci-series"

Sub Main()
  Dim i As Integer
  Dim a As Integer
  Dim b As Integer
  Dim temp As Integer
  
  a = 0
  b = 1
  Print "Fib(1) = 1"
  
  For i = 2 To 10
    temp = a + b
    a = b
    b = temp
    Print "Fib(", i, ") = ", b
  Next i
End Sub
`;

console.log('='.repeat(60));
console.log('VBish Fibonacci(1..10) Compiler & Execution Test');
console.log('='.repeat(60));

try {
  const artifact = compileVbishToPmachine(fibonacciProgram, { fileName: 'fibonacci.vbs' });
  
  console.log('\n✓ Compilation Status: SUCCESS');
  console.log(`  Language: ${artifact.language}`);
  console.log(`  Runtime Kind: ${artifact.runtimeUnit?.kind}`);
  console.log(`  Program ID: ${artifact.runtimeUnit?.id}`);
  console.log(`  Valid: ${artifact.native?.valid}`);
  console.log(`  Syntax Errors: ${artifact.native?.syntaxErrorCount || 0}`);
  
  assert.equal(artifact.language, 'vbish');
  assert.equal(artifact.native.valid, true);
  
  console.log('\nExecuting on PMachine...');
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText),
    opcodeMap: await loadOpcodeMap(),
    mappingsById: new Map(),
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'fibonacci-series.run',
    sourceMessage: '',
    runtimeContext: {}
  });

  assert.deepEqual(result.stdout, [
    'Fib(1) = 1', 'Fib(2) = 1', 'Fib(3) = 2', 'Fib(4) = 3', 'Fib(5) = 5',
    'Fib(6) = 8', 'Fib(7) = 13', 'Fib(8) = 21', 'Fib(9) = 34', 'Fib(10) = 55'
  ]);
  
  console.log('\n--- Output from VBish Fibonacci Program ---');
  for (const line of result.stdout || []) {
    console.log(line);
  }
  console.log('-------------------------------------------');
  
  console.log('\n✓ VBish Fibonacci execution PASSED');
  console.log('='.repeat(60) + '\n');
} catch (error) {
  console.error('\n✗ Test FAILED:');
  console.error(error?.stack || error);
  console.error('\n' + '='.repeat(60) + '\n');
  process.exitCode = 1;
}
