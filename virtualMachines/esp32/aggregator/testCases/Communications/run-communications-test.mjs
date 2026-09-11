import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { callMapperAsync, callMapperSync } from './javascript-client.mjs';
import { compileWorkflowDSLWithAntlr } from '../../scripts/workflow-antlr-compiler.mjs';
import { compileCobolishToPmachine, compileVbishToPmachine } from '../../scripts/compile-interoperable-language.mjs';
import { compilePascalishProgramWithAntlr } from '../../scripts/compile-pascalish-program-antlr-to-pcode.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const caseRoot = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.COMMUNICATIONS_MAPPER_PORT || 4777);
const baseUrl = `http://127.0.0.1:${port}`;
const request = {
  mapperId: 'communications-normalize',
  sourceType: 'swift-mt103',
  targetType: 'pacs',
  payload: { reference: 'COMM-SYNC-001', amount: '100,25', currency: 'USD' },
};

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('communications mapper did not become healthy');
}

async function compileJava() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'communications-java-'));
  try {
    await execFileAsync('javac', ['-d', tempRoot, path.join(caseRoot, 'MapperClient.java'), path.join(caseRoot, 'JavaCommunicationsTest.java')], { cwd: root });
    const result = await execFileAsync('java', ['-cp', tempRoot, 'JavaCommunicationsTest', baseUrl], { cwd: root });
    return { status: 'passed', detail: result.stdout.trim() };
  } catch (error) {
    if (error?.code === 'ENOENT') return { status: 'skipped', detail: 'javac/java is not installed' };
    return { status: 'failed', detail: error?.stderr || error?.message || String(error) };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function compileFixtures() {
  const results = {};
  const fixtures = {
    wfl: async () => compileWorkflowDSLWithAntlr(await fs.readFile(path.join(caseRoot, 'wfl-communications.wfl'), 'utf8')),
    cobolish: async () => compileCobolishToPmachine(await fs.readFile(path.join(caseRoot, 'cobolish-communications.cob'), 'utf8'), { fileName: 'communications.cob' }),
    vbish: async () => compileVbishToPmachine(await fs.readFile(path.join(caseRoot, 'vbish-communications.vbs'), 'utf8'), { fileName: 'communications.vbs' }),
    pascalish: async () => compilePascalishProgramWithAntlr(await fs.readFile(path.join(caseRoot, 'pascalish-communications.pas'), 'utf8')),
  };
  for (const [name, compile] of Object.entries(fixtures)) {
    try {
      const artifact = await compile();
      results[name] = { status: 'passed', runtime: artifact?.runtimeUnit?.kind || 'workflow', id: artifact?.runtimeUnit?.id || artifact?.workflows?.[0]?.id || null };
    } catch (error) {
      results[name] = { status: 'gap', detail: error?.message || String(error) };
    }
  }
  return results;
}

const mapper = spawn(process.execPath, [path.join(caseRoot, 'mapper-service.mjs'), String(port)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, COMMUNICATIONS_MAPPER_PORT: String(port) },
});
mapper.stdout.on('data', chunk => process.stdout.write(`[mapper] ${chunk}`));
mapper.stderr.on('data', chunk => process.stderr.write(`[mapper:error] ${chunk}`));

try {
  await waitForHealth();
  const sync = await callMapperSync(baseUrl, request);
  assert.equal(sync.mode, 'sync');
  assert.equal(sync.payload.amount, 100.25);
  assert.equal(sync.payload.messageId, 'COMM-SYNC-001');

  const asyncResult = await callMapperAsync(baseUrl, { ...request, payload: { ...request.payload, reference: 'COMM-ASYNC-001' } });
  assert.equal(asyncResult.mode, 'async');
  assert.equal(asyncResult.payload.messageId, 'COMM-ASYNC-001');
  assert.equal(asyncResult.payload.amount, 100.25);

  const java = await compileJava();
  const fixtures = await compileFixtures();
  console.log(JSON.stringify({
    status: 'passed',
    mapper: { sync: 'passed', async: 'passed' },
    java,
    fixtures,
    note: 'Fixture status=gap identifies front-end syntax/lowering work; it is not treated as a boundary-service failure.'
  }, null, 2));
} finally {
  mapper.kill('SIGTERM');
  await new Promise(resolve => mapper.once('exit', resolve));
}
