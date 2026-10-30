import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { compileMnfToPcode } from '../src/compile-mnf-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode, parseProgramMapMappings } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { attachPcodeSignature } from '../../../virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);

function normalize(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map(line => line.trimEnd());
  while (lines.at(-1) === '') lines.pop();
  if (/^exit 0$/.test(lines.at(-1) || '')) lines.pop();
  while (lines.at(-1) === '') lines.pop();
  return lines;
}

async function hardwareExecute(artifact, stdin, node, timeout = 45000) {
  // Source locations are debugger-only and dwarf the executable on this corpus.
  const { sourceMap, ...programMap } = artifact.programMap;
  const response = await fetch(new URL('/pmachine/execute_json', node), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeout),
    body: JSON.stringify({
      pcode: artifact.pcodeText,
      programMapText: JSON.stringify(attachPcodeSignature(programMap, artifact.pcodeText)),
      max: Buffer.byteLength(artifact.pcodeText), stdin, uartInput: false,
      inputQueue: 'mnf.hardware.validation', message: '',
    }),
  });
  const text = await response.text();
  if (!response.ok) return { error: `HTTP ${response.status}: ${text}`, transportStatus: response.status };
  const result = JSON.parse(text);
  return { ...result, error: result.runtimeError, stepCount: result.stepCount ?? null };
}

async function ready(node) {
  for (let attempt = 0; attempt < 30; ++attempt) {
    try {
      const response = await fetch(new URL('/pmachine/status', node), { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch (error) {
      if (attempt === 29) throw new Error(`Board did not recover: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Board did not become ready');
}

async function hardwareFixtures(node, names, cleanup = false) {
  for (let start = 0; start < names.length; start += 10) {
    const batch = names.slice(start, start + 10);
    const lines = cleanup ? [
      'INTEGER K',
      ...batch.flatMap(name => [
        `OPEN(12,FILE='${name}',STATUS='OLD',IOSTAT=K)`,
        "IF(K.EQ.0) CLOSE(12,STATUS='DELETE',IOSTAT=K)",
      ]),
    ] : ['LOGICAL L'];
    for (const name of batch) lines.push(
      `INQUIRE(FILE='${name}',EXIST=L)`,
      `IF(L) PRINT, '${name}'`,
    );
    if (cleanup) lines.splice(0, 0, 'LOGICAL L');
    lines.push('END');
    const artifact = compileMnfToPcode(lines.map(line => '      ' + line).join('\n'), {
      fileName: 'hardware-fixtures.ftn', standard: 'fortran77',
    });
    const result = await hardwareExecute(artifact, '', node);
    if (result.error || result.stepLimitHit) throw new Error(`Fixture ${cleanup ? 'cleanup' : 'preflight'} failed: ${result.error || 'step limit'}`);
    if (result.stdout.length) throw new Error(`${cleanup ? 'Unable to clean corpus fixtures' : 'Refusing to overwrite existing corpus filenames'}: ${result.stdout.join(', ')}`);
  }
}

async function validate(file, node, timeout) {
  const source = await fs.readFile(file, 'utf8');
  let artifact;
  try {
    artifact = compileMnfToPcode(source, { fileName: path.basename(file), standard: 'fortran77' });
  } catch (error) {
    return { status: 'compile_error', error: error.message };
  }
  try {
    let stdin = '';
    try { stdin = await fs.readFile(file.replace(/\.f$/i, '.reference_input'), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const result = node ? await hardwareExecute(artifact, stdin, node, timeout) : await executeProgram({
      instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(),
      mappingsById: parseProgramMapMappings(artifact.programMap),
      inputQueue: 'mnf.validation', sourceMessage: '', runtimeContext: { stdin },
    });
    const metrics = node ? { pcodeBytes: Buffer.byteLength(artifact.pcodeText), memoryPressure: result.memoryPressure } : {};
    if (result.error || result.stepLimitHit) return {
      status: result.transportStatus ? 'deployment_error' : 'runtime_error',
      error: result.error || 'PMachine instruction limit exceeded', steps: result.stepCount,
      output: result.stdout, ...metrics,
    };
    const actual = normalize(result.stdout.join('\n'));
    const expected = normalize(await fs.readFile(file.replace(/\.f$/i, '.reference_output'), 'utf8'));
    const first = Array.from({ length: Math.max(actual.length, expected.length) }, (_, index) => index)
      .find(index => actual[index] !== expected[index]);
    return {
      status: first === undefined ? 'passed' : 'output_mismatch', steps: result.stepCount,
      ...(first === undefined ? {} : { difference: { line: first + 1, expected: expected[first] ?? null, actual: actual[first] ?? null } }),
      failureRecords: result.stdout.filter(line => /^\s*\d+\s+FAIL\b/.test(line)),
      output: result.stdout,
      ...metrics,
    };
  } catch (error) {
    return { status: node ? 'device_error' : 'runtime_error', error: error.cause ? `${error.message}: ${error.cause.message}` : error.message };
  }
}

if (process.argv[2] === '--worker') {
  console.log(JSON.stringify(await validate(process.argv[3], process.argv[4], Number(process.argv[5]) || undefined)));
} else {
  const args = process.argv.slice(2);
  const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const unknown = args.filter((arg, index) => index % 2 === 0 && !['--filter', '--from', '--report', '--jobs', '--timeout', '--node'].includes(arg));
  if (unknown.length || args.length % 2) throw new Error('Usage: npm run validate -- [--filter FM002] [--from FM411] [--report path] [--jobs 4] [--timeout 30000] [--node http://device]');
  const node = value('--node');
  if (node && !['http:', 'https:'].includes(new URL(node).protocol)) throw new Error('node must be an HTTP(S) URL');
  const jobs = Number(value('--jobs') || (node ? 1 : 4)), timeout = Number(value('--timeout') || (node ? 180000 : 30000));
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 16 || !Number.isInteger(timeout) || timeout < 1)
    throw new Error('jobs must be 1-16; timeout must be a positive number of milliseconds');
  if (node && jobs !== 1) throw new Error('Hardware validation must run sequentially (--jobs 1)');
  const corpus = path.join(root, 'validation', 'corpus');
  const files = (await fs.readdir(corpus)).filter(file => /\.f$/i.test(file)
    && (!value('--filter') || file.startsWith(value('--filter')))
    && (!value('--from') || file >= value('--from'))).sort();
  if (!files.length) throw new Error('No corpus programs matched');
  const results = [];
  const fixtureNames = new Set(Array.from({ length: 100 }, (_, unit) => unit)
    .filter(unit => unit !== 5 && unit !== 6).map(unit => `fort.${unit}`));
  if (node) {
    for (const file of files) {
      const source = await fs.readFile(path.join(corpus, file), 'utf8');
      for (const match of source.matchAll(/'( *((?:SEQFILE|DIRFILE)\d*) *)'/g)) fixtureNames.add(match[1].trimEnd());
    }
  }
  const reportPath = path.resolve(value('--report') || path.join(root, 'reports', node ? 'hardware-corpus-validation.json' : 'corpus-validation.json'));
  const save = async () => {
    const counts = {};
    for (const result of results) counts[result.status] = (counts[result.status] || 0) + 1;
    const report = { generatedAt: new Date().toISOString(), standard: 'fortran77',
      runtime: node ? 'esp32-pmachine' : 'js-pmachine', ...(node ? { node, sourceMapOmitted: true } : {}),
      comparison: 'All output records compared; trailing whitespace and reference exit-0 marker ignored',
      total: results.length, planned: files.length, counts,
      results: [...results].sort((a, b) => a.file.localeCompare(b.file)) };
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return counts;
  };
  if (node) {
    await ready(node);
    await hardwareFixtures(node, [...fixtureNames]);
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++], started = Date.now();
      let result;
      try {
        if (node) await ready(node);
        const { stdout } = await run(process.execPath, [fileURLToPath(import.meta.url), '--worker', path.join(corpus, file), ...(node ? [node, String(timeout)] : [])], {
          cwd: root, timeout: node ? timeout + 10000 : timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
        });
        result = JSON.parse(stdout);
      } catch (error) {
        result = { status: error.killed ? 'timeout' : 'worker_error', error: error.stderr || error.message };
      }
      results.push({ file, ...result, durationMs: Date.now() - started });
      if (node) await save();
      console.log(`${file}: ${result.status}${result.error ? `: ${result.error.split('\n')[0]}` : ''}`);
    }
  }));
  results.sort((left, right) => left.file.localeCompare(right.file));
  const counts = await save();
  if (node) {
    await ready(node);
    await hardwareFixtures(node, [...fixtureNames], true);
  }
  console.log(`Summary: ${JSON.stringify(counts)}; total=${results.length}\nReport: ${reportPath}`);
  if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
}
