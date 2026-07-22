#!/usr/bin/env node

/**
 * Test: src variable accessibility in pmachine
 * 
 * Tests that 'src' is accessible as a named variable containing the message
 */

import { executeProgram } from './run-js-pmachine.mjs';

async function runTest(testName, pcodeText, sourceMessage, expectedInOutput) {
  console.log(`\n=== Test: ${testName} ===`);
  console.log(`Source message: "${sourceMessage}"`);
  console.log(`Pcode:\n${pcodeText}\n`);

  try {
    const result = await executeProgram({
      instructions: pcodeText.split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        if (!parts[0] || parts[0].startsWith(';')) return null;
        return {
          mnemonic: parts[0],
          operand: parts[1],
          strOperand: parts.slice(1).join(' ')
        };
      }).filter(Boolean),
      opcodeMap: new Map(),
      mappingsById: {},
      inputQueue: 'test-queue',
      sourceMessage: sourceMessage
    });

    const output = result.stdout.join('\n');
    console.log(`Output:\n${output}`);
    
    if (expectedInOutput && output.includes(expectedInOutput)) {
      console.log(`✓ PASS: Found expected output: "${expectedInOutput}"`);
      return true;
    } else if (expectedInOutput) {
      console.log(`✗ FAIL: Expected to find: "${expectedInOutput}"`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`✗ ERROR: ${err.message}`);
    console.error(err.stack);
    return false;
  }
}

async function main() {
  console.log('Testing src variable accessibility\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Load src and print it
  const test1 = `
    PUSH_INT 0
    LOAD_NAME src
    PRINT
    PRINT_NL
    HALT
  `;
  if (await runTest('Load and print src', test1, 'hello world', 'hello world')) {
    passed++;
  } else {
    failed++;
  }

  // Test 2: Load src, PARSE_INT, then print result
  const test2 = `
    LOAD_NAME src
    PARSE_INT
    PRINT_INT
    PRINT_NL
    HALT
  `;
  if (await runTest('Parse src as integer', test2, '42', '42')) {
    passed++;
  } else {
    failed++;
  }

  // Test 3: Load src, TRIM, then print
  const test3 = `
    LOAD_NAME src
    TRIM
    PRINT
    PRINT_NL
    HALT
  `;
  if (await runTest('TRIM src', test3, '  spaced  ', 'spaced')) {
    passed++;
  } else {
    failed++;
  }

  // Test 4: Load src with number, PARSE_INT with TRIM
  const test4 = `
    LOAD_NAME src
    TRIM
    PARSE_INT
    PRINT_INT
    PRINT_NL
    HALT
  `;
  if (await runTest('TRIM and PARSE_INT src', test4, '  123  ', '123')) {
    passed++;
  } else {
    failed++;
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
