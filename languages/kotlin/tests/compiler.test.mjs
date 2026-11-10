import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('evaluates Kotlin Elvis expressions with short-circuit fallback evaluation', async () => {
  const { result } = await run(`fun fallback(): Int {
  println("fallback")
  return 7
}
fun main() {
  println(null ?: fallback())
  println(3 ?: fallback())
}`);
  assert.deepEqual(result.stdout, ['fallback', '7', '3']);
});

test('allocates stateful constructor properties and dispatches instance getters', async () => {
  const { result } = await run(`class Box(val value: Int)
fun main() {
  println(Box(7).value)
}`);
  assert.deepEqual(result.stdout, ['7']);
});

test('allocates and indexes bounded IntArray values', async () => {
  const { result } = await run(`fun main() {
  val values = IntArray(2)
  values[0] = 9
  values[1] = values[0] + 1
  println(values[1])
}`);
  assert.deepEqual(result.stdout, ['10']);
});

test('compound assignment on array elements reads the element and evaluates the receiver once', async () => {
  const { result } = await run(`fun pick(values: IntArray, count: IntArray): IntArray {
  count[0] += 1
  return values
}
fun main() {
  val values = IntArray(2)
  val calls = IntArray(1)
  values[0] = 5
  values[0] += 7
  values[1] = 100
  values[1] -= 58
  values[0] *= 2
  values[0] /= 4
  pick(values, calls)[1] += 1
  println(values[0])
  println(values[1])
  println(calls[0])
}`);
  assert.deepEqual(result.stdout, ['6', '43', '1']);
});

test('narrow array elements wrap after compound assignment', async () => {
  const { result } = await run(`fun main() {
  val bytes = ByteArray(1)
  bytes[0] = 127
  bytes[0] += 1
  println(bytes[0])
}`);
  assert.deepEqual(result.stdout, ['-128']);
});

test('reads the bounded IntArray size property', async () => {
  const { result } = await run(`fun main() {
  println(IntArray(3).size)
}`);
  assert.deepEqual(result.stdout, ['3']);
});

test('supports bounded primitive array types', async () => {
  const { result } = await run(`fun main() {
  val flags = BooleanArray(1)
  flags[0] = true
  val bytes = ByteArray(1)
  bytes[0] = -2
  val shorts = ShortArray(1)
  shorts[0] = 300
  println(flags[0])
  println(bytes[0])
  println(shorts[0])
}`);
  assert.deepEqual(result.stdout, ['true', '-2', '300']);
});

test('evaluates null equality without treating null as an integer value', async () => {
  const { result } = await run(`fun main() {
  println(null == null)
  println(null != null)
}`);
  assert.deepEqual(result.stdout, ['true', 'false']);
});

test('lowers non-null assertions through the shared reference intrinsic', async () => {
  const { artifact } = await run(`class Box {
  fun value(): Int = 1
}
fun unwrap(value: Box): Box = value!!
fun main() {}`);
  assert.match(artifact.pcodeText, /CALL_EXT system\.reference\.notnull 1/);
});

test('safe-calls stateless Unit methods only when the receiver is non-null', async () => {
  const { result } = await run(`class Box {
  fun ping() { println("ping") }
}
fun use(value: Box) {
  value?.ping()
}
fun main() {
  use(null)
}`);
  assert.deepEqual(result.stdout, []);
});

test('matches null reference subjects in when expressions', async () => {
  const { result } = await run(`class Box {
  fun ping() { println("ping") }
}
fun label(value: Box): String = when (value) {
  null -> "none"
  else -> "some"
}
fun main() {
  println(label(null))
}`);
  assert.deepEqual(result.stdout, ['none']);
});

test('supports nullable string locals with Elvis fallback', async () => {
  const { artifact, result } = await run(`fun main() {
  val text: String? = null
  println(text ?: "fallback")
}`);
  assert.match(artifact.pcodeText, /\bPUSH_NULL\b/);
  assert.deepEqual(result.stdout, ['fallback']);
});

test('passes null to nullable string parameters and uses Elvis fallback', async () => {
  const { result } = await run(`fun display(text: String?) {
  println(text ?: "fallback")
}
fun main() {
  display(null)
}`);
  assert.deepEqual(result.stdout, ['fallback']);
});

test('returns null from nullable string functions and applies caller Elvis fallback', async () => {
  const { result } = await run(`fun maybe(): String? = null
fun main() {
  println(maybe() ?: "fallback")
}`);
  assert.deepEqual(result.stdout, ['fallback']);
});

test('smart-casts nullable strings after an explicit null check', async () => {
  const { result } = await run(`fun size(text: String?): Int {
  if (text != null) return text.length
  return 0
}
fun main() {
  println(size("ok"))
  println(size(null))
}`);
  assert.deepEqual(result.stdout, ['2', '0']);
});

test('updates nullable smart-casts after var assignment', async () => {
  const { result } = await run(`fun main() {
  var text: String? = null
  text = "ok"
  println(text.length)
}`);
  assert.deepEqual(result.stdout, ['2']);
});

test('supports nullable integer locals with real null fallback', async () => {
  const { result } = await run(`fun main() {
  val value: Int? = null
  println(value ?: 42)
}`);
  assert.deepEqual(result.stdout, ['42']);
});

test('lowers Kotlin throw expressions to the shared exception intrinsic', async () => {
  const { artifact } = await run(`fun fail(): Int {
  throw "boom"
}
fun main() {}`);
  assert.match(artifact.pcodeText, /CALL_EXT system\.exception\.throw 1/);
});

test('allows throw expressions in value-returning function bodies', async () => {
  const { artifact } = await run(`fun fail(): Int = throw "boom"
fun main() {}`);
  assert.match(artifact.pcodeText, /CALL_EXT system\.exception\.throw 1/);
});

test('uses throw as Kotlin Nothing in value-returning branches', async () => {
  const { result } = await run(`fun choose(flag: Boolean): Int = if (flag) 1 else throw "boom"
fun main() {
  println(choose(true))
}`);
  assert.deepEqual(result.stdout, ['1']);
});

test('emits finally cleanup before an uncaught throw', async () => {
  const artifact = compileKotlinToPcode(`fun main() {
  try { throw "boom" }
  finally { println("cleanup") }
}`, { fileName: 'finally.kt' });
  const cleanup = artifact.pcodeText.indexOf('PUSH_STR "cleanup"');
  const thrown = artifact.pcodeText.indexOf('CALL_EXT system.exception.throw 1');
  assert.ok(cleanup >= 0 && cleanup < thrown);
});

test('emits finally cleanup before break and continue jumps', async () => {
  const artifact = compileKotlinToPcode(`fun main() {
  while (true) {
    try { break }
    finally { println("cleanup") }
  }
}`, { fileName: 'loop-finally.kt' });
  const cleanup = artifact.pcodeText.indexOf('PUSH_STR "cleanup"');
  const jump = artifact.pcodeText.indexOf('JMP CS_LOOP_END');
  assert.ok(cleanup >= 0 && jump >= 0 && cleanup < jump);
});

test('executes finally cleanup on return', async () => {
  const { result } = await run(`fun main() {
  try { return }
  finally { println("cleanup") }
}`);
  assert.deepEqual(result.stdout, ['cleanup']);
});

test('executes finally cleanup before reporting an uncaught throw', async () => {
  const artifact = compileKotlinToPcode(`fun main() {
  try { throw "boom" }
  finally { println("cleanup") }
}`, { fileName: 'throw-finally.kt' });
  const mappingsById = new Map();
  mappingsById.__globals = artifact.programMap.globals;
  mappingsById.__proceduresByLabel = artifact.programMap.procedures;
  await assert.rejects(async () => executeProgram({
    instructions: parsePcode(artifact.pcodeText),
    opcodeMap: await loadOpcodeMap(),
    mappingsById,
    queueTypesByName: new Map(),
    isoTypeIds: new Set(),
    inputQueue: 'kotlin.spec',
    sourceMessage: '',
    runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
  }), /KotlinThrow: boom/);
});

test('evaluates subject when expressions with equality alternatives and an inferred return type', async () => {
  const { result } = await run(`fun label(value: Int) = when (value) {
  0 -> "zero"
  1, 2 -> "small"
  else -> "other"
}
fun main() {
  println(label(0))
  println(label(2))
  println(label(9))
}`);
  assert.deepEqual(result.stdout, ['zero', 'small', 'other']);
});

test('evaluates inclusive, exclusive, and negated integer ranges in when branches', async () => {
  const { result } = await run(`fun label(value: Int): String = when (value) {
  in 1..3 -> "inclusive"
  !in 4..<8 -> "outside"
  else -> "other"
}
fun main() {
  println(label(3))
  println(label(7))
  println(label(9))
}`);
  assert.deepEqual(result.stdout, ['inclusive', 'other', 'outside']);
});

test('executes statement when branches, evaluates subjects once, and permits no else', async () => {
  const { result } = await run(`fun subject(): Int {
  println("subject")
  return 3
}
fun main() {
  var answer = 0
  val selected: Int
  when (subject()) {
    1 -> { answer = 10; selected = 1; println("one") }
    2, 3 -> {
      answer = 20
      selected = 2
      println("small")
    }
    in 4..<8 -> { answer = 30; selected = 3 }
    else -> { answer = 40; selected = 4 }
  }
  println(answer)
  println(selected)
  when (9) { 1 -> answer = 99 }
  println(answer)
}`);
  assert.deepEqual(result.stdout, ['subject', 'small', '20', '2', '20']);
});

test('executes subjectless statement when conditions as booleans', async () => {
  const { result } = await run(`fun main() {
  var value = 2
  var answer = 0
  when {
    value < 0 -> answer = 10
    value == 1 || value == 2 -> {
      answer = 20
      println("matched")
    }
    else -> answer = 30
  }
  println(answer)
}`);
  assert.deepEqual(result.stdout, ['matched', '20']);
});

test('short-circuits subjectless conditions and comma-separated when alternatives', async () => {
  const { result } = await run(`fun check(label: String, result: Boolean): Boolean {
    println(label)
  return result
}
fun main() {
  when {
    check("a", false) -> println("wrong")
    check("b", false), check("c", true), check("d", true) -> println("matched")
    else -> println("wrong")
  }
}`);
  assert.deepEqual(result.stdout, ['a', 'b', 'c', 'matched']);
});

test('returns from a statement when branch', async () => {
  const { result } = await run(`fun label(value: Int): String {
  when (value) {
    1 -> return "one"
    else -> return "other"
  }
  return "unreachable"
}
fun main() {
  println(label(1))
  println(label(2))
}`);
  assert.deepEqual(result.stdout, ['one', 'other']);
});

test('break and continue inside when branches target the innermost loop', async () => {
  const { result } = await run(`fun main() {
  var total = 0
  for (outer in 1..3) {
    for (inner in 1..4) {
      when (inner) {
        1 -> continue
        2 -> break
        else -> total += 100
      }
    }
    total += outer
  }
  println(total)
}`);
  assert.deepEqual(result.stdout, ['6']);
});

test('runs the Kotlin pulse demo through the compiler and JavaScript PMachine', async () => {
  const source = await readFile(new URL('../examples/pulse-demo.kt', import.meta.url), 'utf8');
  const { result } = await run(source);
  assert.deepEqual(result.stdout, [
    'Hello from Kotlin', '42', 'true', 'zero', 'small', 'other', 'small', 'medium', 'outside'
  ]);
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
  ['nullable scalar arithmetic without null check', `fun add(value: Int?): Int = value + 1
fun main() {}`, /Nullable value requires a null check/],
  ['nullable scalar comparison without null check', `fun compare(value: Int?): Boolean = value == 0
fun main() {}`, /Nullable value requires a null check/],
  ['nullable string length without assertion', `fun size(text: String?): Int = text.length
fun main() {}`, /Nullable string requires a non-null assertion/],
  ['null returned from non-nullable string function', `fun bad(): String = null
fun main() {}`, /Cannot use 'null' where 'string'/],
  ['null passed to non-nullable string parameter', `fun display(text: String) { println(text) }
fun main() { display(null) }`, /Cannot use 'null' where 'string'/],
  ['catch blocks before exception-frame ABI', `fun main() {
  try { println("body") }
  catch (failure: Exception) { println("caught") }
}`, /catch blocks require the P-machine exception-frame ABI/],
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
  ['unknown string-template local', `fun main() { println("answer: $missing") }`, /Unknown local 'missing'/],
  ['empty template expression', 'fun main() { println("${}") }', /Kotlin .*:1:\d+:/],
  ['invalid template expression', 'fun main() { println("${42 + }") }', /Kotlin .*:1:\d+:/],
  ['floating-point literals', `fun main() {
  val ratio = 1.5
  println(ratio)
}`, /Unsupported Kotlin literal/],
  ['unsupported class types', `class Example {
  fun value(): Float = 1.0
}
fun main() {}`, /Unsupported Kotlin literal/],
  ['generic upper bounds', `fun <T: Int> identity(value: T): T = value
fun main() {}`, /Generic type bounds are not supported/],
  ['generic where constraints', `fun <T> identity(value: T): T where T: Int = value
fun main() {}`, /Generic type constraints are not supported/],
  ['generic parameter modifiers', `fun <reified T> identity(value: T): T = value
fun main() {}`, /Generic type parameter modifiers are not supported/],
  ['generic varargs indexing', `fun <T> first(vararg values: T): T = values[0]
fun main() {}`, /Property access, indexing, and null assertions are not supported/],
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
  ['generic nullable operations', `fun <T> identity(value: T?): T = value + value
fun main() {}`, /'int' is required|Nullable value requires a null check/],
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
  ['generic class with unsupported type', `class Box<T> {
  fun value(): Float = 1.0
}
fun main() {}`, /Unsupported Kotlin literal/],
  ['generic main', `fun <T> main() {}`, /entry point must be fun main/],
  ['generic service handler', `import pulse.http.HttpGet
@HttpGet("/health")
fun <T> handler(): String = "{}"`, /handlers must be non-generic, take no parameters and return String/],
  ['duplicate generic type parameters', `fun <T, T> identity(value: T): T = value
fun main() {}`, /Duplicate type parameter/],
  ['type arguments cannot escape their declaration', `fun <T> identity(value: T): T = value
fun main() { println(identity<T>(1)) }`, /Unsupported Kotlin type 'T'/],
  ['non-trailing default arguments', `fun square(value: Int = 2, other: Int): Int = value * other
fun main() {}`, /Only trailing positional default parameters/],
  ['default referencing a later parameter', `fun value(first: Int = second, second: Int = 2): Int = first
fun main() {}`, /Unknown local 'second'/],
  ['wrong default type', `fun value(first: Int = "wrong"): Int = first
fun main() {}`, /Cannot use 'string' where 'int'/],
  ['length on an integer', `fun main() { println(42.length) }`, /Cannot use 'int' where 'string'/],
  ['String parsing is not a narrowing conversion', `fun main() { println("42".toInt()) }`, /Unsupported explicit conversion/],
  ['Boolean numeric conversion', `fun main() { println(false.toByte()) }`, /Unsupported explicit conversion/],
  ['conversion arguments', `fun main() { println(42.toByte(1)) }`, /requires no arguments/],
  ['conversion without call', `fun main() { println(42.toByte) }`, /requires a function call/],
  ['membership outside a range', `fun main() { println(1 in 2) }`, /Membership requires an integer range/],
  ['subjectless when expressions', `fun main() { println(when { true -> 1; else -> 2 }) }`, /Subjectless when expressions/],
  ['when expressions without else', `fun main() { println(when (1) { 1 -> 2 }) }`, /requires a final else branch/],
  ['side-effecting when subjects', `fun value(): Int = 1
fun main() { println(when (value()) { 1 -> 2; else -> 3 }) }`, /subject must be a local value or literal/],
  ['non-range membership in when expressions', `fun main() { println(when (1) { in 2 -> 2; else -> 4 }) }`, /require an integer range/],
  ['type conditions in when expressions', `fun main() { println(when (1) { is Int -> 2; else -> 4 }) }`, /only equality and integer range conditions/],
  ['incompatible when branch types', `fun main() { println(when (1) { 1 -> 2; else -> "other" }) }`, /Cannot use 'string' where 'int'/],
  ['val assignment in non-exhaustive when statement', `fun main() {
  val selected: Int
  when (1) { 1 -> selected = 1 }
  println(selected)
}`, /unassigned local 'selected'/],
  ['named arguments', `fun square(value: Int): Int = value * value
fun main() {
  println(square(value = 2))
}`, /Named and spread arguments are not supported/],
  ['non-range for-loop source', `fun main() {
  for (n in 1 + 2) { println(n) }
}`, /For loops must iterate over a numeric range/],
  ['unsupported property access', `fun main() {
  val text = "hello"
  println(text.indices)
}`, /indices requires a function call/],
  ['malformed syntax', 'fun main( {', /Kotlin rejection\.kt:1:11: mismatched input/],
  // Object parse contexts have no typeParameters/primaryConstructor accessors;
  // readClass must not crash with a TypeError on them.
  ['top-level object with unsupported members', `object Registry {
  fun describe() = Any()
}
fun main() {}`, /Kotlin rejection\.kt:2:\d+: Expression-bodied functions need an explicit supported return type/]
];

for (const [description, source, error] of rejectionCases) {
  test(`rejects ${description}`, () => {
    assert.throws(() => compileKotlinToPcode(source, { fileName: 'rejection.kt' }), error);
  });
}
