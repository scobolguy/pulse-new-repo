import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = path.join(root, 'virtualMachines', 'esp32', 'pmachines', 'shared', 'slot-scheduler');

export async function buildSlotScheduler({ check = false } = {}) {
  const source = await fs.readFile(path.join(directory, 'slot-scheduler.kt'), 'utf8');
  const compiled = compileKotlinToPcode(source, { fileName: 'slot-scheduler.kt', target: 'esp32' });
  const header = '#pragma once\n\nnamespace pmachine {\n'
    + 'static const char SLOT_SCHEDULER_PCODE[] = R"pulse_scheduler(\n'
    + compiled.pcodeText + ')pulse_scheduler";\n'
    + 'static const char SLOT_SCHEDULER_MAP[] = R"pulse_scheduler(\n'
    + JSON.stringify({ globals: compiled.programMap.globals, procedures: compiled.programMap.procedures })
    + ')pulse_scheduler";\n}\n';
  for (const [name, content] of [
    ['slot-scheduler.pcode', compiled.pcodeText],
    ['slot-scheduler.map.json', JSON.stringify(compiled.programMap, null, 2) + '\n'],
    ['slot_scheduler_pcode.h', header],
  ]) {
    const file = path.join(directory, name);
    if (check) {
      if (await fs.readFile(file, 'utf8') !== content) {
        throw new Error('Scheduler P-code is stale; run node languages\\kotlin\\scripts\\build-slot-scheduler.mjs');
      }
    } else {
      await fs.writeFile(file, content, 'utf8');
    }
  }
  return compiled;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(value => value !== '--check') || args.length > 1) {
    console.error('Usage: node languages\\kotlin\\scripts\\build-slot-scheduler.mjs [--check]');
    process.exitCode = 2;
  } else {
    buildSlotScheduler({ check: args.includes('--check') })
      .then(() => console.log(args.includes('--check') ? 'Scheduler P-code is current' : 'Built shared scheduler P-code'))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
