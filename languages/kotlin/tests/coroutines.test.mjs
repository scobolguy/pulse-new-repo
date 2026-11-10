import assert from 'node:assert/strict';
import test from 'node:test';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { PMachineScheduler, executeProgram, loadOpcodeMap, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

function options(artifact, opcodeMap) {
  const mappingsById = new Map();
  mappingsById.__globals = artifact.programMap.globals;
  mappingsById.__proceduresByLabel = artifact.programMap.procedures;
  return {
    instructions: parsePcode(artifact.pcodeText), opcodeMap, mappingsById,
    programMap: artifact.programMap, runtimeContext: {}
  };
}

async function run(source) {
  const artifact = compileKotlinToPcode(source, { fileName: 'coroutine-case.kt' });
  const prepared = options(artifact, await loadOpcodeMap());
  prepared.runtimeContext = { maxSteps: 100000, maxCallDepth: 64 };
  return executeProgram(prepared);
}

test('Kotlin coroutine yield cooperatively releases a P-machine slot', async () => {
  const scheduler = new PMachineScheduler({ slots: 1, quantum: 1000 });
  const opcodeMap = await loadOpcodeMap();
  const artifacts = [1, 2].map(value => compileKotlinToPcode(
    `import kotlinx.coroutines.yield
fun main() {
  println(${value})
  yield()
  println(${value + 2})
}`));
  const results = await Promise.all(artifacts.map(artifact =>
    scheduler.execute(options(artifact, opcodeMap))));
  assert.deepEqual(results.map(result => result.stdout), [['1', '3'], ['2', '4']]);
  assert.ok(scheduler.getStatus().yields >= 2);
});

test('builders run suspend lambdas direct-style with captured mutable locals', async () => {
  const result = await run(`import kotlin.coroutines.*
import helpers.*
fun builder(c: suspend () -> Unit) {
    c.startCoroutine(EmptyContinuation)
}
suspend fun greet(): String = "OK"
fun box(): String {
    var result = ""
    builder {
        result = greet()
    }
    return result
}
fun main() { println(box()) }`);
  assert.deepEqual(result.stdout, ['OK']);
  assert.equal(result.error, null);
});

test('handleResultContinuation runs after the body and throw guards stay honest', async () => {
  const result = await run(`import helpers.*
import kotlin.coroutines.*
fun builder(c: suspend () -> Unit): String {
    var ok = false
    c.startCoroutine(handleResultContinuation {
        ok = true
    })
    if (!ok) throw RuntimeException("Was not called")
    return "OK"
}
fun box(): String {
    return builder {}
}
fun main() { println(box()) }`);
  assert.deepEqual(result.stdout, ['OK']);
});

test('inlined builders support scalar parameters, loops and repeated specialization', async () => {
  const result = await run(`import kotlin.coroutines.*
import helpers.*
fun repeatRun(times: Int, c: suspend () -> Unit) {
    var index = 0
    while (index < times) {
        c.startCoroutine(EmptyContinuation)
        index = index + 1
    }
}
fun box(): String {
    var count = 0
    repeatRun(3) { count = count + 1 }
    repeatRun(2) { count = count + 10 }
    return if (count == 23) "OK" else "Fail $count"
}
fun main() { println(box()) }`);
  assert.deepEqual(result.stdout, ['OK']);
});

test('early returns in inlined builders preserve values and skipped tails', async () => {
  const result = await run(`import kotlin.coroutines.*
import helpers.*
fun pick(flag: Boolean, c: suspend () -> Unit): Int {
    c.startCoroutine(EmptyContinuation)
    if (flag) {
        return 1
    }
    c.startCoroutine(EmptyContinuation)
    return 2
}
fun main() {
    var runs = 0
    val first = pick(true) { runs = runs + 1 }
    val second = pick(false) { runs = runs + 1 }
    println(first)
    println(second)
    println(runs)
}`);
  assert.deepEqual(result.stdout, ['1', '2', '3']);
});

test('inlined lambdas bind declared parameters from the function type', async () => {
  const result = await run(`import kotlin.coroutines.*
import helpers.*
fun forEachValue(limit: Int, c: suspend (Int) -> Unit) {
    var index = 0
    while (index < limit) {
        c(index)
        index = index + 1
    }
}
fun box(): String {
    var sum = 0
    forEachValue(4) { item ->
        sum = sum + item
    }
    return if (sum == 6) "OK" else "Fail $sum"
}
fun main() { println(box()) }`);
  assert.deepEqual(result.stdout, ['OK']);
});

test('resume-immediately intrinsics lower to direct-style side effects and values', async () => {
  const result = await run(`import helpers.*
import kotlin.coroutines.*
import kotlin.coroutines.intrinsics.*
suspend fun suspendHere(): String {
    var z = "fail1"
    suspendCoroutineUninterceptedOrReturn<Unit> { x ->
        z = "OK"
        x.resume(Unit)
        COROUTINE_SUSPENDED
    }
    return z
}
suspend fun supply(value: Int): Int = suspendCoroutineUninterceptedOrReturn { c ->
    c.resume(value + 1)
    COROUTINE_SUSPENDED
}
fun builder(c: suspend () -> Unit) {
    c.startCoroutine(EmptyContinuation)
}
fun box(): String {
    var result = "fail2"
    builder {
        result = suspendHere()
    }
    val answer = supply(41)
    return if (answer == 42) result else "Fail $answer"
}
fun main() { println(box()) }`);
  assert.deepEqual(result.stdout, ['OK']);
});

test('receiver function types bind an implicit receiver with mutable member properties', async () => {
  const result = await run(`import helpers.*
import kotlin.coroutines.*
import kotlin.coroutines.intrinsics.*
class Controller {
    var result = ""
    suspend fun <T> suspendWithResult(value: T): T = suspendCoroutineUninterceptedOrReturn { c ->
        c.resume(value)
        COROUTINE_SUSPENDED
    }
}
fun builder(c: suspend Controller.() -> Unit): String {
    val controller = Controller()
    c.startCoroutine(controller, EmptyContinuation)
    return controller.result
}
fun box(): String {
    var value = builder {
        var x = 1
        while (suspendWithResult(x) <= 3) {
            result += x
            x = x + 1
        }
        result += "."
    }
    if (value != "123.") return "fail1: $value"
    value = builder {
        var r = ""
        run {
            r += suspendWithResult("O")
        }
        run {
            r += "K"
        }
        result = r
    }
    if (value != "OK") return "fail2: $value"
    return "OK"
}
fun main() { println(box()) }`);
  assert.deepEqual(result.stdout, ['OK']);
  assert.equal(result.error, null);
});

test('member property writes lower to setters outside coroutines too', async () => {
  const result = await run(`class Box {
    var count = 1
}
fun main() {
    val box = Box()
    box.count = 40
    box.count += 2
    println(box.count)
}`);
  assert.deepEqual(result.stdout, ['42']);
});

const coroutineRejections = [
  ['receiver lambdas invoked directly', `import helpers.*
import kotlin.coroutines.*
class Controller { var result = "" }
fun builder(c: suspend Controller.() -> Unit) {
    c()
}
fun main() { builder {} }`, /Receiver lambdas can only be started with startCoroutine\(receiver, continuation\)/],
  ['receiver startCoroutine without a receiver argument', `import helpers.*
import kotlin.coroutines.*
class Controller { var result = "" }
fun builder(c: suspend Controller.() -> Unit) {
    c.startCoroutine(EmptyContinuation)
}
fun main() { builder {} }`, /startCoroutine requires 2 argument\(s\) for this function type/],
  ['true suspension intrinsics', `import kotlin.coroutines.*
suspend fun block(): String = suspendCoroutine { 0 }
fun main() {}`, /True suspension intrinsics are not supported/],
  ['intrinsic lambdas that never resume', `import kotlin.coroutines.intrinsics.*
suspend fun block(): String = suspendCoroutineUninterceptedOrReturn { c ->
    COROUTINE_SUSPENDED
}
fun main() {}`, /require resume\(value\) on the continuation immediately before COROUTINE_SUSPENDED/],
  ['intrinsic continuations that escape', `import kotlin.coroutines.intrinsics.*
fun stash(value: Int): Int = value
suspend fun block(): Int = suspendCoroutineUninterceptedOrReturn { c ->
    stash(c)
    c.resume(1)
    COROUTINE_SUSPENDED
}
fun main() {}`, /may only be resumed immediately/],
  ['exception continuations', `import helpers.*
import kotlin.coroutines.*
fun builder(c: suspend () -> Unit) {
    c.startCoroutine(handleExceptionContinuation {
    })
}
fun main() { builder {} }`, /Exception continuations require real suspension/],
  ['lambda arity mismatches', `import kotlin.coroutines.*
fun apply(c: suspend () -> Unit) { c.startCoroutine(EmptyContinuation) }
fun main() { apply { value -> println(value) } }`, /requires a lambda with 0 parameter\(s\)/],
  ['lambdas outside builders', `fun main() {
  val block = { println(1) }
}`, /Lambdas are only supported as arguments/],
  ['recursive builders', `import kotlin.coroutines.*
fun loop(c: suspend () -> Unit) { loop(c) }
fun main() { loop {} }`, /Function-typed arguments must be lambda literals|Inline expansion depth exceeded/],
  ['returns inside lambdas', `import kotlin.coroutines.*
fun apply(c: suspend () -> Unit) { c.startCoroutine(EmptyContinuation) }
fun box(): String {
    apply { return "early" }
    return "OK"
}
fun main() { println(box()) }`, /return is not supported inside inlined lambda bodies/],
  ['function-typed returns', `fun supplier(): () -> Unit { return supplier() }
fun main() {}`, /Function-typed return values are not supported/],
  ['returns inside template loops', `import kotlin.coroutines.*
fun search(c: suspend () -> Unit): Int {
    while (true) {
        return 1
    }
    return 0
}
fun main() { val x = search {} }`, /Returns inside loops cannot be inlined/],
  ['thrown constructors inside catching trys', `fun box(): String {
    try {
        throw RuntimeException()
    } catch (e: RuntimeException) {
    }
    return "OK"
}
fun main() { println(box()) }`, /Unknown static method 'RuntimeException'/],
];

for (const [description, source, expected] of coroutineRejections) {
  test(`rejects ${description}`, async () => {
    await assert.rejects(run(source), expected);
  });
}
