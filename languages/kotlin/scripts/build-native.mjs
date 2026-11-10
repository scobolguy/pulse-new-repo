import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildGenericNative } from '../../../virtualMachines/esp32/testing/pmachines/build-generic-native.mjs';

const [output] = process.argv.slice(2);
if (!output || process.argv.length !== 3) throw new Error('Usage: build-native.mjs <runner.exe>');
const executable = path.resolve(output);
await mkdir(path.dirname(executable), { recursive: true });
buildGenericNative(fileURLToPath(new URL('../../../virtualMachines/esp32/testing/pmachines/generic-native-runner.cpp', import.meta.url)), executable);
console.log(`Built generic PMachine runner: ${executable}`);
