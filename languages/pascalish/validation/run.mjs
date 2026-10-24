import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { encodeHostedImage } from '../../../virtualMachines/esp32/pmachines/shared/contracts/hosted-image.mjs';
import { checkOutput, checkNegative } from './evaluate.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { toRuntimeProgramMap, uploadFfsFile } from '../../../virtualMachines/esp32/aggregator/scripts/esp32-runtime-artifacts.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const run = promisify(execFile);

export async function onDevice(base, prefix, expected, name) {
  const pcode = await fs.readFile(prefix + '.pcode', 'utf8');
  const map = JSON.parse(await fs.readFile(prefix + '.program.json', 'utf8'));
  const image = encodeHostedImage(pcode);
  const runtimeMap = attachPcodeSignature({
    ...toRuntimeProgramMap(map), hostImageFormat: 'PHI1'
  }, image);
  const remote = `/pv-${createHash('sha256').update(name).digest('hex').slice(0, 16)}`;
  await uploadFfsFile(base, remote + '.phi', image);
  await uploadFfsFile(base, remote + '.map.json', JSON.stringify(runtimeMap));
  const response = await fetch(base + '/pmachine/execute_file', {
    method: 'POST',
    body: new URLSearchParams({ file: remote + '.phi', programMap: remote + '.map.json', max: '200000' }),
    signal: AbortSignal.timeout(30000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`ESP32 HTTP ${response.status}: ${body}`);
  const result = JSON.parse(body);
  return { ...checkOutput(result, expected), result };
}

export async function runValidation(argv = process.argv.slice(2)) {
  let device;
  let suite = 'object-pascal';
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--esp32') {
      device = argv[++index];
      if (!device) throw new Error('--esp32 requires a URL');
      const url = new URL(device);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('--esp32 requires HTTP(S)');
      device = url.href.replace(/\/+$/, '');
    } else if (argv[index] === '--suite') {
      suite = argv[++index];
      if (!['object-pascal', 'smoke', 'iso7185'].includes(suite)) throw new Error('Unknown validation suite');
    } else throw new Error(`Unknown option: ${argv[index]}`);
  }
  let cases;
  if (suite === 'object-pascal') cases = JSON.parse(await fs.readFile(path.join(root, 'cases.json'), 'utf8'));
  else if (suite === 'smoke') cases = [{ name: 'arithmetic', file: 'smoke/arithmetic.pas' }];
  else cases = [{
    name: 'iso7185pat', file: 'iso7185/iso7185pat.pas',
    compileOnly: true
  }];
  const report = {
    suite, startedAt: new Date().toISOString(),
    hardware: device || 'not-run (no --esp32 URL supplied)', cases: []
  };
  const reportDir = path.resolve(root, '..', 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${suite}${device ? '-esp32' : ''}-validation.json`);
  const persist = () => fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  for (const test of cases) {
    const prefix = path.join(root, 'output', suite, test.name);
    const entry = { name: test.name, kind: test.diagnostic ? 'negative' : 'positive' };
    try {
      const sourceFile = path.join(root, test.file);
      await fs.access(sourceFile);
      const expected = test.expectedFile
        ? (await fs.readFile(path.join(root, test.expectedFile), 'utf8')).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
        : [`TEST ${test.name}: OK`];
      const { stdout, stderr } = await run(process.execPath, [
        path.join(root, 'worker.mjs'), sourceFile, prefix,
        test.diagnostic ? 'negative' : test.compileOnly ? 'compile-only' : 'positive'
      ], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
      if (stderr) entry.stderr = stderr;
      const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
      entry.compiler = result.stage === 'compile-error' ? { error: result.error } : { accepted: true };
      if (test.diagnostic) Object.assign(entry, checkNegative(result, test.diagnostic));
      else if (test.compileOnly && result.stage === 'compiled') {
        Object.assign(entry, {
          status: 'blocked',
          reason: 'PAT execution requires standard input/text-file support and a reviewed platform-specific output baseline'
        });
      }
      else if (result.stage !== 'executed') {
        Object.assign(entry, { status: 'fail', reason: result.error });
      } else {
        entry.desktop = { ...checkOutput(result.result, expected), result: result.result };
        entry.status = entry.desktop.status;
      }
      if (device && !test.diagnostic && !test.compileOnly) {
        if (result.stage === 'compile-error') entry.esp32 = { status: 'blocked', reason: 'Compilation failed' };
        else {
          try {
            entry.esp32 = await onDevice(device, prefix, expected, test.name);
          } catch (error) {
            entry.esp32 = { status: 'fail', reason: error.message };
          }
          if (entry.esp32.status !== 'pass') entry.status = 'fail';
        }
      }
      if (entry.esp32) {
        for (const line of entry.esp32.result?.stdout || [])
          console.log(`[ESP32 ${test.name}] ${line}`);
        if (entry.esp32.status !== 'pass')
          console.error(`[ESP32 ${test.name}] ${entry.esp32.reason || 'Execution failed'}`);
      }
    } catch (error) {
      entry.status = 'fail';
      entry.reason = `Validation infrastructure: ${error.message}`;
      if (error.stderr) entry.stderr = error.stderr;
    }
    report.cases.push(entry);
    console.log(`${entry.status.toUpperCase()} ${test.name}${entry.reason ? ': ' + entry.reason : ''}`);
    await persist();
  }
  report.finishedAt = new Date().toISOString();
  report.counts = Object.fromEntries(['pass', 'fail', 'blocked'].map(status =>
    [status, report.cases.filter(entry => entry.status === status).length]));
  await persist();
  console.log(JSON.stringify({ report: reportFile, ...report.counts }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runValidation().then(report => {
    process.exitCode = report.counts.fail || report.counts.blocked ? 1 : 0;
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
