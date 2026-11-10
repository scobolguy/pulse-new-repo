import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function sequence(value, label) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid ${label}`);
  return value;
}

export async function withNextSwarmResourceSequence({ filePath, initialSequence }, report) {
  if (typeof filePath !== 'string' || filePath.length === 0)
    throw new Error('A resource report sequence file is required');
  if (initialSequence !== undefined)
    sequence(initialSequence, 'initial resource report sequence');
  if (typeof report !== 'function') throw new Error('A resource report operation is required');

  const sequencePath = path.resolve(filePath);
  const lockPath = `${sequencePath}.lock`;
  let lock;
  try {
    lock = await fs.open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(`Resource report sequence is locked: ${lockPath}`);
    throw error;
  }

  let temporaryPath;
  try {
    let previous;
    try {
      const contents = await fs.readFile(sequencePath, 'utf8');
      if (!/^(0|[1-9][0-9]*)\r?\n?$/.test(contents))
        throw new Error('Resource report sequence file is malformed');
      previous = sequence(Number(contents.trim()), 'stored resource report sequence');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    const next = previous === undefined
      ? sequence(initialSequence, 'initial resource report sequence')
      : sequence(previous + 1, 'next resource report sequence');
    temporaryPath = `${sequencePath}.${process.pid}.${randomUUID()}.tmp`;
    const temporary = await fs.open(temporaryPath, 'wx', 0o600);
    try {
      await temporary.writeFile(`${next}\n`, 'utf8');
      await temporary.sync();
    } finally {
      await temporary.close();
    }
    await fs.rename(temporaryPath, sequencePath);
    temporaryPath = undefined;

    return await report(next);
  } finally {
    if (temporaryPath) await fs.unlink(temporaryPath);
    await lock.close();
    await fs.unlink(lockPath);
  }
}
