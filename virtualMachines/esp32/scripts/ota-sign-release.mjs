#!/usr/bin/env node
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const envelope = Object.freeze({
  headerSize: 100,
  signatureSize: 256,
  formatVersion: 1,
  kinds: Object.freeze({ firmware: 1, bootfs: 2 }),
  signatureAlgorithm: 1,
  domain: Buffer.from('PULSE-OTA-ENVELOPE-v1\0', 'ascii'),
});

function fixedIdentity(value, option) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,14}$/.test(value)) {
    throw new Error(`${option} must be a 1..15 byte ASCII identifier`);
  }
  const field = Buffer.alloc(16);
  field.write(value, 'ascii');
  return field;
}

export function createEnvelope(payload, options) {
  const image = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (image.length === 0 || image.length > 0xffffffff) {
    throw new Error('image payload must be between 1 byte and 4 GiB');
  }
  const kind = envelope.kinds[options.kind];
  if (kind === undefined) throw new Error('kind must be firmware or bootfs');
  if (!Number.isInteger(options.version) || options.version <= 0 || options.version > 0xffffffff) {
    throw new Error('version must be a positive uint32');
  }

  const key = options.privateKey?.type === 'private'
    ? options.privateKey
    : createPrivateKey(options.privateKey);
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength !== 2048) {
    throw new Error('release private key must be RSA-2048');
  }

  const header = Buffer.alloc(envelope.headerSize);
  header.write('POTA', 0, 'ascii');
  header[4] = envelope.formatVersion;
  header[5] = kind;
  header[6] = envelope.signatureAlgorithm;
  fixedIdentity(options.board, 'board').copy(header, 8);
  fixedIdentity(options.runtimeAbi, 'runtime ABI').copy(header, 24);
  fixedIdentity(options.pairId, 'pair ID').copy(header, 40);
  header.writeUInt32BE(options.version, 56);
  header.writeUInt32BE(image.length, 60);
  createHash('sha256').update(image).digest().copy(header, 64);
  header.writeUInt16BE(envelope.signatureSize, 96);

  const signedBytes = Buffer.concat([envelope.domain, header.subarray(0, 96)]);
  const signature = sign('RSA-SHA256', signedBytes, key);
  if (signature.length !== envelope.signatureSize) {
    throw new Error(`expected a ${envelope.signatureSize}-byte RSA signature`);
  }
  return Buffer.concat([header, signature, image]);
}

function parseArgs(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    if (!name || !name.startsWith('--') || argv[i + 1] === undefined) {
      throw new Error('options must be supplied as --name value pairs');
    }
    if (values[name]) throw new Error(`duplicate option ${name}`);
    values[name] = argv[i + 1];
  }
  return values;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['--kind', '--board', '--abi', '--pair-id', '--version',
    '--image', '--private-key', '--out'];
  for (const name of required) {
    if (!args[name]) throw new Error(`missing ${name}`);
  }
  const imagePath = path.resolve(args['--image']);
  const keyPath = path.resolve(args['--private-key']);
  const outputPath = path.resolve(args['--out']);
  const result = createEnvelope(readFileSync(imagePath), {
    kind: args['--kind'],
    board: args['--board'],
    runtimeAbi: args['--abi'],
    pairId: args['--pair-id'],
    version: Number(args['--version']),
    privateKey: readFileSync(keyPath),
  });
  writeFileSync(outputPath, result);
  console.log(`Signed ${args['--kind']} OTA envelope: ${outputPath} (${result.length} bytes)`);
}

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`OTA signing failed: ${error.message}`);
    process.exitCode = 1;
  }
}
