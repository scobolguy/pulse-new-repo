#!/usr/bin/env node

/**
 * Integration test: src variable in pmachine
 * 
 * Tests that 'src' variable is properly injected and accessible
 * by creating a simple program that loads and prints src
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeProgram } from './run-js-pmachine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to load opcode map
async function loadOpcodeMap() {
  const manifestPath = path.resolve(__dirname, '../../pcode/pcode-opcodes.manifest.json');
  const manifestText = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestText);
  const map = new Map();
  for (const [mnem, def] of Object.entries(manifest.opcodes || {})) {
    map.set(mnem, def);
  }
  return map;
}

// Simple pcode parser
function parsePcode(text) {
  const instructions = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    
    const parts = trimmed.split(/\s+/);
    const mnemonic = parts[0];
    const operand = parts[1] || '';
    
    instructions.push({
      mnemonic,
      operand,
      targetIndex: -1,
      strOperand: parts.slice(1).join(' ')
    });
  }
  return instructions;
}

async function runTest(name, pcode, sourceMessage, expectedOutput) {
  console.log(`\n=== Test: ${name} ===`);
  console.log(`Source message: "${sourceMessage}"`);
  
  try {
    const opcodeMap = await loadOpcodeMap();
    const instructions = parsePcode(pcode);
    
    const result = await executeProgram({
      instructions,
      opcodeMap,
      mappingsById: {},
      queueTypesByName: new Map(),
      isoTypeIds: new Set(),
      inputQueue: 'test.in',
      sourceMessage: sourceMessage,
      runtimeContext: {}
    });

    const output = (result?.stdout || []).join('\n');
    console.log(`Output: ${output.length > 0 ? output : '(empty)'}`);
    
    if (expectedOutput) {
      if (output.includes(expectedOutput)) {
        console.log(`✓ PASS`);
        return true;
      } else {
        console.log(`✗ FAIL: Expected "${expectedOutput}"`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error(`✗ ERROR: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    return false;
  }
}

async function main() {
  console.log('Testing src variable accessibility in JavaScript pmachine\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Load src and print
  if (await runTest(
    'Load src variable and print',
    `
      LOAD src
      PRINT
      PRINT_NL
      HALT
    `,
    'hello world',
    'hello world'
  )) {
    passed++;
  } else {
    failed++;
  }

  // Test 2: PARSE_INT on src
  if (await runTest(
    'Parse src as integer',
    `
      LOAD src
      PARSE_INT
      PRINT_INT
      PRINT_NL
      HALT
    `,
    '42',
    '42'
  )) {
    passed++;
  } else {
    failed++;
  }

  // Test 3: TRIM then PRINT
  if (await runTest(
    'TRIM src variable',
    `
      LOAD src
      TRIM
      PRINT
      PRINT_NL
      HALT
    `,
    '  spaced  ',
    'spaced'
  )) {
    passed++;
  } else {
    failed++;
  }

  // Test 4: TRIM then PARSE_INT
  if (await runTest(
    'TRIM then PARSE_INT on src',
    `
      LOAD src
      TRIM
      PARSE_INT
      PRINT_INT
      PRINT_NL
      HALT
    `,
    '  123  ',
    '123'
  )) {
    passed++;
  } else {
    failed++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
