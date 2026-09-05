import { compileVbishToPmachine } from './compile-interoperable-language.mjs';
import { attachPcodeSignature } from './pcode-signing.mjs';

const ESP32_HOST = process.env.ESP32_HOST || '192.168.2.155';
const BASE_URL = `http://${ESP32_HOST}`;

const vbishProgram = `
Program "fibonacci-series"

Sub Main()
  Dim i As Integer
  Dim a As Integer
  Dim b As Integer
  Dim temp As Integer
  
  a = 0
  b = 1
  Print "Fib(1) = 1"
  
  For i = 2 To 10
    temp = a + b
    a = b
    b = temp
    Print "Fib(", i, ") = ", b
  Next i
End Sub
`;

console.log('='.repeat(60));
console.log(`Running VBish Fibonacci on ESP32 Node: ${ESP32_HOST}`);
console.log('='.repeat(60));

async function postForm(url, params, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(15000)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return text;
}

try {
  console.log('\n1. Compiling VBish program...');
  const artifact = compileVbishToPmachine(vbishProgram, { fileName: 'fibonacci.vbs' });
  console.log('   ✓ Compilation successful');
  console.log('   Program ID:', artifact.runtimeUnit?.id);
  
  const pcodeText = artifact.pcodeText.endsWith('\n') ? artifact.pcodeText : `${artifact.pcodeText}\n`;
  const signedMap = attachPcodeSignature(structuredClone(artifact.programMap), pcodeText);
  const signedMapText = `${JSON.stringify(signedMap, null, 2)}\n`;

  const REMOTE_PCODE = '/fib.pcode';
  const REMOTE_MAP = '/fib.map.json';

  console.log('\n2. Uploading pcode and signed program map to ESP32 LittleFS...');
  await postForm(`${BASE_URL}/ffs/upload`, { file: REMOTE_PCODE, body: pcodeText }, 'upload pcode');
  await postForm(`${BASE_URL}/ffs/upload`, { file: REMOTE_MAP, body: signedMapText }, 'upload program map');
  console.log('   ✓ Files uploaded successfully');

  console.log('\n3. Executing on ESP32 PMachine runtime (/pmachine/execute_file)...');
  const rawResult = await postForm(`${BASE_URL}/pmachine/execute_file`, {
    file: REMOTE_PCODE,
    programMap: REMOTE_MAP,
    runRouter: '0',
    inputQueue: 'fibonacci-series.run',
    message: '',
    max: '65536'
  }, 'execute_file');

  console.log('\n4. ESP32 Execution Result:');
  let result;
  try {
    result = JSON.parse(rawResult);
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.log(rawResult);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✓ Successfully ran VBish Fibonacci on ESP32 Node!');
  console.log('='.repeat(60) + '\n');
} catch (err) {
  console.error('\n✗ Error executing on ESP32:');
  console.error(err.message);
  console.error('\n' + '='.repeat(60) + '\n');
  process.exitCode = 1;
}
