import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../../..');
const bootSourcePath = path.join(repositoryRoot, 'virtualMachines', 'esp32', 'src', 'boot', 'boot-supervisor.kt');
const provisioningSourcePath = path.join(repositoryRoot, 'virtualMachines', 'esp32', 'src', 'boot', 'boot-provisioning.kt');
const bootOutputPath = path.join(repositoryRoot, 'virtualMachines', 'esp32', 'data', 'boot', 'pmachine-boot');
const provisioningOutputPath = path.join(repositoryRoot, 'virtualMachines', 'esp32', 'data', 'boot', 'pmachine-provisioning');

export async function buildBootSupervisor({ check = false } = {}) {
  const [bootSource, provisioningSource] = await Promise.all([
    fs.readFile(bootSourcePath, 'utf8'),
    fs.readFile(provisioningSourcePath, 'utf8')
  ]);
  const artifact = compileKotlinToPcode(bootSource, {
    fileName: 'boot-supervisor.kt',
    target: 'esp32'
  });
  const provisioningArtifact = compileKotlinToPcode(provisioningSource, {
    fileName: 'boot-provisioning.kt',
    target: 'esp32'
  });
  if (check) {
    const [existingBoot, existingProvisioning] = await Promise.all([
      fs.readFile(bootOutputPath, 'utf8'),
      fs.readFile(provisioningOutputPath, 'utf8')
    ]);
    if (existingBoot !== artifact.pcodeText || existingProvisioning !== provisioningArtifact.pcodeText) {
      throw new Error('ESP32 boot P-code is stale; run node languages/kotlin/scripts/build-boot-supervisor.mjs');
    }
    return artifact;
  }
  await fs.mkdir(path.dirname(bootOutputPath), { recursive: true });
  await Promise.all([
    fs.writeFile(bootOutputPath, artifact.pcodeText, 'utf8'),
    fs.writeFile(provisioningOutputPath, provisioningArtifact.pcodeText, 'utf8')
  ]);
  return artifact;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--check') || args.filter(argument => argument === '--check').length > 1) {
    console.error('Usage: node languages/kotlin/scripts/build-boot-supervisor.mjs [--check]');
    process.exitCode = 2;
  } else {
    buildBootSupervisor({ check: args.includes('--check') })
      .then(() => console.log(args.includes('--check') ? 'ESP32 boot P-code is current' : 'Built ESP32 boot P-code programs'))
      .catch(error => { console.error(`[BOOT BUILD] ${error.message}`); process.exitCode = 1; });
  }
}
