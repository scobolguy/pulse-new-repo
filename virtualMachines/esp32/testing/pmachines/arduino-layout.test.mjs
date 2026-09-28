import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceRoot = path.join(workspaceRoot, 'pmachines', 'arduino', 'src');
const testingRoot = path.join(workspaceRoot, 'testing', 'pmachines');

const productionFiles = [
  'pmachine.h',
  'pmachine.cpp',
  'pmachine_scheduler.h',
  'pmachine_scheduler.cpp',
  'pmachine_dynamic_library.h',
  'pmachine_dynamic_library.cpp',
  'pmachine_opcodes_extended.h',
  'pmachine_opcodes_extended.cpp',
  'pmachine_routes.h',
  'pmachine_routes.cpp'
];

for (const fileName of productionFiles) {
  await access(path.join(sourceRoot, fileName), constants.F_OK);
}

const testFiles = [
  'arduino-scheduler.test.cpp',
  'arduino-dynamic-library.test.cpp'
];

for (const fileName of testFiles) {
  await access(path.join(testingRoot, fileName), constants.F_OK);
}

for (const legacyName of ['pmachine_scheduler_test.cpp', 'pmachine_dynamic_library_test.cpp']) {
  try {
    await access(path.join(sourceRoot, legacyName), constants.F_OK);
    throw new Error(`Arduino PMachine test source must not remain in src: ${legacyName}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const mainSource = await readFile(path.join(workspaceRoot, 'src', 'main.cpp'), 'utf8');
if (!mainSource.includes('#ifdef ENABLE_PMACHINE') || !mainSource.includes('#include "pmachine.h"')) {
  throw new Error('Firmware entry point no longer provides the ENABLE_PMACHINE integration seam');
}

const platformIoSource = await readFile(path.join(workspaceRoot, 'platformio.ini'), 'utf8');
for (const sourceFile of productionFiles.filter(fileName => fileName.endsWith('.cpp'))) {
  if (!platformIoSource.includes('lib_extra_dirs = pmachines')) {
    throw new Error('PlatformIO configuration no longer exposes the pmachines local library directory');
  }
}

await access(path.join(workspaceRoot, 'pmachines', 'arduino', 'library.json'), constants.F_OK);
console.log(`[arduino-pmachine-layout] OK: ${productionFiles.length} runtime files, ${testFiles.length} test sources, and local library configuration are present`);