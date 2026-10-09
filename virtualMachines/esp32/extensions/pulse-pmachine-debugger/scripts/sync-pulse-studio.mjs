import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = fileURLToPath(new URL('../', import.meta.url));
const studioRoot = fileURLToPath(new URL('../../../tools/catalog-studio-vscode/', import.meta.url));
const runtimeRoot = path.join(extensionRoot, 'out', 'pulse-studio');

await fs.mkdir(runtimeRoot, { recursive: true });
const studioExtension = await fs.readFile(path.join(studioRoot, 'extension.js'), 'utf8');
await Promise.all([
  fs.writeFile(path.join(runtimeRoot, 'extension.js'), studioExtension),
  fs.copyFile(path.join(studioRoot, 'distributedNetwork.js'), path.join(runtimeRoot, 'distributedNetwork.js')),
  fs.copyFile(path.join(studioRoot, 'language-configuration.json'), path.join(extensionRoot, 'language-configuration.json')),
  fs.cp(path.join(studioRoot, 'media'), path.join(extensionRoot, 'media'), { recursive: true, force: true }),
  fs.cp(path.join(studioRoot, 'syntaxes'), path.join(extensionRoot, 'syntaxes'), { recursive: true, force: true }),
  fs.writeFile(path.join(runtimeRoot, 'package.json'), '{\n  "type": "commonjs"\n}\n'),
]);
