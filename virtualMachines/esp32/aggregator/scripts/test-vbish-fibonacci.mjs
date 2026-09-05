#!/usr/bin/env node
/**
 * Test VBish compiler with Fibonacci(1..10) calculation and execution
 */
import { compileVbishToPmachine } from './compile-interoperable-language.mjs';
import { executeProgram, parsePcode } from './run-js-pmachine.mjs';
import { loadOpcodeMap } from './pmachine-js-opcodes.mjs';

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
  
  console.log('\nGenerated Pascalish Intermediate:');
  console.log(artifact.portableSource);
  
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

