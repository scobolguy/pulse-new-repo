import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const languageRoot = fileURLToPath(new URL('../', import.meta.url));
const grammarDir = path.join(languageRoot, 'grammar');
const grammarJar = path.resolve(languageRoot, '..', '..', 'virtualMachines', 'esp32',
  'aggregator', 'tools', 'antlr-4.13.2-complete.jar');
let generatedDir;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr}`);
  return result;
}

before(async () => {
  generatedDir = await mkdtemp(path.join(os.tmpdir(), 'pulse-kotlin-grammar-'));
  run('java', ['-jar', grammarJar, '-Dlanguage=Java', '-no-listener', '-o', generatedDir, 'Kotlin.g4'], {
    cwd: grammarDir
  });
  const javaFiles = (await readdir(generatedDir))
    .filter(name => name.endsWith('.java'))
    .map(name => path.join(generatedDir, name));
  assert.ok(javaFiles.length > 0, 'ANTLR did not generate Java parser sources');
  const harness = path.join(languageRoot, 'tests', 'GrammarValidationHarness.java');
  run('javac', ['-cp', grammarJar, '-d', generatedDir, ...javaFiles, harness]);
});

after(async () => {
  if (generatedDir) await rm(generatedDir, { recursive: true, force: true });
});

async function parse(sources) {
  const inputPaths = await Promise.all(Object.entries(sources).map(async ([name, source]) => {
    const inputPath = path.join(generatedDir, name);
    await writeFile(inputPath, source, 'utf8');
    return inputPath;
  }));
  const result = spawnSync('java', [
    '-cp', `${grammarJar}${path.delimiter}${generatedDir}`,
    'GrammarValidationHarness', ...inputPaths
  ], { encoding: 'utf8' });
  assert.ifError(result.error);
  return `${result.stdout}${result.stderr}`;
}

test('accepts supported Kotlin samples and rejects malformed source', async t => {
  const diagnostics = await parse({
    'valid-core.kt': `
    package demo.app
    import kotlin.math.abs
    import kotlin.collections.*

    enum class Color { RED, GREEN, BLUE }
    data class Counter(val start: Int = 0) {
      private var current: Int = start
      fun next(step: Int = 1): Int {
        current += step
        return current
      }
      val value: Int
        get() = current
    }

    fun <T> identity(value: T): T = value
    fun apply(op: (Int) -> Int, value: Int): Int = op(value)
    fun main() {
      val counter = Counter()
      for (i in 0..3) {
        if (i % 2 == 0) println(counter.next())
      }
      val label = when (counter.next()) {
        in 1..5 -> "small"
        else -> "large"
      }
      val doubled = listOf(1, 2).map { it * 2 }
      println(label)
    }
  `,
    'valid-advanced.kt': `
    open class Base {
      open fun render(): String = "base"
    }
    class Child : Base() {
      override fun render(): String = "child"
      companion object {
        const val VERSION: Int = 1
      }
    }
    fun guarded(value: String?): String {
      try {
        return value ?: "empty"
      } catch (failure: Exception) {
        return "error"
      } finally {
        println("done")
      }
    }
  `,
    'invalid.kt': 'fun broken( {'
  });
  await t.test('parses packages, imports, declarations, generics, control flow and lambdas', () => {
    assert.doesNotMatch(diagnostics, /valid-core\.kt:\d+:\d+:/);
  });
  await t.test('parses nullable types, inheritance, companion objects and try expressions', () => {
    assert.doesNotMatch(diagnostics, /valid-advanced\.kt:\d+:\d+:/);
  });
  await t.test('reports malformed Kotlin source', () => {
    assert.match(diagnostics, /invalid\.kt:\d+:\d+:/);
  });
});
