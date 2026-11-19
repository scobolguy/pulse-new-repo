#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sizes = Object.freeze({ n8: 0x50000, n16: 0x100000 });

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key || !key.startsWith('--') || argv[i + 1] === undefined) {
      throw new Error('options must be supplied as --name value pairs');
    }
    if (args[key]) throw new Error(`duplicate option ${key}`);
    args[key] = argv[i + 1];
  }
  return args;
}

function requirePairId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,14}$/.test(value)) {
    throw new Error('--pair-id must be a 1..15 byte ASCII identifier');
  }
  return value;
}

function findMklittlefs() {
  const candidates = [
    process.env.PIO_MKLITTLEFS,
    path.join(os.homedir(), '.platformio', 'packages', 'tool-mklittlefs',
      process.platform === 'win32' ? 'mklittlefs.exe' : 'mklittlefs'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return 'mklittlefs';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = args['--profile'];
  if (!(profile in sizes)) throw new Error('--profile must be n8 or n16');
  const pairId = requirePairId(args['--pair-id']);
  const output = path.resolve(args['--out'] || path.join(project, '.pio',
    `bootfs-${profile}-${pairId}.bin`));
  const stage = path.join(project, '.pio', 'ota-bootfs-stage', `${profile}-${pairId}`);
  const bootSource = path.join(project, 'data', 'boot', 'pmachine-boot');
  const provisioningProgramSource = path.join(project, 'data', 'boot', 'pmachine-provisioning');
  const provisioningPageSource = path.join(project, 'data', 'web', 'provisioning.html');
  if (!existsSync(bootSource) || !existsSync(provisioningProgramSource) || !existsSync(provisioningPageSource)) {
    throw new Error('boot image requires both boot P-code programs and data/web/provisioning.html');
  }

  rmSync(stage, { recursive: true, force: true });
  mkdirSync(path.join(stage, 'boot'), { recursive: true });
  mkdirSync(path.join(stage, 'web'), { recursive: true });
  copyFileSync(bootSource, path.join(stage, 'boot', 'pmachine-boot'));
  copyFileSync(provisioningProgramSource, path.join(stage, 'boot', 'pmachine-provisioning'));
  copyFileSync(provisioningPageSource, path.join(stage, 'web', 'provisioning.html'));
  const programMap = path.join(project, 'data', 'boot', 'program.map');
  if (existsSync(programMap)) {
    copyFileSync(programMap, path.join(stage, 'boot', 'program.map'));
  }
  writeFileSync(path.join(stage, 'boot', 'ota-pair-id'), pairId, 'ascii');
  mkdirSync(path.dirname(output), { recursive: true });

  try {
    execFileSync(findMklittlefs(), [
      '-c', stage,
      '-p', '256',
      '-b', '4096',
      '-s', String(sizes[profile]),
      output,
    ], { stdio: 'inherit' });
    const actualSize = statSync(output).size;
    if (actualSize !== sizes[profile]) {
      throw new Error(`LittleFS image is ${actualSize} bytes; expected ${sizes[profile]}`);
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  console.log(`BootFS image: ${output} (${sizes[profile]} bytes; local boot closure only)`);
}

try {
  main();
} catch (error) {
  console.error(`BootFS build failed: ${error.message}`);
  process.exitCode = 1;
}
