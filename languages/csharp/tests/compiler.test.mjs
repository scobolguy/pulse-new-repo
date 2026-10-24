import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { compileCsharpToPcode } from '../src/compile-csharp-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

const wrap = body => `using System; class Program { static void Main() { ${body} } }`;
async function run(source, options = {}) {
  const artifact = compileCsharpToPcode(source, { fileName: 'test.cs', ...options });
  const mappingsById = new Map();
  mappingsById.__globals = artifact.programMap.globals;
  mappingsById.__proceduresByLabel = artifact.programMap.procedures;
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText), opcodeMap: await loadOpcodeMap(), mappingsById,
    queueTypesByName: new Map(), isoTypeIds: new Set(), inputQueue: 'csharp.run',
    sourceMessage: '', runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
  });
  assert.equal(result.error ?? null, null);
  return { artifact, result };
}

test('generic example executes on the real JavaScript p-machine', async () => {
  const source = await fs.readFile(new URL('../examples/generics.cs', import.meta.url), 'utf8');
  const { artifact, result } = await run(source);
  assert.deepEqual(result.stdout, ['SUM = 55', 'Hello from C#', 'Generic', 'True']);
  const instances = Object.values(artifact.programMap.procedures).filter(proc => proc.name === 'Program.Identity');
  assert.deepEqual(instances.map(proc => proc.typeArguments).sort(), [['bool'], ['int'], ['string']]);
  assert.equal(artifact.programMap.libraries[0].id, 'System');
});

test('integer precedence, truncating division, remainder and unchecked arithmetic', async () => {
  const { result } = await run(wrap(`
    int a = 7, b = 3;
    Console.WriteLine(a + b * 2);
    Console.WriteLine(-a / b);
    Console.WriteLine(-a % b);
    Console.WriteLine(a % -b);
    int max = 2147483647;
    Console.WriteLine(max + 1);
    Console.WriteLine(unchecked(2147483647 + 1));
    Console.WriteLine(-2147483648);
    Console.WriteLine((a + b) * 2);
  `));
  assert.deepEqual(result.stdout, ['13', '-2', '-1', '1', '-2147483648', '-2147483648', '-2147483648', '20']);
});

test('static methods, recursion, nested calls, value arguments and left-to-right evaluation', async () => {
  const { result } = await run(`
using System;
class Program {
  static int Factorial(int n) { if (n <= 1) return 1; return n * Factorial(n - 1); }
  static int Pair(int a, int b) { return a * 10 + b; }
  static string Echo(string value) { return value; }
  static void Main() {
    int i = 1;
    Console.WriteLine(Pair(i++, i++));
    Console.WriteLine(Factorial(6));
    Console.WriteLine(Echo("a nonnumeric string"));
    Console.WriteLine(Pair(Pair(1, 2), Pair(3, 4)));
    Console.WriteLine(i);
  }
}`);
  assert.deepEqual(result.stdout, ['12', '720', 'a nonnumeric string', '154', '3']);
});

test('short-circuiting, boolean typing, conditional expressions and side effects', async () => {
  const { result } = await run(wrap(`
    bool t = true, f = false;
    int n = 0;
    Console.WriteLine(t || (++n > 0));
    Console.WriteLine(f && (++n > 0));
    Console.WriteLine(n);
    Console.WriteLine(!f && t);
    Console.WriteLine(f || (++n == 1));
    Console.WriteLine(n);
    Console.WriteLine(t ? "yes" : "no");
  `));
  assert.deepEqual(result.stdout, ['True', 'False', '0', 'True', 'True', '1', 'yes']);
});

test('for, while, do/while, break, continue and nested scope', async () => {
  const { result } = await run(wrap(`
    int sum = 0;
    for (int i = 0; i < 7; i++) {
      if (i == 2) continue;
      if (i == 5) break;
      sum += i;
    }
    int j = 0;
    while (j < 3) { j++; sum += 10; }
    do { sum++; } while (false);
    for (int i = 0; i < 2; i++)
      for (int k = 0; k < 2; k++) { if (k == 0) continue; sum++; }
    Console.WriteLine(sum);
    { int local = 10; Console.WriteLine(local); }
    { int local = 20; Console.WriteLine(local); }
  `));
  assert.deepEqual(result.stdout, ['41', '10', '20']);
});

test('assignments, prefix and postfix increments, string concatenation and escapes', async () => {
  const { result } = await run(wrap(String.raw`
    int x = 2, y;
    y = x += 3;
    Console.WriteLine(x++ + ++y);
    Console.WriteLine("x=" + x + ", ok=" + true);
    string text = "Hello";
    text += " world";
    Console.Write(text);
    Console.WriteLine();
    Console.WriteLine(@"a ""quote""");
    Console.WriteLine("a\tb\u0043");
    string @class = "escaped";
    bool @true = true;
    Console.WriteLine(@class + @true);
  `));
  assert.deepEqual(result.stdout, ['11', 'x=6, ok=True', 'Hello world', 'a "quote"', 'a\tbC', 'escapedTrue']);
});

test('generic inference, explicit types, forwarding and recursive specializations are cached', async () => {
  const { artifact, result } = await run(`
using System;
class Program {
  static T Id<T>(T x) { return x; }
  static T Forward<T>(T value) { return Id<T>(value); }
  static T Repeat<T>(T value, int n) { if (n == 0) return value; return Repeat(value, n - 1); }
  static void Main() {
    Console.WriteLine(Forward("hello"));
    Console.WriteLine(Forward(42));
    Console.WriteLine(Id<bool>(false));
    Console.WriteLine(Id(1) + Id(2));
    Console.WriteLine(Repeat<string>("recursive", 5));
  }
}`);
  assert.deepEqual(result.stdout, ['hello', '42', 'False', '3', 'recursive']);
  const identities = Object.values(artifact.programMap.procedures).filter(proc => proc.name === 'Program.Id');
  assert.equal(identities.length, 3);
  assert.equal(Object.values(artifact.programMap.procedures).filter(proc => proc.name === 'Program.Repeat').length, 1);
});

test('namespaces and public cross-class static methods', async () => {
  const { result } = await run(`
namespace Demo {
  public static class Helpers { public static T Id<T>(T value) { return value; } }
  class Program { static void Main() { System.Console.WriteLine(Helpers.Id(12)); } }
}`);
  assert.deepEqual(result.stdout, ['12']);
});

test('definite assignment merges branches and accounts for returns and do/while', async () => {
  const { result } = await run(`
using System;
class Program {
  static int Value(bool flag) {
    int x;
    if (flag) x = 10; else x = 20;
    return x;
  }
  static void Main() {
    int x; do { x = 3; } while (false);
    Console.WriteLine(Value(true) + Value(false) + x);
  }
}`);
  assert.deepEqual(result.stdout, ['33']);
});

test('Int32 Main return is exposed as an exit-code global', async () => {
  const { result } = await run('class Program { static int Main() { return 17; } }');
  assert.equal(result.globals.CS_EXIT_CODE, 17);
});

test('all emitted instruction addresses have precise debugger source locations', async () => {
  const { artifact } = await run(wrap('int x = 1;\nConsole.WriteLine(x);'), { fileName: 'precise.cs' });
  const instructions = parsePcode(artifact.pcodeText);
  assert.equal(Object.keys(artifact.programMap.sourceMap).length, instructions.length);
  for (const [address, location] of Object.entries(artifact.programMap.sourceMap)) {
    assert.equal(location.sourceLanguage, 'csharp');
    assert.equal(location.sourceFile, 'precise.cs');
    assert.ok(location.sourceLine > 0 && location.sourceColumn > 0);
    assert.ok(Number(address) < instructions.length);
  }
  assert.ok(Object.values(artifact.programMap.sourceMap).some(location =>
    location.sourceLine === 2 && location.instruction === 'PRINT'));
});

test('division errors are real runtime faults, never zero or wrapped success results', async () => {
  await assert.rejects(run(wrap('int x = 0; Console.WriteLine(1 / x);')), /System.DivideByZeroException/);
  await assert.rejects(run(wrap('int x = 0; Console.WriteLine(1 % x);')), /System.DivideByZeroException/);
  await assert.rejects(run(wrap('int x = -2147483648, y = -1; Console.WriteLine(x / y);')), /System.OverflowException/);
  assert.deepEqual((await run(wrap('int x = -2147483648, y = -1; Console.WriteLine(x % y);'))).result.stdout, ['0']);
});

const invalid = [
  ['', /Exactly one static Main/],
  ['class P { static void Main() { int n; System.Console.WriteLine(n); } }', /unassigned local/],
  [wrap('int n; bool flag = true; if (flag) n = 1; Console.WriteLine(n);'), /unassigned local/],
  [wrap('int n; while (false) n = 1; Console.WriteLine(n);'), /unassigned local/],
  [wrap('int n = n;'), /unassigned local/],
  [wrap('int n = true;'), /Cannot use 'bool'/],
  [wrap('if (1) Console.WriteLine(1);'), /'bool' is required/],
  [wrap('bool b = 1 && 2;'), /'bool' is required/],
  [wrap('bool b = true < false;'), /'int' is required/],
  [wrap('int n = 1; int n = 2;'), /Duplicate or shadowed/],
  [wrap('int n = 1; { int n = 2; }'), /Duplicate or shadowed/],
  [wrap('{ int n = 1; } int n = 2;'), /Duplicate or shadowed/],
  [wrap('for (int i = 0; i < 1; i++) {} Console.WriteLine(i);'), /Unknown local/],
  [wrap('break;'), /enclosing loop/],
  [wrap('continue;'), /enclosing loop/],
  [wrap('return 1;'), /void method/],
  ['class P { static int F(bool b) { if (b) return 1; } static void Main() {} }', /Not all code paths/],
  [wrap('int n = Missing(1);'), /Unknown static method/],
  [wrap('Console.WriteLine(1, 2);'), /requires 0 or 1/],
  [wrap('Console.Write();'), /requires 1/],
  [wrap('int n = 2147483648;'), /Int32 range/],
  [wrap('int n = 2147483647 + 1;'), /Constant Int32 expression overflows/],
  [wrap('int n = 1 / 0;'), /Constant division by zero/],
  [wrap('double n = 1;'), /static|Supported|Unsupported|expression/],
  [wrap('int[] n;'), /identifier/],
  [wrap('int n = new Thing();'), /Unsupported/],
  [wrap('int n = 1; n + 1;'), /permitted as statements/],
  [wrap('if (true) int x = 1;'), /requires a block/],
  [wrap('/* unterminated'), /Unterminated block comment/],
  [wrap('string s = "unterminated;'), /Unterminated string/],
  [wrap(String.raw`string s = "\q";`), /Unsupported string escape/],
  ['class P { void Main() {} }', /Only static methods/],
  ['class P { static void Main(int n) {} }', /Entry point/],
  ['class P { static T Id<T>(T x) { return x + x; } static void Main() {} }', /'int' is required/],
  ['class P { static bool Eq<T>(T x, T y) { return x == y; } static void Main() {} }', /unconstrained/],
  ['class P { static T Id<T>(T x) { return x; } static void Main() { int a = Id<string>(1); } }', /Cannot use 'int'/],
  ['class P { static T Choose<T>(T a, T b) { return a; } static void Main() { Choose(1, "x"); } }', /Conflicting inferred/],
  ['class P { static T F<T>() { T x; return x; } static void Main() { F(); } }', /Cannot infer|unassigned/],
  ['class P { static T Id<T>(T x) { return x; } static void Main() { Id<int, bool>(1); } }', /requires 1 type/],
  ['class P { static T Id<T>(T x) { return x; } static void Main() { Id<int>(); } }', /requires 1 argument/],
  ['class P { static T Id<T>(T x) where T : class { return x; } static void Main() {} }', /Expected/],
  ['class Box<T> {}', /Expected/],
  ['class P { static void Main() {} static void Main(int n) {} }', /overloading/],
  ['class A { static int F() { return 1; } } class P { static void Main() { A.F(); } }', /inaccessible/]
];
for (const [index, [source, pattern]] of invalid.entries()) {
  test(`reject unsupported or invalid C# ${index + 1}`, () => {
    assert.throws(() => compileCsharpToPcode(source, { fileName: 'invalid.cs' }), error =>
      error instanceof SyntaxError && /C# invalid\.cs:\d+:\d+:/.test(error.message) && pattern.test(error.message));
  });
}
