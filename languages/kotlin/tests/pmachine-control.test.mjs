import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { runHelloBye } from '../scripts/run-hello-bye.mjs';

const source = `
import pulse.http.*
import pulse.pmachine.*
@HttpGet("/api/pmachine/status")
fun statusRoute(): String = status()
@HttpPost("/api/pmachine/start")
fun startRoute(): String = start(requestQuery("slot"), requestQuery("fileName"))
@HttpPost("/api/pmachine/checkpoint")
fun checkpointRoute(): String = checkpoint(requestQuery("taskId"), requestQuery("state"), requestBody())
`;

test('Pulse Kotlin compiles pmachine control bindings for hosted services', () => {
  const compiled = compileKotlinToPcode(source, {
    fileName: 'pmachine-control.kt',
    target: 'esp32',
    serviceId: 'pmachine-control'
  });

  assert.deepEqual(compiled.programMap.serviceEndpoints, [
    { verb: 'GET', path: '/api/pmachine/status' },
    { verb: 'POST', path: '/api/pmachine/start' },
    { verb: 'POST', path: '/api/pmachine/checkpoint' }
  ]);
  assert.match(compiled.pcodeText, /CALL_EXT host\.pmachine_status/);
  assert.match(compiled.pcodeText, /CALL_EXT host\.pmachine_start/);
  assert.match(compiled.pcodeText, /CALL_EXT host\.pmachine_checkpoint/);
});

test('helloBye checkpoints after Hello and resumes on a second scheduler', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-hello-bye-'));
  try {
    const lines = [];
    const result = await runHelloBye({ directory, delayMs: 30, onLine: line => lines.push(line) });
    assert.deepEqual(lines, ['Hello', 'Bye']);
    assert.ok(result.resumedAt - result.checkpointTime >= 30);
    assert.ok(result.checkpointId);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
