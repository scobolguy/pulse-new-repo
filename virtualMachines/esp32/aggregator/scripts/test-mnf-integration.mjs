import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { compileMnfToPcode, MNF_STARTER } from './compile-mnf-to-pcode.mjs';
import { MNF_STARTER as editorStarter, getDocumentTypeByFileName, createNewDocumentFileName } from '../src/documentRegistry.js';
import {
  createJavaScriptPmachineDebugSession, setJavaScriptPmachineSourceBreakpoints,
  getJavaScriptPmachineDebugState, continueJavaScriptPmachineDebugSession, stopJavaScriptPmachineDebugSession
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

test('PULSE recognizes .ftn and its starter matches the compiler example', () => {
  assert.equal(getDocumentTypeByFileName('NOSTALGIA.FTN').id, 'mnf');
  assert.equal(createNewDocumentFileName('mnf'), 'untitled.ftn');
  assert.equal(editorStarter, MNF_STARTER);
  assert.equal(compileMnfToPcode(editorStarter).programMap.sourceLanguage, 'mnf');
});

test('MNF source breakpoints resolve and execute on the p-machine debugger', async () => {
  const artifact = compileMnfToPcode(MNF_STARTER, { fileName: 'nostalgia.ftn' });
  const session = createJavaScriptPmachineDebugSession(artifact);
  const waitFor = async predicate => {
    for (let i = 0; i < 200; i++) {
      const state = getJavaScriptPmachineDebugState(session.id);
      if (predicate(state)) return state;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Timed out waiting for debugger state');
  };
  try {
    await waitFor(state => state.ready);
    const state = setJavaScriptPmachineSourceBreakpoints(session.id, [{
      sourceFile: 'nostalgia.ftn', sourceLanguage: 'mnf', sourceLine: 7
    }]);
    assert.equal(state.resolvedSourceBreakpoints[0].verified, true);
    continueJavaScriptPmachineDebugSession(session.id);
    const paused = await waitFor(state => state.status === 'paused' && state.sourceLocation?.sourceLine === 7);
    assert.equal(paused.globals.ISUM, 55);
    setJavaScriptPmachineSourceBreakpoints(session.id, []);
    continueJavaScriptPmachineDebugSession(session.id);
    const completed = await waitFor(state => state.status === 'completed');
    assert.deepEqual(completed.stdout, ['SUM = 55']);
  } finally {
    stopJavaScriptPmachineDebugSession(session.id);
  }
});

test('PULSE MNF document creation, compile, run and diagnostics', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-mnf-'));
  const previousRoot = process.env.PULSE_DEVELOP_WORKSPACE_ROOT;
  process.env.PULSE_DEVELOP_WORKSPACE_ROOT = root;
  const { registerDevelopDocumentRoutes } = await import('../src/backend/developDocumentRoutes.mjs');
  const app = express();
  app.use(express.json());
  await registerDevelopDocumentRoutes(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/develop`;
  const post = (url, body) => fetch(base + url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  try {
    let response = await post('/files', { typeId: 'mnf' });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.file.name, 'untitled.ftn');
    assert.equal(created.content, MNF_STARTER);
    response = await post('/compile', { fileName: created.file.name, mode: 'compile-run' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.compile.language, 'mnf');
    assert.deepEqual(result.run.stdout, ['SUM = 55']);
    assert.equal(result.run.error, null);
    const artifact = JSON.parse(await fs.readFile(path.join(root, 'mnf-compiled.json'), 'utf8'));
    assert.equal(artifact.programMap.sourceLanguage, 'mnf');
    response = await post('/compile', { fileName: 'invalid.ftn', content: '      READ, I\n      END' });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /MNF line 1: Unsupported statement/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previousRoot === undefined) delete process.env.PULSE_DEVELOP_WORKSPACE_ROOT;
    else process.env.PULSE_DEVELOP_WORKSPACE_ROOT = previousRoot;
    await fs.rm(root, { recursive: true, force: true });
  }
});
