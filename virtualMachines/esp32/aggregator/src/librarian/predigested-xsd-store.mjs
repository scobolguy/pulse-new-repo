import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const FORMAT = 'pulse-predigested-xsd';
const VERSION = 1;

function normalizedSchemaPath(value) {
  if (typeof value !== 'string' || !value || value.length > 4096 ||
    value.includes('\0') || value.includes(':') || value.startsWith('/') || value.startsWith('\\')) {
    throw new Error('Invalid schema path for predigested XSD');
  }
  const parts = value.replace(/\\/g, '/').split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid schema path for predigested XSD');
  }
  return parts.join('/');
}

export function createPredigestedXsdStore(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    throw new Error('Predigested XSD store root must be absolute');
  }
  const resolvedRoot = path.resolve(root);

  function artifactPath(schemaPath) {
    const normalized = normalizedSchemaPath(schemaPath);
    const key = createHash('sha256').update(normalized, 'utf16le').digest('hex');
    return path.join(resolvedRoot, `${key}.json`);
  }

  async function read(schemaPath) {
    const filePath = artifactPath(schemaPath);
    let content;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    let artifact;
    try {
      artifact = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid predigested XSD artifact for ${schemaPath}`, { cause: error });
    }
    if (!artifact || artifact.format !== FORMAT || artifact.version !== VERSION ||
      artifact.schemaPath !== normalizedSchemaPath(schemaPath) ||
      !Array.isArray(artifact.dependencies) ||
      artifact.dependencies.some(item => !item || typeof item.path !== 'string' ||
        !/^[a-f0-9]{64}$/.test(item.hash)) ||
      !(artifact.tree === null || (artifact.tree && artifact.tree.name === 'root' &&
        Array.isArray(artifact.tree.children)))) {
      throw new Error(`Invalid predigested XSD artifact for ${schemaPath}`);
    }
    return artifact;
  }

  async function write(schemaPath, { tree, dependencies }) {
    const normalized = normalizedSchemaPath(schemaPath);
    if (!Array.isArray(dependencies) || dependencies.some(item => !item ||
      typeof item.path !== 'string' || !/^[a-f0-9]{64}$/.test(item.hash))) {
      throw new Error(`Invalid XSD dependency manifest for ${schemaPath}`);
    }
    const artifact = {
      format: FORMAT,
      version: VERSION,
      schemaPath: normalized,
      tree: tree ?? null,
      dependencies
    };
    const contents = `${JSON.stringify(artifact)}\n`;
    if (Buffer.byteLength(contents) > 32000000) {
      throw Object.assign(new Error('Predigested XSD artifact capacity exceeded'), { status: 413 });
    }
    await fs.mkdir(resolvedRoot, { recursive: true });
    const destination = artifactPath(normalized);
    const temporary = path.join(resolvedRoot, `.pulse-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, contents, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }

  async function remove(schemaPath) {
    try {
      await fs.unlink(artifactPath(schemaPath));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  return { read, write, remove };
}
