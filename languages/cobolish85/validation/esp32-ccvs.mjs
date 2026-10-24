import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { executableCases, syntaxOnlyCases } from '../tests/ccvs/catalog.mjs';
import { fixedToFree } from './corpus.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { toRuntimeProgramMap, uploadFfsFile } from '../../../virtualMachines/esp32/aggregator/scripts/esp32-runtime-artifacts.mjs';

export async function runEsp32Ccvs(base) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Expected an HTTP(S) ESP32 URL');
  base = url.href.replace(/\/+$/, '');
  const reportFile = new URL('../reports/ccvs-inspired-esp32.json', import.meta.url);
  await fs.mkdir(new URL('../reports/', import.meta.url), { recursive: true });
  const report = {
    suite: 'CCVS-inspired (not upstream CCVS corpus)', hardware: base,
    startedAt: new Date().toISOString(),
    syntaxOnly: syntaxOnlyCases.map(({ id, requires }) => ({ id, requires, status: 'not-executed' })),
    cases: []
  };
  const persist = () => fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  async function diagnostics() {
    const response = await fetch(base + '/ffs/diagnostics', {
      method: 'POST', signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Diagnostics HTTP ${response.status}`);
    return response.json();
  }
  report.before = await diagnostics();
  await persist();
  for (const entry of executableCases) {
    const result = { id: entry.id, module: entry.module, expected: entry.expected, stage: 'compile' };
    try {
      const source = entry.format === 'fixed'
        ? fixedToFree(entry.source, { debug: /WITH\s+DEBUGGING\s+MODE/i.test(entry.source) })
        : entry.source;
      const compiled = compileTandemCobol85ToPcode(source, {
        fileName: `${entry.id}.cob`, copybooks: entry.copybooks ?? undefined
      });
      const pcode = compiled.pcodeText;
      const map = attachPcodeSignature(toRuntimeProgramMap(compiled.programMap), pcode);
      // Reuse the same files: retaining every case fills the device's LittleFS partition.
      const remote = '/cv-run';
      result.stage = 'upload';
      await uploadFfsFile(base, remote + '.pc', pcode);
      await uploadFfsFile(base, remote + '.map.json', JSON.stringify(map));
      result.stage = 'execute';
      const response = await fetch(base + '/pmachine/execute_file', {
        method: 'POST',
        body: new URLSearchParams({
          file: remote + '.pc', programMap: remote + '.map.json', max: '200000',
          message: entry.input
        }),
        signal: AbortSignal.timeout(30000)
      });
      const body = await response.text();
      result.httpStatus = response.status;
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
      result.execution = JSON.parse(body);
      const execution = result.execution;
      const error = execution.runtimeError || execution.error || execution.flowState?.__runtime_error;
      if (error) throw new Error(`Runtime: ${error}`);
      if (execution.stepLimitHit) throw new Error('Instruction limit reached');
      if (JSON.stringify(execution.stdout) !== JSON.stringify(entry.expected))
        throw new Error('stdout differs from expected');
      result.status = 'pass';
    } catch (error) {
      result.status = 'fail';
      result.reason = error.message;
    }
    for (const line of result.execution?.stdout || []) console.log(`[ESP32 ${entry.id}] ${line}`);
    console.log(`${result.status.toUpperCase()} ${entry.id}${result.reason ? ': ' + result.reason : ''}`);
    report.cases.push(result);
    await persist();
  }
  try { report.after = await diagnostics(); }
  catch (error) { report.diagnosticsError = error.message; }
  report.finishedAt = new Date().toISOString();
  report.counts = {
    pass: report.cases.filter(entry => entry.status === 'pass').length,
    fail: report.cases.filter(entry => entry.status === 'fail').length,
    syntaxOnlyNotExecuted: report.syntaxOnly.length
  };
  await persist();
  console.log(JSON.stringify({ report: reportFile.href, ...report.counts }));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runEsp32Ccvs(process.argv[2]).then(report => {
    process.exitCode = report.counts.fail || report.diagnosticsError ? 1 : 0;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
