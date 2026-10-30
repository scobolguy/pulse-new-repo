import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('Develop compile/run supplies FORTRAN stdin, maps extendable storage and persists unit files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-fortran-develop-'));
  const previous = process.env.PULSE_DEVELOP_WORKSPACE_ROOT;
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT = directory;
  try {
    const { registerDevelopDocumentRoutes } = await import('../../aggregator/src/backend/developDocumentRoutes.mjs');
    const routes = new Map();
    const register = (route, handler) => routes.set(route, handler);
    await registerDevelopDocumentRoutes({ get: register, post: register, put: register, delete: register, patch: register });
    const compile = async (lines, stdin = '') => {
      let payload, status;
      const response = {
        status(code) { status = code; return this; },
        json(body) { payload = body; },
      };
      await routes.get('/api/develop/compile')({
        body: { mode: 'compile-run', fileName: 'regression.ftn', content: lines.map(line => '      ' + line).join('\n'), stdin },
      }, response);
      assert.equal(status, 200, JSON.stringify(payload));
      assert.equal(payload.run.error, null);
      return payload.run.stdout;
    };
    assert.deepEqual(await compile([
      'INTEGER A(2)', 'READ(*,*) A', "OPEN(12,FILE='result',STATUS='NEW')",
      'WRITE(12,*) A(1)+A(2)', 'CLOSE(12)', 'END',
    ], '17,25'), []);
    assert.deepEqual(await compile([
      'INTEGER I', "OPEN(12,FILE='result',STATUS='OLD')", 'READ(12,*) I',
      'WRITE(*,*) I', "CLOSE(12,STATUS='DELETE')", 'END',
    ]), [' 42']);
  } finally {
    if (previous === undefined) delete process.env.PULSE_DEVELOP_WORKSPACE_ROOT;
    else process.env.PULSE_DEVELOP_WORKSPACE_ROOT = previous;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
