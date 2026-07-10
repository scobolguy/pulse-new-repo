import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function expectEqual(label, actual, expected) {
  assert.equal(actual, expected, `${label}: expected ${expected}, got ${actual}`);
}

function runNode(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}`.trim() });
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const root = path.resolve(__dirname, '..');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'js-pmachine-spec-'));
  const pcodePath = path.join(tmpDir, 'spec-opcodes.pcode');
  const mapPath = path.join(tmpDir, 'spec-opcodes.program.json');

  const pcodeText = [
    'START:',
    'FORK worker',
    'STORE tid',
    'JOIN tid',
    'STORE joinOne',
    'SYNC tid',
    'STORE syncOne',
    'FORK_SUBFLOW "subflow-a", "arg0"',
    'STORE sfid',
    'JOIN sfid',
    'STORE joinSub',
    'JOIN_ALL',
    'STORE joinAll',
    'BQ_NEW_DYNAMIC q',
    'BQ_ENQ q, 42',
    'BQ_PEEK q, peekQ',
    'BQ_DEQ q, deqQ',
    'STK_NEW_DYNAMIC s',
    'STK_PUSH s, 7',
    'STK_PEEK s, peekS',
    'STK_POP s, popS',
    'PQ_NEW_DYNAMIC p',
    'PQ_ENQ p, 3',
    'PQ_ENQ p, 10',
    'PQ_PEEK p, peekP',
    'PQ_DEQ p, deqP',
    'FILE_OPEN "sample.dat", "write"',
    'STORE fh',
    'FILE_WRITE fh, "row1"',
    'FILE_READ fh, fileVal',
    'FILE_CLOSE fh',
    'DL_LOAD_SCHEMA "SchemaA"',
    'STORE schemaHandle',
    'DL_LOAD_MAP "MapA"',
    'STORE mapHandle',
    'OP_MAP SRC, "map-1", mappedPayload',
    'ROUTE_QUEUE "queue.dest"',
    'ROUTE_FILE "file.dest"',
    'ROUTE_SERVICE "service.dest"',
    'SRV_CALL "svc-a", "mock://echo", SRC',
    'HALT'
  ].join('\n');

  const programMap = {
    runtimeUnit: { kind: 'program', id: 'SpecOpcodes' },
    globals: [
      'tid', 'joinOne', 'syncOne', 'sfid', 'joinSub', 'joinAll',
      'peekQ', 'deqQ', 'peekS', 'popS', 'peekP', 'deqP',
      'fh', 'fileVal', 'schemaHandle', 'mapHandle', 'mappedPayload'
    ],
    entries: [
      {
        kind: 'mapper',
        id: 'map-1',
        items: [
          {
            sourcePath: 'input.value',
            targetPath: 'out.value',
            conversionRule: 'OUTPUT := SRC;'
          }
        ]
      }
    ],
    procedures: {}
  };

  await fs.writeFile(pcodePath, pcodeText, 'utf-8');
  await fs.writeFile(mapPath, JSON.stringify(programMap, null, 2), 'utf-8');

  const run = await runNode(
    [
      'scripts/run-js-pmachine.mjs',
      '--pcode', pcodePath,
      '--program-map', mapPath,
      '--input-queue', 'spec.test',
      '--message', '{"input":{"value":"abc"}}'
    ],
    root
  );

  if (run.code !== 0) {
    throw new Error(`run-js-pmachine failed (${run.code}): ${run.stderr || run.stdout}`);
  }

  let output;
  try {
    output = JSON.parse(run.stdout);
  } catch (error) {
    throw new Error(`Unable to parse JS PMachine output JSON: ${error.message}\n${run.stdout}`);
  }

  expectEqual('runtime', output.runtime, 'js-pmachine');
  expectEqual('joinOne', output.globals.joinOne, 1);
  expectEqual('syncOne', output.globals.syncOne, 1);
  expectEqual('joinSub', output.globals.joinSub, 1);
  expectEqual('joinAll', output.globals.joinAll, 1);

  expectEqual('peekQ', output.globals.peekQ, 42);
  expectEqual('deqQ', output.globals.deqQ, 42);
  expectEqual('peekS', output.globals.peekS, 7);
  expectEqual('popS', output.globals.popS, 7);
  expectEqual('peekP', output.globals.peekP, 10);
  expectEqual('deqP', output.globals.deqP, 10);

  expectEqual('fileVal', output.globals.fileVal, 'row1');
  expectEqual('schemaHandle type', typeof output.globals.schemaHandle, 'number');
  expectEqual('mapHandle type', typeof output.globals.mapHandle, 'number');

  const mapped = JSON.parse(String(output.globals.mappedPayload || '{}'));
  expectEqual('mapped.out.value', mapped.out?.value, 'abc');

  expectEqual('placement.kind', output.state.__placement?.kind, 'service');
  expectEqual('placement.id', output.state.__placement?.id, 'service.dest');

  expectEqual('last_service_call.serviceId', output.state.__last_service_call?.serviceId, 'svc-a');
  expectEqual('last_service_call.endpoint', output.state.__last_service_call?.endpoint, 'mock://echo');
  expectEqual('last_service_call.success', output.state.__last_service_call?.success, true);

  console.log('[js-pmachine-spec] PASS: spec opcode paths executed');
}

main().catch((error) => {
  console.error('[js-pmachine-spec] FAIL:', error.message);
  process.exitCode = 1;
});
