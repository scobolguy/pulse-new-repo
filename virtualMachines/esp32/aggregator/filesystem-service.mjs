import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { readEnvNumber, readEnvString } from './src/env-config.mjs';
import { compilePascalishProgramWithAntlr } from './scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { createPascalishServiceHost } from '../pmachines/javascript/src/service-host.mjs';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultDataRoot = process.platform === 'win32'
  ? 'c:/dev/pulse-operational-data'
  : '/opt/pulse/operational-data';

export async function createFilesystemService({
  dataRoot = readEnvString('LIBRARIAN_DATA_ROOT')
    || readEnvString('PULSE_LIBRARIAN_DATA_ROOT')
    || readEnvString('PULSE_RUNTIME_DATA_ROOT')
    || readEnvString('PULSE_QUEUE_DATA_ROOT')
    || readEnvString('PULSE_OPERATIONAL_DATA_ROOT')
    || defaultDataRoot,
  host = readEnvString('FILESYSTEM_HOST', '0.0.0.0'),
  httpAllowedPeers = (readEnvString('FILESYSTEM_ALLOWED_CLIENTS', '127.0.0.1,192.168.2.90'))
    .split(',').map(value => value.trim()).filter(Boolean),
  httpPort = readEnvNumber('FILESYSTEM_PORT', 4302),
  maxFileBytes = readEnvNumber('FILESYSTEM_MAX_FILE_BYTES', 262144),
  logger = console,
  lifecycleEnv = process.env
} = {}) {
  if (!Array.isArray(httpAllowedPeers) || httpAllowedPeers.some(peer => net.isIP(peer) !== 4)) {
    throw new Error('FILESYSTEM_ALLOWED_CLIENTS must contain literal IPv4 addresses');
  }
  if (host !== '127.0.0.1' && httpAllowedPeers.length === 0) {
    throw new Error('A non-loopback Filesystem Service bind requires an HTTP client allowlist');
  }
  const resolvedDataRoot = path.resolve(dataRoot);
  const librarianRoot = path.join(resolvedDataRoot, 'services', 'librarian');
  const schemaRoot = path.join(librarianRoot, 'schemas');
  const isamRoot = path.join(resolvedDataRoot, 'services', 'isam');
  await fs.mkdir(schemaRoot, { recursive: true });
  await fs.mkdir(isamRoot, { recursive: true });
  await fs.mkdir(path.join(librarianRoot, 'schema-pages'), { recursive: true });

  const sourcePath = path.join(repoRoot, '..', 'src', 'filesystem-service.pas');
  const source = await fs.readFile(sourcePath, 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, {
    fileName: sourcePath,
    hostServices: true
  });
  const service = await createPascalishServiceHost({
    compiled,
    collectorId: 'pulse-filesystem',
    host,
    httpAllowedPeers,
    httpPort,
    udpPort: null,
    maxFileBytes,
    maxBodyBytes: 1000000,
    maxResponseBytes: 1000000,
    maxEvents: 64,
    desktopBudget: true,
    maxSteps: null,
    maxExecutionMs: null,
    storageRoots: {
      catalog: { path: librarianRoot, readOnly: false },
      schemas: { path: schemaRoot },
      'schema-pages': { path: path.join(librarianRoot, 'schema-pages'), readOnly: true },
      legacy: { path: resolvedDataRoot },
      isam: { path: isamRoot, readOnly: false }
    },
    lifecycle: {
      serviceId: 'pulse-filesystem',
      metadata: { version: 1, requires: [] },
      env: lifecycleEnv,
      intrinsicProbe: () => service.dispatch({
        transport: 'internal', method: 'POST', path: '/schemas/page',
        body: JSON.stringify({ path: '', cursor: '', limit: 1 }),
      }),
    },
    logger
  });
  await service.start();
  return service;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createFilesystemService()
    .then(service => {
      console.log(`[Filesystem] Service running on port ${service.getStatus().httpPort}`);
      const stop = () => service.stop().catch(error => {
        console.error('[Filesystem] Failed to stop cleanly', error);
        process.exitCode = 1;
      });
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    })
    .catch(error => {
      console.error('[Filesystem] Failed to start', error);
      process.exitCode = 1;
    });
}
