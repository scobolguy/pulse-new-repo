import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../../pmachines/javascript/src/service-host.mjs';

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const nativeRoot = path.join(workspaceRoot, 'pmachines', 'native');
const logger = { log() {}, warn() {}, error() {} };

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: workspaceRoot, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function writeArtifact(directory, compiled, name = 'service') {
  const pcodePath = path.join(directory, `${name}.pcode`);
  const mapPath = path.join(directory, `${name}.program.json`);
  await writeFile(pcodePath, compiled.pcodeText, 'utf8');
  await writeFile(mapPath, `${JSON.stringify(compiled.programMap, null, 2)}\n`, 'utf8');
  return { pcodePath, mapPath };
}

async function launchNative(executable, pcodePath, mapPath, extraArgs = []) {
  const child = spawn(executable, ['--pcode', pcodePath, '--program-map', mapPath, '--port', '0', ...extraArgs], {
    cwd: workspaceRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });

  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const match = stdout.match(/LISTENING service=[^\r\n]* port=(\d+)/);
    if (match) return { origin: `http://127.0.0.1:${match[1]}`, child, exited };
    if (child.exitCode !== null) throw new Error(`Native host exited (${child.exitCode}): ${stderr}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  child.kill();
  throw new Error(`Native host startup timed out: ${stdout}\n${stderr}`);
}

function launchNativeDebugger(executable, pcodePath, mapPath) {
  const child = spawn(executable, ['--debug', '--pcode', pcodePath, '--program-map', mapPath, '--max-steps', '100000'], {
    cwd: workspaceRoot,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const events = [];
  const waiters = [];
  let stdoutBuffer = '';
  let stderr = '';
  const publish = event => {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(event);
    else events.push(event);
  };
  child.stdout.setEncoding('utf8').on('data', chunk => {
    stdoutBuffer += chunk;
    for (;;) {
      const newline = stdoutBuffer.indexOf('\n');
      if (newline < 0) break;
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (line) publish(JSON.parse(line));
    }
  });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.once('close', code => {
    if (code !== 0) publish({ event: 'error', message: `Native debugger exited (${code}): ${stderr}` });
  });
  return {
    child,
    send(command) {
      child.stdin.write(`${JSON.stringify(command)}\n`);
    },
    nextEvent(timeoutMs = 5000) {
      if (events.length) return Promise.resolve(events.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Native debugger event timed out: ${stderr}`)), timeoutMs);
        waiters.push({
          resolve(event) {
            clearTimeout(timer);
            resolve(event);
          },
          reject
        });
      });
    }
  };
}

async function jsonRequest(origin, route, method = 'GET', body) {
  const response = await fetch(`${origin}${route}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }),
    signal: AbortSignal.timeout(5000)
  });
  return { status: response.status, body: await response.json() };
}

test('one native-target service artifact has matching Node and native HTTP behavior', async t => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pulse-native-service-'));
  let jsHost;
  let native;
  let jsFilesystemHost;
  let nativeFilesystem;
  let nativeLimited;
  let nativeDebugger;
  try {
    const buildRoot = path.join(tempRoot, 'build');
    run('cmake', ['-S', nativeRoot, '-B', buildRoot, '-G', 'Ninja']);
    run('cmake', ['--build', buildRoot]);

    const executable = path.join(buildRoot, process.platform === 'win32'
      ? 'pulse_native_service_host.exe' : 'pulse_native_service_host');
    const source = `service 'native-parity';
      var total: integer;
      get '/health'; begin return '{"status":"ok","runtime":"shared"}' end
      post '/echo'; begin return host.event_body() end
      get '/sum'; begin total := 2 + 3; return total end
      get '/multiply'; begin total := 50000 * 50000; return total end
      get '/compare'; begin return (3 > 2) and (4 <> 5) end
      get '/hash'; begin return host.text_hash('abc') end
      post '/concat'; begin return 'native:' + host.event_body() end
      post '/count'; begin return host.json_array_count(host.json_value(host.event_body(), 'items')) end
      post '/merge'; begin return host.json_merge('{"base":1}', host.event_body()) end
      end.`;
    const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true, nativeTarget: true });
    assert.deepEqual(compiled.programMap.targets, ['js', 'native']);

    const { pcodePath, mapPath } = await writeArtifact(tempRoot, compiled);
    jsHost = await createPascalishServiceHost({
      compiled,
      collectorId: 'native-parity',
      httpPort: 0,
      udpPort: null,
      logger
    });
    await jsHost.start();
    native = await launchNative(executable, pcodePath, mapPath);
    const jsOrigin = `http://127.0.0.1:${jsHost.getStatus().httpPort}`;

    for (const [route, method, body] of [
      ['/health', 'GET', undefined],
      ['/echo', 'POST', '{"value":"shared"}'],
      ['/sum', 'GET', undefined],
      ['/multiply', 'GET', undefined],
      ['/compare', 'GET', undefined],
      ['/hash', 'GET', undefined],
      ['/concat', 'POST', 'parity'],
      ['/count', 'POST', '{"items":[1,2,3]}'],
      ['/merge', 'POST', '{"value":"merged"}'],
      ['/missing', 'GET', undefined]
    ]) {
      assert.deepEqual(
        await jsonRequest(native.origin, route, method, body),
        await jsonRequest(jsOrigin, route, method, body),
        `HTTP parity failed for ${method} ${route}`
      );
    }

    const status = await jsonRequest(native.origin, '/pmachine/service_host/status');
    assert.equal(status.body.serviceId, 'native-parity');
    assert.equal(status.body.capabilities.runtime, 'native');
    assert.deepEqual(status.body.capabilities.supported, []);

    const unsupportedSource = `service 'native-parity';
      get '/run'; begin return host.xml_parse(host.event_body()) end
      end.`;
    assert.throws(
      () => compilePascalishProgramWithAntlr(unsupportedSource, { hostServices: true, nativeTarget: true }),
      /Native host does not support binding host\.xml_parse/
    );

    const rejectsMap = async (map, expectedError) => {
      const rejectedMapPath = path.join(tempRoot, `rejected-${Math.random()}.program.json`);
      await writeFile(rejectedMapPath, JSON.stringify(map), 'utf8');
      const result = spawnSync(executable, ['--pcode', pcodePath, '--program-map', rejectedMapPath, '--port', '0'], {
        cwd: workspaceRoot,
        encoding: 'utf8'
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, expectedError);
    };

    await rejectsMap({ ...compiled.programMap, targets: ['js', 'esp32'] }, /does not advertise the native target/);
    await rejectsMap({
      ...compiled.programMap,
      requiredHostCapabilities: ['filesystem.read']
    }, /does not provide requested host capability filesystem\.read/);

    const debuggerCompiled = compilePascalishProgramWithAntlr(`service 'native-debugger';
      var total: integer;
      get '/sum'; begin total := 2 + 3; return total end
      end.`, { hostServices: true, nativeTarget: true });
    const debugArtifact = await writeArtifact(tempRoot, debuggerCompiled, 'native-debugger');
    nativeDebugger = launchNativeDebugger(executable, debugArtifact.pcodePath, debugArtifact.mapPath);
    const storeLines = debuggerCompiled.pcodeText.split(/\r?\n/)
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(item => /^STORE total$/.test(item.line));
    assert.ok(storeLines.length >= 2, 'expected global initialization and route assignment');
    const assignmentLine = storeLines.at(-1).number;
    nativeDebugger.send({
      command: 'start',
      method: 'GET',
      path: '/sum',
      body: '',
      breakpoints: [assignmentLine]
    });
    const entry = await nativeDebugger.nextEvent();
    assert.equal(entry.event, 'stopped');
    assert.equal(entry.reason, 'entry');
    nativeDebugger.send({ command: 'continue' });
    const breakpoint = await nativeDebugger.nextEvent();
    assert.equal(breakpoint.event, 'stopped');
    assert.equal(breakpoint.reason, 'breakpoint');
    assert.equal(breakpoint.line, assignmentLine);
    nativeDebugger.send({ command: 'step' });
    const stepped = await nativeDebugger.nextEvent();
    assert.equal(stepped.event, 'stopped');
    assert.equal(stepped.locals.total, 5);
    nativeDebugger.send({ command: 'continue' });
    const completed = await nativeDebugger.nextEvent();
    assert.deepEqual(
      { event: completed.event, status: completed.status, body: completed.body },
      { event: 'terminated', status: 200, body: '5' }
    );

    const storageRoot = path.join(tempRoot, 'schemas');
    await mkdir(path.join(storageRoot, 'nested'), { recursive: true });
    await writeFile(path.join(storageRoot, 'nested', 'utf8.txt'), '\ufeffUnicode 名 😀\n', 'utf8');
    await writeFile(path.join(storageRoot, 'nested', 'utf16le.txt'), Buffer.from([
      0xff, 0xfe, 0x55, 0x00, 0x6e, 0x00, 0x69, 0x00, 0x63, 0x00, 0x6f, 0x00, 0x64, 0x00, 0x65, 0x00
    ]));
    await writeFile(path.join(storageRoot, 'nested', 'utf16be.txt'), Buffer.from([
      0xfe, 0xff, 0x00, 0x48, 0x00, 0x69
    ]));
    const filesystemCompiled = compilePascalishProgramWithAntlr(`service 'native-filesystem';
      get '/read'; begin return host.fs_read_text('schemas', 'nested/utf8.txt') end
      get '/read-auto'; begin return host.fs_read_text_auto('schemas', 'nested/utf16le.txt') end
      get '/read-auto-be'; begin return host.fs_read_text_auto('schemas', 'nested/utf16be.txt') end
      get '/exists'; begin return host.fs_exists('schemas', 'nested/utf8.txt') end
      get '/missing'; begin return host.fs_exists('schemas', 'missing.txt') end
      get '/resolve'; begin return host.fs_resolve_relative('schemas', 'nested/base.xsd', '../nested/utf8.txt') end
      post '/read-input'; begin return host.fs_read_text('schemas', host.event_body()) end
      post '/write'; begin
        host.fs_write_text('catalog', 'saved/data.json', host.event_body());
        return host.fs_read_text('catalog', 'saved/data.json')
      end
      end.`, { hostServices: true, nativeTarget: true });
    assert.deepEqual(filesystemCompiled.programMap.targets, ['js', 'native']);
    assert.deepEqual(filesystemCompiled.programMap.requiredHostCapabilities, ['filesystem.read', 'filesystem.write']);
    const fsArtifact = await writeArtifact(tempRoot, filesystemCompiled, 'filesystem');
    const noFilesystemGrants = spawnSync(executable, [
      '--pcode', fsArtifact.pcodePath, '--program-map', fsArtifact.mapPath, '--port', '0'
    ], { cwd: workspaceRoot, encoding: 'utf8' });
    assert.notEqual(noFilesystemGrants.status, 0);
    assert.match(noFilesystemGrants.stderr, /does not provide requested host capability filesystem\.read/);
    const undeclaredCapabilitiesMap = path.join(tempRoot, 'filesystem-undeclared.program.json');
    await writeFile(undeclaredCapabilitiesMap, JSON.stringify({
      ...filesystemCompiled.programMap,
      requiredHostCapabilities: []
    }), 'utf8');
    const undeclaredCapabilities = spawnSync(executable, [
      '--pcode', fsArtifact.pcodePath, '--program-map', undeclaredCapabilitiesMap, '--port', '0'
    ], { cwd: workspaceRoot, encoding: 'utf8' });
    assert.notEqual(undeclaredCapabilities.status, 0);
    assert.match(undeclaredCapabilities.stderr, /does not provide requested host capability filesystem\.read/);
    const catalogRoot = path.join(tempRoot, 'catalog');
    await mkdir(path.join(catalogRoot, 'saved'), { recursive: true });
    const fsArgs = [
      '--storage-root', `schemas=${storageRoot}`,
      '--writable-storage-root', `catalog=${catalogRoot}`
    ];
    nativeFilesystem = await launchNative(executable, fsArtifact.pcodePath, fsArtifact.mapPath, fsArgs);
    jsFilesystemHost = await createPascalishServiceHost({
      compiled: filesystemCompiled,
      collectorId: 'native-filesystem',
      httpPort: 0,
      udpPort: null,
      storageRoots: {
        schemas: { path: storageRoot },
        catalog: { path: catalogRoot, readOnly: false }
      },
      logger
    });
    await jsFilesystemHost.start();
    const jsFilesystemOrigin = `http://127.0.0.1:${jsFilesystemHost.getStatus().httpPort}`;
    for (const [route, method, body] of [
      ['/read', 'GET', undefined],
      ['/read-auto', 'GET', undefined],
      ['/read-auto-be', 'GET', undefined],
      ['/exists', 'GET', undefined],
      ['/missing', 'GET', undefined],
      ['/resolve', 'GET', undefined],
      ['/write', 'POST', '{"stored":true}']
    ]) {
      assert.deepEqual(
        await jsonRequest(nativeFilesystem.origin, route, method, body),
        await jsonRequest(jsFilesystemOrigin, route, method, body),
        `Filesystem parity failed for ${method} ${route}`
      );
    }
    const fsStatus = await jsonRequest(nativeFilesystem.origin, '/pmachine/service_host/status');
    assert.equal(fsStatus.body.capabilities.filesystem, true);
    assert.deepEqual(fsStatus.body.capabilities.supported, ['filesystem.read', 'filesystem.write']);
    const blockedPath = await fetch(`${nativeFilesystem.origin}/read-input`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '../outside.txt'
    });
    assert.equal(blockedPath.status, 400);
    nativeLimited = await launchNative(executable, fsArtifact.pcodePath, fsArtifact.mapPath, [
      ...fsArgs, '--max-file-bytes', '8'
    ]);
    const oversizedRead = await fetch(`${nativeLimited.origin}/read`);
    assert.equal(oversizedRead.status, 413);
    const oversizedWrite = await fetch(`${nativeLimited.origin}/write`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'this is over eight bytes'
    });
    assert.equal(oversizedWrite.status, 413);
    const readonlyNative = spawnSync(executable, [
      '--pcode', fsArtifact.pcodePath, '--program-map', fsArtifact.mapPath, '--port', '0',
      '--storage-root', `schemas=${storageRoot}`, '--storage-root', `catalog=${catalogRoot}`
    ], { cwd: workspaceRoot, encoding: 'utf8' });
    assert.notEqual(readonlyNative.status, 0);
    assert.match(readonlyNative.stderr, /does not provide requested host capability filesystem\.write/);

    const catalogSource = await readFile(new URL('../../src/librarian/catalog-store.pas', import.meta.url), 'utf8');
    const catalogCompiled = compilePascalishProgramWithAntlr(catalogSource, {
      hostServices: true,
      nativeTarget: true
    });
    assert.deepEqual(catalogCompiled.programMap.targets, ['js', 'native']);
  } finally {
    if (nativeDebugger && nativeDebugger.child.exitCode === null && nativeDebugger.child.signalCode === null) {
      nativeDebugger.child.kill();
    }
    for (const instance of [native, nativeFilesystem, nativeLimited]) {
      if (instance && instance.child.exitCode === null && instance.child.signalCode === null) {
        instance.child.kill();
        await Promise.race([instance.exited, new Promise(resolve => setTimeout(resolve, 2000))]);
      }
    }
    if (jsHost) await jsHost.stop();
    if (jsFilesystemHost) await jsFilesystemHost.stop();
    await rm(tempRoot, { recursive: true, force: true });
  }
});
