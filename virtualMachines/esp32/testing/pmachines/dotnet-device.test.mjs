import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CASES as csharpCases } from '../../../../languages/csharp/validation/cases.mjs';
import { CASES as vbCases } from '../../../../languages/vbish/validation/cases.mjs';
import { compileCsharpToPcode } from '../../../../languages/csharp/src/compile-csharp-to-pcode.mjs';
import { compileVb11ToPcode } from '../../../../languages/vbish/src/compile-vb11.mjs';
import { createScalarLibrary } from '../../../../languages/dotnet/scalar-library.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';
import { requestEsp32 } from './esp32-http.mjs';

const target = process.env.PULSE_DOTNET_TEST_NODE;

test('physical ESP32 executes C#/VB numeric programs and reports runtime failures', {
  skip: !target, timeout: 600000,
}, async () => {
  const origin = new URL(target);
  assert.ok(['http:', 'https:'].includes(origin.protocol));
  const status = await requestEsp32(new URL('/pmachine/status', origin), { timeoutMs: 15000 });
  assert.equal(status.status, 200);
  assert.equal(JSON.parse(await status.text()).running, false, 'Do not interrupt an active p-machine');
  const host = await requestEsp32(new URL('/pmachine/service_host/status', origin), { timeoutMs: 15000 });
  assert.equal(host.status, 200);
  assert.equal(JSON.parse(await host.text()).running, false, 'Do not interrupt an active ServiceHost');
  const execute = async (artifact, stdout, diagnostic, stepLimit = false) => {
    const response = await requestEsp32(new URL('/pmachine/execute_json', origin), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, timeoutMs: 25000,
      body: JSON.stringify({
        pcode: artifact.pcodeText, programMap: attachPcodeSignature(artifact.programMap, artifact.pcodeText),
        inputQueue: '', message: '', stdin: '',
      }),
    });
    const text = await response.text();
    assert.equal(response.status, 200, text);
    const result = JSON.parse(text);
    assert.equal(result.stepLimitHit, stepLimit, text);
    if (diagnostic || stepLimit) {
      assert.equal(result.ok, false, text);
      if (diagnostic) assert.match(result.runtimeError || '', new RegExp(diagnostic));
    } else {
      assert.equal(result.ok, true, text);
      assert.equal(result.runtimeError, undefined, text);
      assert.deepEqual(result.stdout, stdout);
    }
    return result;
  };
  for (const [language, cases, compile] of [
    ['csharp', csharpCases, compileCsharpToPcode], ['vb11', vbCases, compileVb11ToPcode],
  ]) {
    const selected = cases.filter(item => ['positive', 'runtime-error'].includes(item.kind)
      && (['numeric', 'integers'].includes(item.feature) || /^(CS|VB)-GEN-00[1-3]$/.test(item.id)
        || /^(CS|VB)-OVER-00[1-3]$/.test(item.id)));
    assert.ok(selected.length > 20);
    for (const item of selected) {
      await execute(compile(item.source, { fileName: item.id }), item.stdout, item.kind === 'runtime-error' ? item.diagnostic : undefined);
      console.log(`PASS ${language} ${item.id}`);
    }
  }
  const vbProvider = createScalarLibrary(compileVb11ToPcode(`Module Program
Function Text(n As Integer) As String
Return CStr(n + 1)
End Function
Sub Main()
End Sub
End Module`), { id: 'Provider', version: '1.0.0', exports: { Text: 'program.text' } });
  await execute(compileCsharpToPcode(`class Program { static void Main() {
System.Console.WriteLine(Provider.Text(41)); } }`, { libraries: [vbProvider] }), ['42']);
  const csProvider = createScalarLibrary(compileCsharpToPcode(`class Program {
public static int Number(int n) { checked { return n + 1; } }
static void Main() {} }`), { id: 'Provider', version: '1.0.0', exports: { Number: 'Program.Number' } });
  await execute(compileVb11ToPcode(`Module Program
Sub Main()
System.Console.WriteLine(Provider.Number(41))
End Sub
End Module`, { libraries: [csProvider] }), ['42']);
  await execute({ pcodeText: 'CALL_EXT system.unknown 0\nHALT\n', programMap: {} }, undefined, 'Invalid System intrinsic');
  await execute({ pcodeText: 'LOOP:\nJMP LOOP\n', programMap: {} }, undefined, undefined, true);
  const after = await requestEsp32(new URL('/pmachine/status', origin), { timeoutMs: 15000 });
  assert.equal(after.status, 200);
  assert.equal(JSON.parse(await after.text()).running, false);
  console.log('PASS bidirectional C#/VB calls, unknown binding rejection, step-limit failure and idle post-test status');
});
