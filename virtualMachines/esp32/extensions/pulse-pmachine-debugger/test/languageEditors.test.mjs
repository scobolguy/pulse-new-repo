import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import textmate from 'vscode-textmate';
import oniguruma from 'vscode-oniguruma';
import { LANGUAGE_EDITORS } from '../out/languageEditors.js';
import { findPmachineRoot } from '../out/runtimeRoot.js';
import { compileCsharpToPcode } from '../../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import { compileMnfToPcode } from '../../../../../languages/mnf/src/compile-mnf-to-pcode.mjs';
import { compileVbishToPmachine } from '../../../aggregator/scripts/compile-interoperable-language.mjs';
import { compilePascalishProgramWithAntlr } from '../../../../../languages/pascalish/src/compile-pascalish-program-antlr-to-pcode.mjs';
import { compileTandemCobol85ToPcode } from '../../../aggregator/scripts/compile-tandem-cobol85-to-pcode.mjs';
import { compileMaplWithAntlr } from '../../../../../languages/mapl/src/compile-mapl-antlr-to-pcode.mjs';
import { compileWorkflowDSL } from '../../../../../languages/wfl/src/compile-workflow-dsl.mjs';
import { compileWorkflowToPcode } from '../../../../../languages/wfl/src/compile-workflow-to-pcode.mjs';
import { compileAssemblerishToPcode } from '../../../../../languages/assemblerish/src/compile-assemblerish-to-pcode.mjs';
import { compileScreenCobol } from '../../../../../languages/screencobol/src/compiler.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../pmachines/javascript/index.mjs';

const extension = fileURLToPath(new URL('../', import.meta.url));
const repository = path.resolve(extension, '../../../..');
const runtimeRoot = path.join(repository, 'virtualMachines', 'esp32');
const manifest = JSON.parse(await fs.readFile(path.join(extension, 'package.json'), 'utf8'));
const require = createRequire(import.meta.url);
const wasm = await fs.readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
const registry = new textmate.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
    createOnigString: value => new oniguruma.OnigString(value)
  }),
  async loadGrammar(scope) {
    const grammar = manifest.contributes.grammars.find(item => item.scopeName === scope);
    assert.ok(grammar, `Missing grammar for ${scope}`);
    return JSON.parse(await fs.readFile(path.join(extension, grammar.path), 'utf8'));
  }
});

test('all language modes declare real configurations, grammars, run menus and starters', async () => {
  const ids = ['screencobol', 'assemblerish', 'pascal', 'pascalish', 'cobolish', 'vbish', 'csharp', 'fortranish', 'mnf', 'wfl', 'mapl', 'vfl', 'pulse-pcode'];
  assert.deepEqual(manifest.contributes.languages.map(item => item.id).sort(), ids.sort());
  assert.ok(manifest.contributes.commands.some(item => item.command === 'pulse-pmachine.newLanguageDocument'));
  for (const language of manifest.contributes.languages) {
    const configuration = JSON.parse(await fs.readFile(path.join(extension, language.configuration), 'utf8'));
    assert.ok(Array.isArray(configuration.brackets), language.id);
    for (const expression of Object.values(configuration.indentationRules || {})) {
      assert.doesNotThrow(() => new RegExp(expression), `${language.id}: JavaScript indentation regexp`);
    }
    const grammar = manifest.contributes.grammars.find(item => item.language === language.id);
    assert.ok(grammar, language.id);
    assert.equal(JSON.parse(await fs.readFile(path.join(extension, grammar.path), 'utf8')).scopeName, grammar.scopeName);
    const starterId = { pascal: 'pascalish', mnf: 'fortranish' }[language.id] || language.id;
    assert.ok(LANGUAGE_EDITORS.some(item => item.id === starterId));
  }
  for (const menu of ['editor/title', 'commandPalette']) {
    const run = manifest.contributes.menus[menu].find(item => item.command === 'pulse-pmachine.runCurrentFile');
    for (const language of ids.filter(id => !['vfl', 'assemblerish', 'screencobol'].includes(id))) assert.ok(run.when.includes(`editorLangId == ${language}`), language);
    const hardware = manifest.contributes.menus[menu].find(item => item.command === 'pulse-pmachine.compileHardwareHandler');
    assert.equal(hardware.when, 'editorLangId == assemblerish');
  }
});

test('source extensions select their compiler-backed Pulse language modes', () => {
  for (const [extension, id] of [['.pas', 'pascalish'], ['.ftn', 'fortranish'], ['.cob', 'cobolish']]) {
    assert.deepEqual(manifest.contributes.languages.filter(language => language.extensions?.includes(extension)).map(language => language.id), [id]);
    assert.ok(manifest.contributes.debuggers[0].languages.includes(id));
    assert.ok(manifest.contributes.breakpoints.some(item => item.language === id));
    assert.equal(LANGUAGE_EDITORS.find(item => item.extension === extension).id, id);
  }
});

const samples = [
  ['screencobol', 'SEND', '*> SEND', '"SEND"'],
  ['assemblerish', 'HANDLER', '# HANDLER', '"HANDLER"'],
  ['pascal', 'BEGIN', '// BEGIN', "'BEGIN'"],
  ['pascalish', 'BEGIN', '// BEGIN', "'BEGIN'"],
  ['cobolish', 'DISPLAY', '      * DISPLAY', '"DISPLAY"'],
  ['vbish', 'sUb', "' Sub", '"Sub"'],
  ['csharp', 'class', '// class', '"class"'],
  ['mnf', '      PROGRAM HELLO', 'C     PROGRAM HELLO', "      PRINT, 'PROGRAM'"],
  ['fortranish', '      PROGRAM HELLO', 'C     PROGRAM HELLO', "      PRINT, 'PROGRAM'"],
  ['wfl', 'WORKFLOW', '// WORKFLOW', '"WORKFLOW"'],
  ['mapl', 'map', '// map', '"map"'],
  ['pulse-pcode', 'PRINT_NL', '# PRINT_NL', 'PUSH_STR "PRINT_NL"']
];
test('SCREEN COBOL starter compiles and has a dedicated compile command', () => {
  const starter = LANGUAGE_EDITORS.find(item => item.id === 'screencobol');
  assert.ok(compileScreenCobol(starter.content).programMap.screenCobol);
  for (const menu of ['editor/title', 'commandPalette']) {
    assert.ok(manifest.contributes.menus[menu].some(item =>
      item.command === 'pulse-pmachine.compileScreenRequester' && item.when === 'editorLangId == screencobol'));
  }
});
for (const [id, keyword, comment, string] of samples) {
  test(`${id}: real TextMate tokenizer distinguishes keywords, comments and strings`, async () => {
    const scope = manifest.contributes.grammars.find(item => item.language === id).scopeName;
    const grammar = await registry.loadGrammar(scope);
    const scopes = line => grammar.tokenizeLine(line).tokens.flatMap(token => token.scopes);
    assert.ok(scopes(keyword).some(item => item.startsWith('keyword.')), `${id}: keyword`);
    assert.ok(scopes(comment).some(item => item.startsWith('comment.')), `${id}: comment`);
    assert.ok(!scopes(comment).some(item => item.startsWith('keyword.')), `${id}: keyword in comment`);
    const tokens = grammar.tokenizeLine(string).tokens;
    const offset = string.search(/['"]/) + 1;
    const token = tokens.find(item => item.startIndex <= offset && item.endIndex > offset);
    assert.ok(token.scopes.some(item => item.startsWith('string.')), `${id}: string`);
    assert.ok(!token.scopes.some(item => item.startsWith('keyword.')), `${id}: keyword in string`);
  });
}

test('VFL JSON text highlights property names, strings, numbers and booleans without an external grammar', async () => {
  const grammar = await registry.loadGrammar('source.vfl');
  const scopes = grammar.tokenizeLine('{"kind": "visual-flow-language", "schemaVersion": 1, "active": true}').tokens.flatMap(token => token.scopes);
  for (const expected of ['support.type.property-name', 'string.quoted', 'constant.numeric', 'constant.language']) {
    assert.ok(scopes.some(item => item.startsWith(expected)), expected);
  }
});

test('C# multiline comments preserve state and escaped identifiers do not become keywords', async () => {
  const grammar = await registry.loadGrammar('source.cs');
  const first = grammar.tokenizeLine('/* class');
  const line = 'still a comment */ class C { int @if; }';
  const second = grammar.tokenizeLine(line, first.ruleStack);
  const scopesAt = index => second.tokens.find(token => token.startIndex <= index && token.endIndex > index).scopes;
  assert.ok(scopesAt(2).includes('comment.block.cs'));
  assert.ok(scopesAt(line.indexOf('class')).includes('keyword.control.cs'));
  assert.ok(scopesAt(line.indexOf('@if')).includes('variable.other.cs'));
});

test('VBish indentation handles upper, lower and mixed-case blocks', async () => {
  const config = JSON.parse(await fs.readFile(path.join(extension, 'vbish-language-configuration.json'), 'utf8'));
  for (const line of ['Sub Main()', 'sub main()', 'IF flag THEN', 'if flag then']) {
    assert.match(line, new RegExp(config.indentationRules.increaseIndentPattern));
  }
  for (const line of ['End Sub', 'end sub', 'NEXT', 'else']) {
    assert.match(line, new RegExp(config.indentationRules.decreaseIndentPattern));
  }
});

test('runtime checkout resolution supports canonical languages, repository/ESP32 workspaces and untitled fallback', async t => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pulse-editor-root-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const source = path.join(repository, 'languages', 'csharp', 'examples', 'generics.cs');
  for (const workspace of [repository, runtimeRoot, path.join(repository, 'languages'), undefined]) {
    assert.equal(await findPmachineRoot(source, workspace), runtimeRoot);
  }
  assert.equal(await findPmachineRoot(path.join(temporary, 'Untitled-1'), repository), runtimeRoot);
  assert.equal(await findPmachineRoot(path.join(runtimeRoot, 'src', 'hello.pas')), runtimeRoot);
  assert.equal(await findPmachineRoot(path.join(temporary, 'hello.cs')), path.join(extension, 'out', 'runtime', 'virtualMachines', 'esp32'));
});

const compilers = {
  pascalish: compilePascalishProgramWithAntlr,
  cobolish: compileTandemCobol85ToPcode,
  vbish: compileVbishToPmachine,
  csharp: compileCsharpToPcode,
  fortranish: compileMnfToPcode
};
for (const starter of LANGUAGE_EDITORS.filter(item => compilers[item.id] || item.id === 'pulse-pcode')) {
  test(`${starter.id}: new-document starter compiles and executes on the actual JavaScript p-machine`, async () => {
    const artifact = starter.id === 'pulse-pcode'
      ? { pcodeText: starter.content, programMap: {} }
      : compilers[starter.id](starter.content, { fileName: `hello${starter.extension}` });
    const mappingsById = new Map();
    mappingsById.__globals = artifact.programMap.globals;
    mappingsById.__proceduresByLabel = artifact.programMap.procedures;
    const result = await executeProgram({
      instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(), mappingsById,
      queueTypesByName: new Map(), isoTypeIds: new Set(), sourceMessage: '',
      runtimeContext: { maxSteps: 10000, maxCallDepth: 32 }
    });
    assert.deepEqual(result.stdout, [{
      pascalish: 'Hello from Pascalish', cobolish: 'Hello from COBOLish', vbish: 'Hello from VBish',
      csharp: 'Hello from C#', fortranish: 'Hello from MNF', 'pulse-pcode': 'Hello from the p-machine'
    }[starter.id]]);
    assert.ok(!result.error);
    assert.equal(result.stepLimitHit, false);
  });
}

test('MAPL and WFL starters compile, and VFL starter is a graph rather than executable source', () => {
  const content = id => LANGUAGE_EDITORS.find(item => item.id === id).content;
  assert.ok(compileMaplWithAntlr(content('mapl')).pcodeText.length > 0);
  const wfl = compileWorkflowDSL(content('wfl'));
  assert.ok(compileWorkflowToPcode(wfl, 'routing').pcodeText.length > 0);
  const vfl = JSON.parse(content('vfl'));
  assert.equal(vfl.schemaVersion, 1);
  assert.equal(vfl.kind, 'visual-flow-language');
  assert.ok(Array.isArray(vfl.nodes));
  assert.ok(Array.isArray(vfl.edges));
});

test('Assemblerish starter executes through typed HAL bindings and emits the final event', async () => {
  const starter = LANGUAGE_EDITORS.find(item => item.id === 'assemblerish');
  const artifact = compileAssemblerishToPcode(starter.content, { fileName: `button${starter.extension}` });
  const calls = [];
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(),
    mappingsById: new Map(), queueTypesByName: new Map(), isoTypeIds: new Set(), sourceMessage: '',
    runtimeContext: {
      callHost(name, args) {
        calls.push([name, args]);
        if (name === 'device.hal_read') { assert.deepEqual(args, ['button']); return 0; }
        if (name === 'device.hal_event') return 1;
        throw new Error(`Unexpected HAL operation ${name}`);
      },
    },
  });
  assert.ok(!result.error, result.error);
  assert.equal(result.stepLimitHit, false);
  assert.deepEqual(calls, [
    ['device.hal_read', ['button']],
    ['device.hal_event', ['/api/devices/button', 'pressed', 1, 0, 0]],
  ]);
});
