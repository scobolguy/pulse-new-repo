#!/usr/bin/env node
/**
 * Deploy factorial service to ESP32 node
 * Reads factorial.service.pas, compiles to pcode, uploads and executes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function compileFactorialService() {
  try {
    // Read the factorial service source
    const serviceFile = path.join(__dirname, '../data/factorial.service.pas');
    
    if (!fs.existsSync(serviceFile)) {
      console.error(`ERROR: factorial.service.pas not found at ${serviceFile}`);
      process.exit(1);
    }
    
    const source = fs.readFileSync(serviceFile, 'utf8');
    console.log('✓ Factorial service source loaded');
    console.log(`  Lines: ${source.split('\n').length}`);
    
    // Use the existing compile + deploy infrastructure
    const { runPascalOnEsp32 } = await import('./run-pascal-on-esp32-node.mjs');
    
    // Pass the file path to runPascalOnEsp32 (not the source code)
    const result = await runPascalOnEsp32({
      source: serviceFile,
      node: 'neptune.child1',
      message: '5'  // Test with n=5
    });
    
    console.log('\n✓ Factorial service deployed successfully');
    console.log(`  Node: ${result.node}`);
    console.log(`  Host: ${result.host}`);
    console.log(`  Pcode lines: ${result.pcodeLines}`);
    console.log(`  Test result (5!):`);
    console.log(JSON.stringify(result.result, null, 2));
    
    // Test a few more values to verify consistency
    console.log('\n✓ Testing additional factorial values:');
    for (const testN of [0, 1, 3, 10]) {
      const testResult = await runPascalOnEsp32({
        source: serviceFile,
        node: 'neptune.child1',
        message: String(testN)
      });
      console.log(`  ${testN}! = ${JSON.stringify(testResult.result)}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('ERROR during deployment:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  compileFactorialService().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}

export { compileFactorialService };
