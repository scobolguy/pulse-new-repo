import assert from 'node:assert/strict';
import test from 'node:test';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';
import { kotlinCoreSpecCases } from './spec-cases.mjs';

async function run(source) {
  const artifact = compileKotlinToPcode(source, { fileName: 'spec-case.kt' });
  const mappingsById = new Map();
  mappingsById.__globals = artifact.programMap.globals;
  mappingsById.__proceduresByLabel = artifact.programMap.procedures;
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText),
    opcodeMap: await loadOpcodeMap(),
    mappingsById,
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'kotlin.spec',
    sourceMessage: '',
    runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
  });
  assert.equal(result.error ?? null, null);
  return { artifact, result };
}

for (const testCase of kotlinCoreSpecCases) {
  test(`Kotlin/Core ${testCase.id} (${testCase.reference})`, async () => {
    const { artifact, result } = await run(testCase.source);
    assert.equal(artifact.programMap.sourceLanguage, 'kotlin');
    assert.equal(artifact.programMap.target, 'js');
    assert.deepEqual(result.stdout, testCase.stdout);
  });
}

test('allows val initialization on mutually exclusive branches', async () => {
  const { result } = await run(`fun choose(flag: Boolean): Int {
  val value: Int
  if (flag) { value = 10 }
  else { value = 20 }
  return value
}
fun main() {
  println(choose(true))
  println(choose(false))
}`);
  assert.deepEqual(result.stdout, ['10', '20']);
});

test('allows a fresh val within each loop iteration', async () => {
  const { result } = await run(`fun main() {
  for (n in 1..2) {
    val value: Int
    value = n
    println(value)
  }
}`);
  assert.deepEqual(result.stdout, ['1', '2']);
});

test('evaluates scalar if expressions and infers their result type', async () => {
  const { result } = await run(`fun choose(flag: Boolean) = if (flag) 3 else 4
fun main() {
  println(choose(true))
  println(choose(false))
}`);
  assert.deepEqual(result.stdout, ['3', '4']);
});

test('break and continue target the innermost loop', async () => {
  const { result } = await run(`fun main() {
  var total = 0
  for (n in 1..4) {
    if (n == 2) continue
    if (n == 4) break
    total += n
  }
  println(total)
}`);
  assert.deepEqual(result.stdout, ['4']);
});

test('specializes generic functions for concrete types once and forwards type parameters', async () => {
  const { artifact, result } = await run(`fun <T> identity(value: T): T = value
fun <T> forward(value: T): T {
  val local: T = identity<T>(value)
  return local
}
fun <T> repeatValue(value: T, n: Int): T {
  if (n == 0) return value
  return repeatValue(value, n - 1)
}
fun <T, U> first(a: T, b: U): T = a
fun marker(value: Int): Int { println(value); return value }
fun main() {
  println(forward(42))
  println(forward("hi"))
  println(identity<Boolean>(true))
  println(identity(9) + identity<Int>(1))
  println(first<Int, String>(7, "ignored"))
  println(repeatValue("done", 3))
  println(identity<Int>(1) < identity(2))
  println(first(marker(8), marker(9)))
}`);
  assert.deepEqual(result.stdout, ['42', 'hi', 'true', '10', '7', 'done', 'true', '8', '9', '8']);
  const procedures = Object.values(artifact.programMap.procedures);
  const identities = procedures.filter(proc => proc.name === 'Program.identity');
  assert.deepEqual(identities.map(proc => proc.typeArguments[0]).sort(), ['bool', 'int', 'string']);
  assert.equal(procedures.filter(proc => proc.name === 'Program.repeatValue').length, 1);
  assert.ok(identities.every(proc => proc.parameterTypes[0] === proc.returnType));
});

test('generic expression-bodied function infers a type parameter return', async () => {
  const { result } = await run(`fun <T> identity(value: T) = value
fun main() { println(identity(42)) }`);
  assert.deepEqual(result.stdout, ['42']);
});

test('supports escaped type parameter identifiers', async () => {
  const { result } = await run(`fun <\`value type\`> identity(value: \`value type\`): \`value type\` = value
fun main() { println(identity<Int>(9)) }`);
  assert.deepEqual(result.stdout, ['9']);
});

test('generic equality and printing use the specialized Kotlin scalar type', async () => {
  const { artifact, result } = await run(`fun <T> equal(first: T, second: T): Boolean = first == second
fun <T> different(first: T, second: T): Boolean = first != second
fun <T> display(value: T) {
  println(value)
  println("value=" + value)
}
fun main() {
  println(equal(42, 42))
  println(different(42, 43))
  println(equal(true, false))
  println(different(false, false))
  println(equal("Kotlin", "Kotlin"))
  println(different("Kotlin", "other"))
  display(42)
  display(true)
  display("text")
}`);
  assert.deepEqual(result.stdout, [
    'true', 'true', 'false', 'false', 'true', 'true',
    '42', 'value=42', 'true', 'value=true', 'text', 'value=text'
  ]);
  const equality = Object.values(artifact.programMap.procedures)
    .filter(proc => proc.name === 'Program.equal');
  assert.deepEqual(equality.map(proc => proc.typeArguments[0]).sort(), ['bool', 'int', 'string']);
  assert.match(artifact.pcodeText, /\bSTREQ\b/);
});

test('generic functions support Kotlin Byte and Short with signed boundaries', async () => {
  const { artifact, result } = await run(`fun <T> identity(value: T): T = value
fun <T> equal(first: T, second: T): Boolean = first == second
fun <T> show(value: T) { println("value=" + value) }
fun main() {
  var low: Byte = -128
  var high: Short = 32767
  println(identity(low))
  println(identity<Short>(high))
  println(identity<Byte>(127))
  println(equal(low, identity<Byte>(-128)))
  println(low + high)
  low--
  high++
  show(low)
  show(high)
}`);
  assert.deepEqual(result.stdout, ['-128', '32767', '127', 'true', '32639', 'value=127', 'value=-32768']);
  const types = Object.values(artifact.programMap.procedures)
    .filter(proc => proc.name === 'Program.identity').map(proc => proc.typeArguments[0]).sort();
  assert.deepEqual(types, ['sbyte', 'short']);
});

const rejectionCases = [
  ['reassignment of a val local', `fun main() {
  val answer = 41
  answer = 42
}`, /Val 'answer' cannot be reassigned/],
  ['increment of a val local', `fun main() {
  val answer = 41
  answer++
}`, /Val 'answer' cannot be incremented/],
  ['possible reassignment after a branch', `fun main() {
  val answer: Int
  val condition = true
  if (condition) { answer = 1 }
  answer = 2
}`, /Val 'answer' cannot be reassigned/],
  ['assignment to an outer val in a loop', `fun main() {
  val answer: Int
  for (item in 1..2) { answer = item }
}`, /Val 'answer' cannot be reassigned/],
  ['mutation of a for-loop variable', `fun main() {
  for (item in 1..3) {
    item++
  }
}`, /Val 'item' cannot be incremented/],
  ['break outside a loop', `fun main() { break }`, /'break' requires an enclosing loop/],
  ['labeled break', `fun main() { while (true) { break@outer } }`, /Labeled jumps are not supported/],
  ['use of an unassigned local', `fun main() {
  var answer: Int
  println(answer)
}`, /unassigned local 'answer'/],
  ['mismatched assignment type', `fun main() {
  var answer: Int = 1
  answer = true
}`, /Cannot use 'bool' where 'int' is required/],
  ['unknown local', `fun main() {
  println(missing)
}`, /Unknown local 'missing'/],
  ['unsupported string templates', `fun main() {
  val answer = 42
  println("answer: $answer")
}`, /String templates are not supported/],
  ['floating-point literals', `fun main() {
  val ratio = 1.5
  println(ratio)
}`, /Unsupported Kotlin literal/],
  ['nullable types', `fun main() {
  val text: String? = null
}`, /Unsupported Kotlin type 'String\?'/],
  ['classes', `class Example
fun main() {}`, /Only top-level functions are supported/],
  ['generic upper bounds', `fun <T: Int> identity(value: T): T = value
fun main() {}`, /Generic type bounds are not supported/],
  ['generic where constraints', `fun <T> identity(value: T): T where T: Int = value
fun main() {}`, /Generic type constraints are not supported/],
  ['generic parameter modifiers', `fun <reified T> identity(value: T): T = value
fun main() {}`, /Generic type parameter modifiers are not supported/],
  ['generic varargs', `fun <T> first(vararg values: T): T = values
fun main() {}`, /Function parameter modifiers are not supported/],
  ['generic type mismatch', `fun <T> identity(value: T): T = value
fun main() { println(identity<String>(1)) }`, /Cannot use 'int' where 'string'/],
  ['conflicting generic inference', `fun <T> first(a: T, b: T): T = a
fun main() { println(first(1, "x")) }`, /Conflicting inferred types/],
  ['uninferred generic type', `fun <T> nothing(): Int = 1
fun main() { println(nothing()) }`, /Cannot infer type argument 'T'/],
  ['wrong generic argument count', `fun <T> identity(value: T): T = value
fun main() { println(identity<Int, String>(1)) }`, /requires 1 type argument/],
  ['unsupported generic operations', `fun <T> add(value: T): T = value + value
fun main() {}`, /'int' is required/],
  ['generic nullable types', `fun <T> identity(value: T?): T? = value
fun main() {}`, /Unsupported Kotlin type 'T\?'/],
  ['Byte constant outside its range', `fun main() { val value: Byte = 128 }`, /Cannot use 'int' where 'sbyte'/],
  ['Short constant outside its range', `fun main() { val value: Short = -32769 }`, /Cannot use 'int' where 'short'/],
  ['implicit Byte widening', `fun main() { val byte: Byte = 1
val number: Int = byte }`, /Cannot use 'sbyte' where 'int'/],
  ['implicit Byte to Short conversion', `fun main() { val byte: Byte = 1
val number: Short = byte }`, /Cannot use 'sbyte' where 'short'/],
  ['generic Byte argument mismatch', `fun <T> identity(value: T): T = value
fun main() { val number: Int = 1
println(identity<Byte>(number)) }`, /Cannot use 'int' where 'sbyte'/],
  ['mixed integer equality', `fun main() { val byte: Byte = 1
val number: Int = 1
println(byte == number) }`, /Kotlin equality requires matching integer types/],
  ['unconstrained receiver for string concatenation', `fun <T> stringify(value: T): String = value + "x"
fun main() {}`, /unconstrained type parameter cannot be the receiver/],
  ['generic type projections', `fun <T> identity(value: T): T = value
fun main() { println(identity<out Int>(1)) }`, /Type projections are not supported/],
  ['generic star projection', `fun <T> identity(value: T): T = value
fun main() { println(identity<*>(1)) }`, /Type projections are not supported/],
  ['unknown generic type argument', `fun <T> identity(value: T): T = value
fun main() { println(identity<constructor>(1)) }`, /Unsupported Kotlin type 'constructor'/],
  ['generic class', `class Box<T>
fun main() {}`, /Only top-level functions are supported/],
  ['generic main', `fun <T> main() {}`, /entry point must be fun main/],
  ['generic service handler', `import pulse.http.HttpGet
@HttpGet("/health")
fun <T> handler(): String = "{}"`, /handlers must be non-generic, take no parameters and return String/],
  ['duplicate generic type parameters', `fun <T, T> identity(value: T): T = value
fun main() {}`, /Duplicate type parameter/],
  ['type arguments cannot escape their declaration', `fun <T> identity(value: T): T = value
fun main() { println(identity<T>(1)) }`, /Unsupported Kotlin type 'T'/],
  ['default arguments', `fun square(value: Int = 2): Int = value * value
fun main() {}`, /Default parameter values are not supported/],
  ['named arguments', `fun square(value: Int): Int = value * value
fun main() {
  println(square(value = 2))
}`, /Named and spread arguments are not supported/],
  ['exclusive ranges', `fun main() {
  for (n in 1..<3) {
    println(n)
  }
}`, /Exclusive ranges are not supported/],
  ['ranges as standalone values', `fun main() {
  println(1..3)
}`, /Unsupported binary operator '\.\.'/],
  ['property access', `fun main() {
  val text = "hello"
  println(text.length)
}`, /Property access, indexing, and null assertions are not supported/],
  ['malformed syntax', 'fun main( {', /Kotlin rejection\.kt:1:11: mismatched input/]
];

for (const [description, source, error] of rejectionCases) {
  test(`rejects ${description}`, () => {
    assert.throws(() => compileKotlinToPcode(source, { fileName: 'rejection.kt' }), error);
  });
}
