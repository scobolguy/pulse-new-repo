import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_BUNDLE_BYTES = 64 * 1024 * 1024;
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

function safeName(value, label) {
  const name = String(value || '').trim();
  if (!NAME_PATTERN.test(name)) throw new Error(`Invalid ${label}`);
  return name;
}

function safeRelativePath(value) {
  const relative = String(value || '').trim();
  const resolved = path.resolve('/', relative);
  if (!relative || path.isAbsolute(relative) || resolved !== path.resolve('/', relative.replaceAll('\\', '/'))
      || relative.split(/[\\/]/).includes('..')) {
    throw new Error(`Invalid bundle path: ${relative}`);
  }
  return relative.replaceAll('\\', '/');
}

function manifestFor(input, name) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Bundle manifest is required');
  const manifest = {
    name: safeName(input.name, 'manifest name'),
    version: safeName(input.version, 'manifest version'),
    entry: safeRelativePath(input.entry),
    programMap: input.programMap ? safeRelativePath(input.programMap) : 'program.map.json',
    type: String(input.type || '').trim().toLowerCase(),
    serviceIndex: input.serviceIndex ?? null,
    sha256: String(input.sha256 || '').trim().toLowerCase()
  };
  if (manifest.type === 'daemon') {
    manifest.serviceEntry = safeRelativePath(input.serviceEntry);
    manifest.serviceProgramMap = safeRelativePath(input.serviceProgramMap || 'service.program.map.json');
    manifest.udpPort = input.udpPort ?? 0;
  }
  if (manifest.name !== name) throw new Error('Bundle name does not match manifest name');
  if (!['resident', 'transient', 'service', 'daemon', 'program'].includes(manifest.type)) {
    throw new Error('Manifest type is invalid');
  }
  if (manifest.type === 'service' || manifest.type === 'daemon') {
    if (!Number.isInteger(manifest.serviceIndex) || manifest.serviceIndex < 1 || manifest.serviceIndex > 15) {
      throw new Error('Service manifest requires serviceIndex 1..15');
    }
    if (manifest.type === 'daemon'
        && (!Number.isInteger(manifest.udpPort) || manifest.udpPort < 0 || manifest.udpPort > 65535)) {
      throw new Error('Daemon manifest udpPort must be an integer from 0 through 65535');
    }
  }
  return manifest;
}

export function createPmachineBundleStore(root, {
  maxFileBytes = MAX_FILE_BYTES,
  maxBundleBytes = MAX_BUNDLE_BYTES
} = {}) {
  const programs = path.resolve(root, 'programs');
  const staging = path.resolve(root, 'staging');

  async function install({ name, manifest: inputManifest, files }) {
    const safeProgramName = safeName(name, 'program name');
    if (!Array.isArray(files) || files.length === 0) throw new Error('Bundle files are required');
    const manifest = manifestFor(inputManifest, safeProgramName);
    const seen = new Set();
    let total = 0;
    for (const file of files) {
      const relative = safeRelativePath(file?.path);
      if (seen.has(relative)) throw new Error(`Duplicate bundle path: ${relative}`);
      seen.add(relative);
      if (typeof file?.base64 !== 'string' || !file.base64) throw new Error(`Missing bundle data: ${relative}`);
      const bytes = Buffer.from(file.base64, 'base64');
      if (bytes.length > maxFileBytes) throw new Error(`Bundle file exceeds limit: ${relative}`);
      total += bytes.length;
      if (total > maxBundleBytes) throw new Error('Bundle exceeds size limit');
    }
    if (!seen.has(manifest.entry)) throw new Error('Manifest entry is missing');
    if (!seen.has(manifest.programMap)) throw new Error('Manifest program map is missing');
    if (manifest.type === 'daemon'
        && (!seen.has(manifest.serviceEntry) || !seen.has(manifest.serviceProgramMap))) {
      throw new Error('Daemon manifest service entry and program map must be included');
    }

    const stage = path.join(staging, `${safeProgramName}-${process.pid}-${Date.now()}`);
    const destination = path.join(programs, safeProgramName);
    await fs.mkdir(stage, { recursive: true });
    try {
      for (const file of files) {
        const target = path.resolve(stage, safeRelativePath(file.path));
        if (!target.startsWith(`${stage}${path.sep}`)) throw new Error('Bundle path escapes staging directory');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, Buffer.from(file.base64, 'base64'));
      }
      const entryBytes = await fs.readFile(path.join(stage, manifest.entry));
      const digest = createHash('sha256').update(entryBytes).digest('hex');
      if (manifest.sha256 && manifest.sha256 !== digest) throw new Error('Manifest entry hash does not match');
      const activatedManifest = { ...manifest, sha256: digest };
      await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify(activatedManifest, null, 2) + '\n');
      await fs.mkdir(programs, { recursive: true });
      await fs.rename(stage, destination);
      return activatedManifest;
    } catch (error) {
      await fs.rm(stage, { recursive: true, force: true });
      throw error;
    }
  }

  async function read(name) {
    const safeProgramName = safeName(name, 'program name');
    const directory = path.join(programs, safeProgramName);
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    return { ...manifest, directory };
  }

  return { install, read };
}
