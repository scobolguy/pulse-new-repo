import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredDirectories = [
  'documentation',
  'code',
  'pmachines',
  'testing',
  'artifacts',
  'runtime'
];

const requiredFiles = [
  '.editorconfig',
  'documentation/README.md',
  'documentation/operations/REPOSITORY_HYGIENE_PLAN.md',
  'documentation/operations/RUNBOOK.md',
  'documentation/operations/MIGRATION_MANIFEST.json',
  'documentation/api/README.md',
  'documentation/api/FFS_API.md',
  'documentation/api/CAMERA_API.md',
  'documentation/api/DISPLAY_API.md',
  'documentation/api/TLS_ENROLLMENT_API_CONTRACT.md',
  'documentation/guides/CAMERA_INTEGRATION_GUIDE.md',
  'documentation/guides/CAMERA_TESTING_GUIDE.md',
  'documentation/guides/README.md',
  'documentation/guides/AWS_IOT_GATEWAY_README.md',
  'documentation/guides/AWS_IOT_GATEWAY_SETUP.md',
  'documentation/guides/FLOW_BUILD_HANDOFF.md',
  'documentation/guides/PRINTER_SCANNER_CONTROLLER.md',
  'documentation/compilers/COMPILER_PMACHINE_ISSUES_RESOLUTION.md',
  'documentation/compilers/LANGUAGE_DATABASE_QUEUE_RUNTIME.md',
  'documentation/compilers/MAPL-BNF.md',
  'documentation/compilers/Pascalish-BNF.md',
  'documentation/compilers/PASCALISH_WFL_MAPL_PCODE_DESIGN_SPEC.md',
  'documentation/compilers/PCODE_CONSTRUCT_OPCODE_COMPATIBILITY_MATRIX.md',
  'documentation/compilers/Language-Quick-Reference.md',
  'documentation/architecture/GENERIC_FLOW_NODE_MODEL_RUNTIME_SEMANTICS.md',
  'documentation/architecture/ESPVM_Architecture_Spec_v1.0.txt',
  'documentation/architecture/SITUATION_RESOLUTION_SCHEMA.md',
  'documentation/architecture/JSON_Approach.md',
  'documentation/architecture/README.md',
  'documentation/compilers/README.md',
  'documentation/pmachines/PCODE_Compatibility_Contract.md',
  'documentation/pmachines/PARITY_MATRIX.md',
  'documentation/pmachines/EVOLUTION_STRATEGY.md',
  'documentation/pmachines/FUTURE_ENHANCEMENTS.md',
  'documentation/pmachines/schemas/pmachine_organism_schema.json',
  'documentation/pmachines/schemas/pmachine_organism_manifest_schema.json',
  'documentation/pmachines/schemas/pmachine_fitness_schema.json',
  'code/README.md',
  'pmachines/README.md',
  'pmachines/shared/contracts/pcode-opcodes.manifest.json',
  'testing/README.md',
  'artifacts/README.md',
  'runtime/README.md'
];

async function requirePath(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  await access(absolutePath, constants.F_OK);
}

for (const relativePath of [...requiredDirectories, ...requiredFiles]) {
  await requirePath(relativePath);
}

for (const relativePath of requiredFiles.filter(file => file.endsWith('.json'))) {
  const contents = await readFile(path.join(workspaceRoot, relativePath), 'utf8');
  JSON.parse(contents);
}

console.log(`[workspace-layout] OK: ${requiredDirectories.length} boundaries, ${requiredFiles.length} required files, and 3 PMachine schemas are present`);