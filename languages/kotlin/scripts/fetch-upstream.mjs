import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { upstreamCases, upstreamRevision } from '../tests/upstream-cases.mjs';

const root = process.argv[2];
if (!root || process.argv.length !== 3)
  throw new Error('Usage: node scripts/fetch-upstream.mjs <corpus-testData-directory>');

for (const fixture of upstreamCases) {
  const file = path.join(root, ...fixture.path.split('/'));
  let existing;
  try {
    existing = await readFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    const hash = createHash('sha256').update(existing).digest('hex');
    if (hash !== fixture.sha256) throw new Error(`Refusing to overwrite modified fixture ${file}`);
    continue;
  }
  const url = `https://raw.githubusercontent.com/JetBrains/kotlin/${upstreamRevision}/compiler/testData/${fixture.path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Downloading ${url} failed: HTTP ${response.status}`);
  const content = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(content).digest('hex') !== fixture.sha256)
    throw new Error(`Integrity check failed for ${url}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, { flag: 'wx' });
  console.log(`Fetched ${fixture.path}`);
}
