import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const SCHEMA_PAGE_BYTES = 1500;

export function schemaPageKey(schemaPath) {
  if (typeof schemaPath !== 'string' || !schemaPath || schemaPath.length > 4096) {
    throw Object.assign(new Error('Invalid schema page identity'), { status: 400 });
  }
  return createHash('sha256').update(schemaPath, 'utf16le').digest('hex');
}

function descriptor(node, nodeId) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('Invalid schema tree node');
  const { children = [], ...metadata } = node;
  if (!Array.isArray(children)) throw new Error('Invalid schema tree children');
  return { ...metadata, nodeId, childCount: children.length };
}

export function createSchemaPageStore(root) {
  if (!path.isAbsolute(root)) throw new Error('Schema page store root must be absolute');
  const pending = new Map();

  async function manifest(schemaPath) {
    let text;
    try { text = await fs.readFile(path.join(root, schemaPageKey(schemaPath), 'current.json'), 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    const value = JSON.parse(text);
    if (value.schemaKey !== schemaPageKey(schemaPath) || !/^[a-f0-9]{64}$/.test(value.revision)
      || !Array.isArray(value.files)) throw new Error('Invalid schema page manifest');
    return value;
  }

  async function publish(schemaPath, tree, files) {
    const schemaKey = schemaPageKey(schemaPath);
    const revision = createHash('sha256').update(JSON.stringify({ tree, files }), 'utf8').digest('hex');
    const directory = path.join(root, schemaKey);
    await fs.mkdir(directory, { recursive: true });
    const staging = path.join(directory, `.stage-${randomUUID()}`);
    await fs.mkdir(staging);
    let nodeCount = 0;
    let pageCount = 0;
    try {
      const stack = [{ node: tree || { name: 'root', children: [] }, nodeId: 'n0' }];
      while (stack.length) {
        const { node, nodeId } = stack.pop();
        if (nodeId.length > 512) throw Object.assign(new Error('Schema node identity capacity exceeded'), { status: 413 });
        const summary = descriptor(node, nodeId);
        const children = node.children || [];
        let cursor = 0;
        let items = [];
        function page(nextCursor) {
          return { schemaKey, revision, nodeId, node: summary, items, nextCursor };
        }
        async function writePage(nextCursor) {
          const text = JSON.stringify(page(nextCursor));
          if (Buffer.byteLength(text) > SCHEMA_PAGE_BYTES) {
            throw Object.assign(new Error(`Schema node metadata exceeds page capacity: ${node.name}`), { status: 413 });
          }
          await fs.writeFile(path.join(staging, `${nodeId}-${cursor}.json`), text, { flag: 'wx' });
          pageCount++;
        }
        for (let index = 0; index < children.length; index++) {
          const childId = `${nodeId}.${index.toString(36)}`;
          const child = descriptor(children[index], childId);
          items.push(child);
          if (Buffer.byteLength(JSON.stringify(page(String(cursor + 1)))) > SCHEMA_PAGE_BYTES) {
            items.pop();
            if (!items.length) throw Object.assign(new Error(`Schema node metadata exceeds page capacity: ${children[index].name}`), { status: 413 });
            await writePage(String(cursor + 1));
            cursor++;
            items = [child];
          }
          stack.push({ node: children[index], nodeId: childId });
        }
        await writePage(null);
        nodeCount++;
      }
      const destination = path.join(directory, revision);
      try { await fs.rename(staging, destination); }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error;
        // A content-addressed revision is reusable only if it was already fully published.
        const existing = await fs.stat(destination);
        if (!existing.isDirectory()) throw error;
      }
      const value = { format: 'pulse-schema-pages', version: 1, schemaKey, revision, files, nodeCount, pageCount };
      const temporary = path.join(directory, `.current-${randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporary, JSON.stringify(value), { flag: 'wx' });
        await fs.rename(temporary, path.join(directory, 'current.json'));
      } finally { await fs.rm(temporary, { force: true }); }
      return value;
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }

  function ensure(schemaPath, isCurrent, build) {
    if (!pending.has(schemaPath)) {
      const work = (async () => {
        const current = await manifest(schemaPath);
        if (current && await isCurrent(current.files)) return current;
        const { tree, files } = await build();
        return publish(schemaPath, tree, files);
      })().finally(() => pending.delete(schemaPath));
      pending.set(schemaPath, work);
    }
    return pending.get(schemaPath);
  }

  return { manifest, publish, ensure };
}
