import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const aggregatorRoot = path.join(workspaceRoot, 'aggregator');

const requiredDirectories = [
  'src/backend/roles',
  'src/backend/modules',
  'src/backend/databaseProviders',
  'src/broker',
  'src/esp32',
  'src/pascal',
  'src/compliance',
  'src/mcp'
];

const requiredCompositionImports = [
  "./src/backend/roles/queueBrokerOpsRoutes.mjs",
  "./src/backend/modules/startupBootstrap.mjs",
  "./src/broker/queueManagerProviders/index.mjs",
  "./src/backend/databaseProviders/index.mjs",
  "./src/esp32/nodeRegistry.mjs",
  "./src/pascal/compilerService.mjs",
  "./src/compliance/sanctionsService.mjs"
];

for (const relativePath of requiredDirectories) {
  await access(path.join(aggregatorRoot, relativePath), constants.F_OK);
}

const backendSource = await readFile(path.join(aggregatorRoot, 'backend.mjs'), 'utf8');
for (const importPath of requiredCompositionImports) {
  if (!backendSource.includes(importPath)) {
    throw new Error(`Aggregator composition root no longer imports ${importPath}`);
  }
}

console.log(`[aggregator-modules] OK: ${requiredDirectories.length} module families and ${requiredCompositionImports.length} composition seams are present`);