// JS PMachine conformance target: runs a case through run-js-pmachine and normalises
// the result into the shared shape used for assertions and cross-runtime diffing.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runSingleMessageForEvolution } from './run-js-pmachine.mjs';

export const targetName = 'js';

export async function runCase(testCase) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pmachine-conf-js-'));
  const pcodePath = path.join(tmpDir, `${testCase.id}.pcode`);
  const mapPath = path.join(tmpDir, `${testCase.id}.program.json`);

  await fs.writeFile(pcodePath, testCase.pcode, 'utf-8');
  await fs.writeFile(mapPath, JSON.stringify(testCase.programMap, null, 2), 'utf-8');

  try {
    const out = await runSingleMessageForEvolution({
      pcode: pcodePath,
      programMap: mapPath,
      inputQueue: testCase.inputQueue,
      message: testCase.message,
      actorUserId: 'system-admin',
      serviceId: '',
      organismId: '',
      generation: '0',
      fitnessOut: ''
    });

    return {
      ok: true,
      stdout: Array.isArray(out.stdout) ? out.stdout : [],
      globals: out.globals || {},
      state: out.state || {},
      deliveries: Array.isArray(out.deliveries) ? out.deliveries : [],
      publishedCount: Number(out.publishedCount || 0),
      stepLimitHit: Boolean(out.stepLimitHit),
      runtimeError: out.error || null
    };
  } catch (error) {
    return {
      ok: false,
      stdout: [],
      globals: {},
      state: {},
      deliveries: [],
      publishedCount: 0,
      runtimeError: error?.message || String(error)
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
