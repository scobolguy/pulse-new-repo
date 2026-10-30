import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const aggregator = fileURLToPath(new URL('../', import.meta.url));
const repository = path.resolve(aggregator, '../../..');
const modules = [
  ['vbish', 'compile-vbish-to-pcode.mjs'],
  ['vbish', 'vbish-antlr-compiler.mjs'],
  ['mapl', 'compile-mapl-antlr-to-pcode.mjs'],
  ['wfl', 'compile-workflow-dsl.mjs'],
  ['wfl', 'compile-workflow-to-pcode.mjs'],
  ['wfl', 'workflow-antlr-compiler.mjs'],
  ['wfl', 'interpret-workflow.mjs']
];

test('language compilers load canonically and remaining legacy exports forward correctly', async () => {
  for (const [language, file] of modules) {
    const canonical = await import(new URL(`../../../../languages/${language}/src/${file}`, import.meta.url));
    if (file !== 'interpret-workflow.mjs') {
      assert.ok(Object.keys(canonical).length > 0, file);
      assert.ok(!fs.existsSync(path.join(aggregator, 'scripts', file)), file);
      continue;
    }
    const legacy = await import(new URL(file, import.meta.url));
    assert.deepEqual(Object.keys(legacy), Object.keys(canonical), file);
    for (const key of Object.keys(canonical)) assert.equal(legacy[key], canonical[key], `${file}: ${key}`);
  }
});

test('VBish/MAPL/WFL parsers load only from languages', async () => {
  for (const [language, grammar] of [['vbish', 'Vbish'], ['mapl', 'MAPL'], ['wfl', 'WorkflowDsl']]) {
    for (const suffix of ['Lexer', 'Parser', 'Visitor']) {
      const file = `${grammar}${suffix}.js`;
      const canonical = await import(new URL(`../../../../languages/${language}/grammar/generated/${file}`, import.meta.url));
      assert.equal(typeof canonical.default, 'function', file);
      assert.ok(!fs.existsSync(path.join(aggregator, 'grammar', 'generated-modern', file)), file);
    }
  }
});

test('DSL coaching corpus points to the canonical grammars', () => {
  const corpus = JSON.parse(fs.readFileSync(path.join(aggregator, 'data', 'dsl-ollama-corpus.json'), 'utf8'));
  const serialized = JSON.stringify(corpus);
  for (const [language, grammar] of [['vbish', 'Vbish'], ['mapl', 'MAPL'], ['wfl', 'WorkflowDsl'], ['wfl', 'WFL']]) {
    const relative = `../../languages/${language}/grammar/${grammar}.g4`;
    assert.ok(serialized.includes(relative), grammar);
    assert.ok(!serialized.includes(`aggregator/grammar/${grammar}.g4`), grammar);
    assert.ok(fs.existsSync(path.resolve(aggregator, '..', relative)), grammar);
  }
});

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-language-relocation-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function run(language, file, legacy, args, cwd) {
  const script = legacy
    ? path.join(aggregator, 'scripts', file)
    : path.join(repository, 'languages', language, 'src', file);
  return execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 30000 });
}

test('MAPL canonical CLI emits p-code and entries', t => {
  const cwd = temporaryDirectory(t);
  const input = path.join(repository, 'languages', 'mapl', 'examples', 'customer.mapl');
  const results = [];
  for (const legacy of [false]) {
    for (const file of ['map.pcode', 'map.json']) fs.rmSync(path.join(cwd, file), { force: true });
    run('mapl', 'compile-mapl-antlr-to-pcode.mjs', legacy,
      ['--in', input, '--out', 'map.pcode', '--map-out', 'map.json'], cwd);
    results.push({
      pcode: fs.readFileSync(path.join(cwd, 'map.pcode'), 'utf8'),
      entries: JSON.parse(fs.readFileSync(path.join(cwd, 'map.json'), 'utf8')).entries
    });
  }
  assert.match(results[0].pcode, /CustomerToAccount/);
  assert.equal(results[0].entries.length, 1);
});

test('WFL canonical DSL CLI emits workflows and symbols', t => {
  const cwd = temporaryDirectory(t);
  const input = path.join(repository, 'languages', 'wfl', 'examples', 'routing.wfl');
  const results = [];
  for (const legacy of [false]) {
    for (const file of ['symbols.json', 'workflows.json', 'workflow.json']) {
      fs.rmSync(path.join(cwd, file), { force: true });
    }
    run('wfl', 'compile-workflow-dsl.mjs', legacy, [
      '--in', input, '--symbols-out', 'symbols.json',
      '--workflow-out', 'workflows.json', '--artifact-out', 'workflow.json'
    ], cwd);
    const artifact = JSON.parse(fs.readFileSync(path.join(cwd, 'workflow.json'), 'utf8'));
    const symbols = JSON.parse(fs.readFileSync(path.join(cwd, 'symbols.json'), 'utf8'));
    const workflows = JSON.parse(fs.readFileSync(path.join(cwd, 'workflows.json'), 'utf8'));
    assert.deepEqual(artifact.symbols, symbols);
    assert.deepEqual(artifact.workflows, workflows);
    results.push({ symbols, workflows });
  }
  assert.equal(results[0].workflows[0].id, 'route-payments');
});

test('WFL canonical p-code CLI emits matching programs and maps', t => {
  const cwd = temporaryDirectory(t);
  const input = path.join(repository, 'languages', 'wfl', 'examples', 'routing.wfl');
  const results = [];
  for (const legacy of [false]) {
    for (const file of ['workflow.pcode', 'workflow.json']) fs.rmSync(path.join(cwd, file), { force: true });
    run('wfl', 'compile-workflow-to-pcode.mjs', legacy,
      ['--in', input, '--workflow', 'route-payments', '--out', 'workflow.pcode', '--out-map', 'workflow.json'], cwd);
    const pcode = fs.readFileSync(path.join(cwd, 'workflow.pcode'), 'utf8');
    const artifact = JSON.parse(fs.readFileSync(path.join(cwd, 'workflow.json'), 'utf8'));
    assert.equal(artifact.pcodeText, pcode);
    assert.equal(artifact.workflowId, 'route-payments');
    results.push(pcode);
  }
  assert.ok(results[0].length > 0);
});

test('WFL interpreter preserves working-directory-relative data defaults', t => {
  const cwd = temporaryDirectory(t);
  const input = path.join(repository, 'languages', 'wfl', 'examples', 'routing.wfl');
  const results = [false, true].map(legacy => JSON.parse(run('wfl', 'interpret-workflow.mjs', legacy,
    ['--in', input, '--workflow', 'route-payments', '--dry-run'], cwd)));
  assert.equal(results[0].workflowId, 'route-payments');
  assert.equal(results[0].stepCount, 1);
  assert.equal(results[0].issueTestStorePath, path.join(cwd, 'data', 'issue-test-system.json'));
  assert.deepEqual(results[1], results[0]);
});

test('compiler CLI defaults remain relative to the caller, not the relocated module', t => {
  const root = temporaryDirectory(t);
  const cwd = path.join(root, 'work');
  const source = path.join(root, 'src');
  const output = path.join(root, 'object', 'pcode');
  fs.mkdirSync(cwd);
  fs.mkdirSync(source);
  fs.copyFileSync(path.join(repository, 'languages', 'mapl', 'examples', 'customer.mapl'),
    path.join(source, 'sample.mapl'));
  fs.copyFileSync(path.join(repository, 'languages', 'wfl', 'examples', 'routing.wfl'),
    path.join(source, 'workflow.wfl'));
  for (const legacy of [false]) {
    for (const file of ['mapl.pcode', 'mapl.program.json', 'symbols.generated.json',
      'workflows.generated.json', 'workflow-compiled.json', 'workflow-router.pcode', 'workflow-router.program.json']) {
      fs.rmSync(path.join(output, file), { force: true });
    }
    run('mapl', 'compile-mapl-antlr-to-pcode.mjs', legacy, [], cwd);
    assert.match(fs.readFileSync(path.join(output, 'mapl.pcode'), 'utf8'), /CustomerToAccount/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'mapl.program.json'), 'utf8')).entries.length, 1);
    run('wfl', 'compile-workflow-dsl.mjs', legacy, [], cwd);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'workflow-compiled.json'), 'utf8'))
      .workflows[0].id, 'route-payments');
    assert.ok(fs.existsSync(path.join(output, 'symbols.generated.json')));
    assert.ok(fs.existsSync(path.join(output, 'workflows.generated.json')));
    run('wfl', 'compile-workflow-to-pcode.mjs', legacy, [], cwd);
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'workflow-router.program.json'), 'utf8'))
      .workflowId, 'route-payments');
    assert.ok(fs.readFileSync(path.join(output, 'workflow-router.pcode'), 'utf8').length > 0);
    const result = JSON.parse(run('wfl', 'interpret-workflow.mjs', legacy, ['--dry-run'], cwd));
    assert.equal(result.workflowId, 'route-payments');
    assert.equal(result.issueTestStorePath, path.join(cwd, 'data', 'issue-test-system.json'));
  }
});

test('canonical CLIs and remaining interpreter compatibility report failures with a nonzero exit status', t => {
  const cwd = temporaryDirectory(t);
  for (const [language, file] of modules.filter(([, file]) =>
    ['compile-mapl-antlr-to-pcode.mjs', 'compile-workflow-dsl.mjs',
      'compile-workflow-to-pcode.mjs', 'interpret-workflow.mjs'].includes(file))) {
    for (const legacy of file === 'interpret-workflow.mjs' ? [false, true] : [false]) {
      const script = legacy
        ? path.join(aggregator, 'scripts', file)
        : path.join(repository, 'languages', language, 'src', file);
      const result = spawnSync(process.execPath, [script, '--in', 'missing-source'], {
        cwd, encoding: 'utf8', timeout: 30000
      });

      assert.ifError(result.error);
      assert.equal(result.status, 1, file);
      assert.match(result.stderr, /Failed:.*ENOENT/, file);
    }
  }
});

test('aggregator has no VBish, MAPL or WFL grammar artifacts', () => {
  const grammar = path.join(aggregator, 'grammar');
  for (const directory of ['.antlr', 'generated-modern', 'generated-test']) {
    const root = path.join(grammar, directory);
    if (!fs.existsSync(root)) continue;
    const entries = fs.readdirSync(root, { recursive: true });
    assert.ok(!entries.some(entry => /^(Vbish|MAPL|WFL|WorkflowDsl)/.test(path.basename(entry))), directory);
  }
});
