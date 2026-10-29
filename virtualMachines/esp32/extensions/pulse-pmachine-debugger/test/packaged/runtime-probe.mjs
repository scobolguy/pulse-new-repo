import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findPmachineRoot } from './extension/out/runtimeRoot.js';
import { LANGUAGE_EDITORS } from './extension/out/languageEditors.js';

const sourcePath = path.join(process.cwd(), 'hello.pas');
const root = await findPmachineRoot(sourcePath, process.cwd());
assert.equal(root, path.resolve(fileURLToPath(new URL('./extension/out/runtime/virtualMachines/esp32/', import.meta.url))));
const load = relative => import(pathToFileURL(path.join(root, relative)).href);
const runtime = await load('pmachines/javascript/index.mjs');
const debuggerModule = await load('aggregator/src/backend/modules/javascriptPmachineDebugger.mjs');
await load('aggregator/src/backend/modules/esp32PmachineDebugBridge.mjs');
const runner = await load('aggregator/scripts/run-pascal-on-esp32-node.mjs');
const scripts = 'aggregator/scripts/';
const compilers = {
  pascalish: (await load(`${scripts}compile-pascalish-program-antlr-to-pcode.mjs`)).compilePascalishProgramWithAntlr,
  fortranish: (await load(`${scripts}compile-mnf-to-pcode.mjs`)).compileMnfToPcode,
  cobolish: (await load(`${scripts}compile-tandem-cobol85-to-pcode.mjs`)).compileTandemCobol85ToPcode,
  csharp: (await load(`${scripts}compile-csharp-to-pcode.mjs`)).compileCsharpToPcode,
  vbish: (await load(`${scripts}compile-interoperable-language.mjs`)).compileVbishToPmachine,
};
const artifacts = new Map();
for (const starter of LANGUAGE_EDITORS.filter(item => compilers[item.id])) {
  const artifact = compilers[starter.id](starter.content, { fileName: `hello${starter.extension}` });
  artifacts.set(starter.id, artifact);
  const pcode = path.join(process.cwd(), `${starter.id}.pcode`);
  const programMap = `${pcode}.json`;
  await fs.writeFile(pcode, artifact.pcodeText);
  await fs.writeFile(programMap, JSON.stringify(artifact.programMap));
  const result = await runtime.runSingleMessageForEvolution({
    pcode, programMap, inputQueue: 'vscode.pmachine', message: '',
  });
  assert.deepEqual(result.stdout, [`Hello from ${{
    pascalish: 'Pascalish', fortranish: 'MNF', cobolish: 'COBOLish', csharp: 'C#', vbish: 'VBish',
  }[starter.id]}`]);
  assert.equal(result.stepLimitHit, false);
  assert.ok(!result.error, result.error);

  const session = debuggerModule.createJavaScriptPmachineDebugSession({
    ...artifact, sourceMap: artifact.programMap.sourceMap,
  });
  try {
    await debuggerModule.continueJavaScriptPmachineDebugSession(session.id);
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = debuggerModule.getJavaScriptPmachineDebugState(session.id);
      if (state.status === 'completed' || state.status === 'error') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const state = debuggerModule.getJavaScriptPmachineDebugState(session.id);
    assert.equal(state.status, 'completed', state.error || starter.id);
    assert.deepEqual(state.stdout, result.stdout);
  } finally {
    debuggerModule.stopJavaScriptPmachineDebugSession(session.id);
  }
}

const wfl = LANGUAGE_EDITORS.find(item => item.id === 'wfl').content;
const workflow = (await load(`${scripts}compile-workflow-dsl.mjs`)).compileWorkflowDSL(wfl);
assert.ok((await load(`${scripts}compile-workflow-to-pcode.mjs`)).compileWorkflowToPcode(workflow, 'routing').pcodeText);
assert.ok((await load(`${scripts}compile-mapl-antlr-to-pcode.mjs`)).compileMaplWithAntlr(
  LANGUAGE_EDITORS.find(item => item.id === 'mapl').content,
).pcodeText);
const fixedFormat = await load('../../languages/cobolish85/src/fixed-format.mjs');
assert.equal(typeof fixedFormat.fixedToFree, 'function');
const registry = await load('../../languages/pascalish/src/pascalish-library-registry.mjs');
assert.ok(registry.resolveLibrary('CPMNetwork').sourceText);
const cobolLibraries = await load('../../languages/cobolish85/src/cobol-runtime-libraries.mjs');
assert.ok(cobolLibraries.getCobolRuntimeLibrary('core').pcodeText);
for (const name of ['desktop-text', 'desktop-date', 'desktop-intrinsic', 'filesystem', 'isam']) {
  await load(`pmachines/javascript/src/${name}-bindings.mjs`);
}

const uploaded = new Map();
let executions = 0;
const server = http.createServer((request, response) => {
  (async () => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const form = new URLSearchParams(Buffer.concat(chunks).toString());
    if (request.url === '/ffs/upload') {
      uploaded.set(form.get('file'), form.get('body'));
      response.end('OK');
    } else if (request.url === '/pmachine/execute_file') {
      const pcode = uploaded.get(form.get('file'));
      const map = JSON.parse(uploaded.get(form.get('programMap')));
      assert.ok(map.signing.signature, 'uploaded program map must be signed');
      const result = await runtime.executeProgram({
        instructions: runtime.parsePcode(pcode),
        opcodeMap: await runtime.loadOpcodeMap(),
        mappingsById: runtime.parseProgramMapMappings(map),
        inputQueue: 'vscode.pmachine', sourceMessage: '',
      });
      executions++;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(result));
    } else {
      response.writeHead(404).end('Unexpected node request');
    }
  })().catch(error => response.writeHead(500).end(error.stack));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const language of ['pascalish', 'fortranish', 'cobolish']) {
    const result = await runner.runPcodeOnEsp32({
      ...artifacts.get(language), node: `127.0.0.1:${server.address().port}`,
    });
    assert.ok(result.result.stdout[0].startsWith('Hello from '));
    assert.ok(!result.result.error);
  }
  assert.equal(executions, 3);
} finally {
  await new Promise(resolve => server.close(resolve));
}
console.log('Portable compilation, JS execution, debugging and direct-node deployment passed');
