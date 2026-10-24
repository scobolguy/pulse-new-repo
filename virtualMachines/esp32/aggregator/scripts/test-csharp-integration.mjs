import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { compileCsharpToPcode } from '../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import { compileCsharpToPcode as legacy } from './compile-csharp-to-pcode.mjs';
import { compileVbishToPcode } from './compile-vbish-to-pcode.mjs';
import { SYSTEM_LIBRARY } from '../../../../languages/dotnet/system-library.mjs';
import { getDocumentTypeByFileName, createNewDocumentFileName } from '../src/documentRegistry.js';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../pmachines/javascript/index.mjs';
import {
  createJavaScriptPmachineDebugSession, setJavaScriptPmachineSourceBreakpoints,
  getJavaScriptPmachineDebugState, continueJavaScriptPmachineDebugSession, stopJavaScriptPmachineDebugSession
} from '../src/backend/modules/javascriptPmachineDebugger.mjs';

const execute = promisify(execFile);

test('C# registration, shared VBish System contract and legacy compiler identity', () => {
  assert.equal(legacy, compileCsharpToPcode);
  assert.equal(getDocumentTypeByFileName('Program.CS').id, 'csharp');
  assert.equal(createNewDocumentFileName('csharp'), 'untitled.cs');
  const csharp = compileCsharpToPcode(getDocumentTypeByFileName('Program.cs').starterContent);
  const vbish = compileVbishToPcode('Program "hello"\nSub Main()\nPrint "Hello"\nEnd Sub');
  assert.deepEqual(csharp.programMap.libraries, vbish.programMap.libraries);
  assert.deepEqual(SYSTEM_LIBRARY.languages, ['csharp', 'vbish']);
});

test('C# generic method source breakpoints resolve and execute on the real debugger', async () => {
  const source = 'using System;\nclass Program {\nstatic T Id<T>(T value) {\nreturn value;\n}\nstatic void Main() {\nConsole.WriteLine(Id("debugged"));\n}\n}';
  const session = createJavaScriptPmachineDebugSession(compileCsharpToPcode(source, { fileName: 'debug.cs' }));
  const waitFor = async predicate => {
    for (let i = 0; i < 200; i++) {
      const state = getJavaScriptPmachineDebugState(session.id);
      if (predicate(state)) return state;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Timed out waiting for C# debugger state');
  };
  try {
    await waitFor(state => state.ready);
    const state = setJavaScriptPmachineSourceBreakpoints(session.id, [{
      sourceFile: 'debug.cs', sourceLanguage: 'csharp', sourceLine: 4
    }]);
    assert.equal(state.resolvedSourceBreakpoints[0].verified, true);
    continueJavaScriptPmachineDebugSession(session.id);
    await waitFor(state => state.status === 'paused' && state.sourceLocation?.sourceLine === 4);
    setJavaScriptPmachineSourceBreakpoints(session.id, []);
    continueJavaScriptPmachineDebugSession(session.id);
    assert.deepEqual((await waitFor(state => state.status === 'completed')).stdout, ['debugged']);
  } finally {
    stopJavaScriptPmachineDebugSession(session.id);
  }
});

test('canonical and aggregator CLIs emit standalone p-code/maps and reject invalid input', async t => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-csharp-cli-'));
  t.after(() => fs.rm(out, { recursive: true, force: true }));
  const source = path.join(out, 'Example.cs');
  await fs.writeFile(source, getDocumentTypeByFileName('Example.cs').starterContent);
  for (const compiler of [
    new URL('../../../../languages/csharp/src/compile-csharp-to-pcode.mjs', import.meta.url),
    new URL('./compile-csharp-to-pcode.mjs', import.meta.url)
  ]) {
    const output = path.join(out, 'nested', path.basename(fileURLToPath(compiler)) + '.pcode');
    await execute(process.execPath, [fileURLToPath(compiler), source, output], { timeout: 30000 });
    const map = JSON.parse(await fs.readFile(output.replace(/\.pcode$/, '.program.json'), 'utf8'));
    const mappingsById = new Map();
    mappingsById.__globals = map.globals;
    mappingsById.__proceduresByLabel = map.procedures;
    const result = await executeProgram({
      instructions: parsePcode(await fs.readFile(output, 'utf8')), opcodeMap: await loadOpcodeMap(), mappingsById,
      queueTypesByName: new Map(), isoTypeIds: new Set(), sourceMessage: '', runtimeContext: {}
    });
    assert.deepEqual(result.stdout, ['Hello from C#']);
  }
  await fs.writeFile(source, 'class P { static void Main() { int x = true; } }');
  await assert.rejects(execute(process.execPath, [fileURLToPath(new URL('./compile-csharp-to-pcode.mjs', import.meta.url)), source, path.join(out, 'bad.pcode')]),
    error => error.code === 1 && /Cannot use 'bool'/.test(error.stderr));
  await assert.rejects(fs.access(path.join(out, 'bad.pcode')), { code: 'ENOENT' });
});

test('C# API document creation, compile/run, saved artifacts and explicit diagnostics', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-csharp-api-'));
  const previous = process.env.PULSE_DEVELOP_WORKSPACE_ROOT;
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
    let response = await post('/files', { typeId: 'csharp' });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.file.name, 'untitled.cs');
    response = await post('/compile', { fileName: created.file.name, mode: 'compile-run' });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.compile.language, 'csharp');
    assert.deepEqual(result.run.stdout, ['Hello from C#']);
    assert.equal(result.run.error, null);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, 'csharp-compiled.json'), 'utf8')).programMap.target, 'js');
    response = await post('/compile', { fileName: 'bad.cs', content: 'class P { static void Main() { int n; System.Console.WriteLine(n); } }' });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /unassigned local/);
    response = await post('/compile', { fileName: 'fault.cs', mode: 'compile-run', content: 'class P { static void Main() { int zero = 0; System.Console.WriteLine(1 / zero); } }' });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /DivideByZeroException/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.PULSE_DEVELOP_WORKSPACE_ROOT;
    else process.env.PULSE_DEVELOP_WORKSPACE_ROOT = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});
