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
const cobolCompiler = await load('../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs');
const cobolHostModule = await load('pmachines/javascript/src/service-host.mjs');
const nativeCobol = cobolCompiler.compileCobolishToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. PACKAGED-HOST-CALLS.
PULSE SERVICE packaged-host-calls.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 REQUEST-TEXT PIC X(64).
01 RESPONSE-TEXT PIC X(256).
01 QUOTIENT-VALUE PIC S9(9) COMP-5.
PROCEDURE DIVISION.
    PULSE RECEIVE INTO REQUEST-TEXT
    COMPUTE QUOTIENT-VALUE = 513 / 256
    CALL "host.json_set" USING "{}" "quotient" QUOTIENT-VALUE
        RETURNING RESPONSE-TEXT
    CALL "host.json_set" USING RESPONSE-TEXT "data" REQUEST-TEXT
        RETURNING RESPONSE-TEXT
    PULSE SEND RESPONSE-TEXT AS JSON.`, { hostServices: true, nativeTarget: true });
assert.doesNotMatch(nativeCobol.pcodeText, /PUSH_DEC|DEC_|PROC_COBOL_RT_/);
const cobolHost = await cobolHostModule.createPascalishServiceHost({
  compiled: nativeCobol, collectorId: 'packaged-cobol-host', httpPort: null, udpPort: null,
});
try {
  await cobolHost.start();
  const result = await cobolHost.dispatch({ method: 'POST', path: '/api/pathway/packaged-host-calls',
    body: '{"data":"packaged COBOL"}' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { quotient: 2, data: 'packaged COBOL' });
} finally { await cobolHost.stop(); }
const screenCompiler = await load('../../languages/screencobol/src/compiler.mjs');
const screenArtifact = screenCompiler.compileScreenCobol(
  LANGUAGE_EDITORS.find(item => item.id === 'screencobol').content, { fileName: 'echo.scob' });
const screenOutput = {};
const screenResult = await runtime.executeProgram({
  instructions: runtime.parsePcode(screenArtifact.pcodeText),
  programMap: screenArtifact.programMap, sourceMessage: '',
  runtimeContext: {
    callHost(name, args) {
      if (name === 'screen.accept') return 'packaged requester'.padEnd(40);
      if (name === 'screen.display') { screenOutput[args[0]] = args[1]; return 0; }
      if (name === 'pathway.send') {
        assert.equal(args[0], 'echo');
        assert.equal(args[2], 0);
        return args[1];
      }
      throw new Error(`Unexpected requester binding ${name}`);
    },
  },
});
assert.ok(!screenResult.error, screenResult.error);
assert.equal(screenOutput['REPLY-TEXT'], 'packaged requester'.padEnd(40));
const hardwareCompiler = await load('../../languages/assemblerish/src/compile-assemblerish-to-pcode.mjs');
const hardwareArtifact = hardwareCompiler.compileAssemblerishToPcode(
  LANGUAGE_EDITORS.find(item => item.id === 'assemblerish').content, { fileName: 'button.asmish' });
const hardwareCalls = [];
const hardwareResult = await runtime.executeProgram({
  instructions: runtime.parsePcode(hardwareArtifact.pcodeText), opcodeMap: await runtime.loadOpcodeMap(),
  mappingsById: new Map(), queueTypesByName: new Map(), isoTypeIds: new Set(), sourceMessage: '',
  runtimeContext: {
    callHost(name, args) {
      hardwareCalls.push([name, args]);
      if (name === 'device.hal_read') return 0;
      if (name === 'device.hal_event') return 1;
      throw new Error(`Unexpected packaged HAL call ${name}`);
    },
  },
});
assert.ok(!hardwareResult.error, hardwareResult.error);
assert.deepEqual(hardwareCalls, [
  ['device.hal_read', ['button']],
  ['device.hal_event', ['/api/devices/button', 'pressed', 1, 0, 0]],
]);
const simulator = await load('../../languages/assemblerish/src/simulator.mjs');
const simulated = await simulator.simulateAssemblerish(hardwareArtifact, {
  allowedPins: [14], inputs: { button: 0 },
});
assert.equal(simulated.events[0].event, 'pressed');
assert.equal(typeof (await load('../../languages/assemblerish/deploy.mjs')).deployAssemblerish, 'function');
assert.match(await fs.readFile(path.join(root, '..', '..', 'languages', 'assemblerish', 'HAL-TUTORIAL.md'), 'utf8'),
  /Pushbutton/);
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
const fortran77 = compilers.fortranish([
  '      INTEGER A(2),U', '      DATA A(2)/42/', '      U=6',
  '      WRITE(U,10) A(2)', '   10 FORMAT("F77=",I2)', '      END',
].join('\n'), { fileName: 'extended.ftn', standard: 'fortran77' });
const extendedResult = await runtime.executeProgram({
  instructions: runtime.parsePcode(fortran77.pcodeText), opcodeMap: await runtime.loadOpcodeMap(),
  mappingsById: runtime.parseProgramMapMappings(fortran77.programMap),
  inputQueue: 'vscode.pmachine', sourceMessage: '',
});
assert.deepEqual(extendedResult.stdout, ['F77=42']);
assert.ok(!extendedResult.error, extendedResult.error);
assert.equal(extendedResult.stepLimitHit, false);
const fortranContext = await load('pmachines/javascript/src/fortran-context.mjs');
const ioArtifact = compilers.fortranish([
  '      INTEGER I', '      DOUBLE PRECISION D', '      COMPLEX Z',
  '      READ(*,*) I', '      D=DSQRT(4.D0)', '      Z=CSQRT((-3.,4.))',
  "      OPEN(12,FILE='probe',STATUS='NEW')", '      WRITE(12,10) I,D,Z',
  '      REWIND 12', '      READ(12,10) I,D,Z', '      WRITE(*,10) I,D,Z',
  '   10 FORMAT(I3,3F5.1)', '      END',
].join('\n'), { standard: 'fortran77' });
const ioResult = await runtime.executeProgram({
  instructions: runtime.parsePcode(ioArtifact.pcodeText), opcodeMap: await runtime.loadOpcodeMap(),
  mappingsById: runtime.parseProgramMapMappings(ioArtifact.programMap),
  queueTypesByName: new Map(), isoTypeIds: new Set(), inputQueue: 'vscode.pmachine', sourceMessage: '',
  runtimeContext: await fortranContext.createFortranRuntimeContext({
    dataDirectory: path.join(process.cwd(), 'fortran-data'), stdin: '42',
  }),
});
assert.deepEqual(ioResult.stdout, [' 42  2.0  1.0  2.0']);
assert.ok((await fs.readFile(path.join(process.cwd(), 'fortran-data', 'probe'), 'utf8')).includes('42'));
await assert.rejects(() => runner.runPcodeOnEsp32({ ...fortran77 }), /Extended FORTRAN 77.*JavaScript/);
const workflow = (await load('../../languages/wfl/src/compile-workflow-dsl.mjs')).compileWorkflowDSL(wfl);
assert.ok((await load('../../languages/wfl/src/compile-workflow-to-pcode.mjs')).compileWorkflowToPcode(workflow, 'routing').pcodeText);
assert.ok((await load('../../languages/mapl/src/compile-mapl-antlr-to-pcode.mjs')).compileMaplWithAntlr(
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
