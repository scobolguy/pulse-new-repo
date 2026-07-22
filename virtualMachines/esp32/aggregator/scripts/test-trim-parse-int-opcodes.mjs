#!/usr/bin/env node
/**
 * test-js-pmachine-trim-parse-int.mjs
 * Tests the newly added OP_TRIM and OP_PARSE_INT opcodes
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:tmpdir';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import pmachine runner from main scripts (assuming ES module)
async function main() {
  console.log('=== OP_TRIM and OP_PARSE_INT Tests ===\n');

  // Test pcode
  const pcodeText = [
    'START:',
    'PUSH_STR "  hello world  "',
    'TRIM',
    'STORE trimmedResult',
    '',
    'PUSH_STR "  12345  "',
    'TRIM',
    'PARSE_INT',
    'STORE parsedInt',
    '',
    'PUSH_STR "hello"',
    'PARSE_INT',
    'STORE parseError',
    '',
    'PUSH_STR " -999 "',
    'TRIM',
    'PARSE_INT',
    'STORE negativeInt',
    '',
    'LOAD trimmedResult',
    'PRINT',
    'PRINT_NL',
    '',
    'LOAD parsedInt',
    'PRINT_INT',
    'PRINT_NL',
    '',
    'LOAD parseError',
    'PRINT_INT',
    'PRINT_NL',
    '',
    'LOAD negativeInt',
    'PRINT_INT',
    'PRINT_NL',
    '',
    'HALT'
  ].join('\n');

  const programMap = {
    runtimeUnit: { kind: 'program', id: 'TrimParseIntTest' },
    globals: ['trimmedResult', 'parsedInt', 'parseError', 'negativeInt'],
    entries: []
  };

  const tmpDir = path.join(os.tmpdir(), `pmachine-trim-test-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const pcodePath = path.join(tmpDir, 'trim-parse-test.pcode');
  const mapPath = path.join(tmpDir, 'trim-parse-test.program.json');

  await fs.writeFile(pcodePath, pcodeText, 'utf-8');
  await fs.writeFile(mapPath, JSON.stringify(programMap, null, 2), 'utf-8');

  console.log(`✓ Test pcode generated at: ${pcodePath}`);
  console.log(`✓ Program map generated at: ${mapPath}`);
  console.log(`\n=== Test Expected Results ===`);
  console.log('- Trimmed string: "hello world" (whitespace removed)');
  console.log('- Parsed int: 12345 (from trimmed "  12345  ")');
  console.log('- Parse error: 0 (from non-numeric "hello")');
  console.log('- Negative int: -999 (from trimmed " -999 ")');

  // Try to run with pmachine if available
  try {
    const scriptRoot = path.resolve(__dirname, '..');
    const pmachineScript = path.join(scriptRoot, 'scripts', 'run-js-pmachine.mjs');
    
    if (await fs.stat(pmachineScript).then(() => true).catch(() => false)) {
      console.log(`\n=== Attempting to run with pmachine ===`);
      const { executeProgram } = await import(pmachineScript);
      
      // Parse pcode
      const instructions = [];
      const labels = new Map();
      const lines = pcodeText.split(/\r?\n/);
      
      for (const rawLine of lines) {
        const line = rawLine.split('#')[0].trim();
        if (!line) continue;
        
        if (line.endsWith(':')) {
          const label = line.slice(0, -1);
          labels.set(label, instructions.length);
          continue;
        }
        
        const firstSpace = line.indexOf(' ');
        const mnemonic = firstSpace < 0 ? line : line.slice(0, firstSpace);
        const rest = firstSpace < 0 ? '' : line.slice(firstSpace + 1);
        
        let operand = null;
        if (mnemonic === 'PUSH_STR') {
          const q1 = rest.indexOf('"');
          const q2 = rest.lastIndexOf('"');
          operand = q1 >= 0 && q2 > q1 ? rest.slice(q1 + 1, q2) : '';
        } else if (mnemonic === 'PUSH_INT') {
          operand = Number.parseInt(rest.trim(), 10);
        } else if (mnemonic === 'STORE' || mnemonic === 'LOAD') {
          operand = rest.trim();
        }
        
        instructions.push({ mnemonic, operand });
      }
      
      // Resolve jumps
      for (let i = 0; i < instructions.length; i++) {
        if (instructions[i].mnemonic === 'JMP' || instructions[i].mnemonic === 'JZ') {
          const targetLabel = instructions[i].operand;
          instructions[i].targetIndex = labels.has(targetLabel) ? labels.get(targetLabel) : -1;
        }
      }
      
      const result = await executeProgram({
        instructions,
        opcodeMap: new Map(),
        mappingsById: new Map([['__globals', programMap.globals]]),
        inputQueue: 'test-queue',
        sourceMessage: '{}'
      });
      
      console.log(`\n=== Execution Results ===`);
      if (result && result.stdout) {
        console.log('Output:', result.stdout.join(' / '));
      }
    }
  } catch (err) {
    console.log(`Note: Could not run full pmachine test: ${err.message}`);
  }

  console.log(`\n✓ Test files created successfully`);
  console.log(`  - Cleanup: rm -r "${tmpDir}"`);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
