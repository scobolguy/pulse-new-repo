import assert from 'node:assert/strict';
import test from 'node:test';
import { executeSystemIntrinsic } from '../../dotnet/system-library.mjs';
import { createExecutionTarget, assertExecution } from './execution-targets.mjs';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';

test('System string length counts UTF-16 and rejects invalid arguments', () => {
  for (const [text, length] of [['', 0], ['ascii', 5], ['\u00e9', 1], ['e\u0301', 2], ['\u6f22', 1], ['\ud83d\ude00', 2]])
    assert.equal(executeSystemIntrinsic('system.string.length', [text]), length);
  assert.throws(() => executeSystemIntrinsic('system.string.length', [42]), /requires a string/);
  assert.throws(() => executeSystemIntrinsic('system.string.length', ['\ud800']), /valid Unicode/);
  assert.throws(() => executeSystemIntrinsic('system.string.length', []), /Invalid System intrinsic/);
});

test('wrapping division retains checked arithmetic and explicit zero errors', () => {
  assert.equal(executeSystemIntrinsic('system.int32.divide.unchecked', [-2147483648, -1]), -2147483648);
  assert.equal(executeSystemIntrinsic('system.int32.remainder.unchecked', [-2147483648, -1]), 0);
  for (const name of ['divide', 'remainder']) {
    assert.throws(() => executeSystemIntrinsic(`system.int32.${name}`, [-2147483648, -1]), /OverflowException/);
    assert.throws(() => executeSystemIntrinsic(`system.int32.${name}.unchecked`, [1, 0]), /DivideByZeroException/);
    assert.throws(() => executeSystemIntrinsic(`system.int32.${name}.unchecked`, ['1', 1]), /Int32 arguments/);
  }
});

test('assertEquals is a void intrinsic with observable failure', () => {
  assert.equal(executeSystemIntrinsic('system.assert.equals', [7, 7]), undefined);
  assert.throws(() => executeSystemIntrinsic('system.assert.equals', [7, 8]),
    /AssertionError: expected 7, actual 8/);
  assert.throws(() => executeSystemIntrinsic('system.assert.equals', ['7', 7]),
    /requires Int32 arguments/);
});

test('the shared target preserves runtime failures and bounded execution', async () => {
  const executor = await createExecutionTarget('js');
  try {
    const artifact = compileKotlinToPcode('fun main() { var zero = 0; println(1 / zero) }');
    await assert.rejects(executor.execute(artifact), /DivideByZeroException/);
    assert.throws(() => assertExecution({ error: 'fault', stepLimitHit: false, stdout: [] }, [], 'negative case'), /negative case/);
    const bounded = await executor.execute(compileKotlinToPcode('fun main() { while (true) {} }'));
    assert.equal(bounded.stepLimitHit, true);
    assert.throws(() => assertExecution(bounded, [], 'bounded case'), /instruction limit/);
  } finally { await executor.stop(); }
});

test('independent Kotlin invocations do not share default or range temporaries', async () => {
  const executor = await createExecutionTarget('js');
  const artifact = compileKotlinToPcode(`fun total(first: Int, second: Int = first + 1): Int = first + second
fun main() {
  var answer = 0
  for (value in 1..3) { answer += total(value) }
  println(answer)
}`);
  try {
    for (const result of await Promise.all(Array.from({ length: 4 }, () => executor.execute(artifact))))
      assertExecution(result, ['15'], 'isolated invocation');
  } finally { await executor.stop(); }
});
