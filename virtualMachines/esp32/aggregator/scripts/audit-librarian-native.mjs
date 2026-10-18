import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { SERVICE_HOST_BINDINGS } from '../../pmachines/shared/contracts/service-host-bindings.mjs';
import { createPascalishXsdParser } from '../src/librarian/xsd-parser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const budgets = { pcodeBytes: 8192, instructions: 512 };

async function sources(directory, extensions = ['.pas']) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await sources(target, extensions));
    else if (extensions.includes(path.extname(entry.name))) result.push(target);
  }
  return result.sort();
}

export async function auditSchemaCorpus(directory) {
  const files = [];
  const byExtension = {};
  let totalBytes = 0;
  for (const fileName of await sources(directory, ['.xsd', '.xml', '.json', '.json-schema', '.cpy', '.copybook'])) {
    const { size: bytes } = await fs.stat(fileName);
    const extension = path.extname(fileName);
    const group = byExtension[extension] ||= { count: 0, bytes: 0, maximumBytes: 0 };
    group.count++;
    group.bytes += bytes;
    group.maximumBytes = Math.max(group.maximumBytes, bytes);
    totalBytes += bytes;
    files.push({ path: path.relative(directory, fileName), bytes });
  }
  return {
    count: files.length, totalBytes, byExtension,
    largest: files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 10),
    exceedsNativeIngress: files.filter(file => file.bytes > 2048).length,
    exceedsCurrentFilesystemRead: files.filter(file => file.bytes > 262144).length,
  };
}

export async function auditDerivedXsdStructures(directory, schemaPaths) {
  const parser = await createPascalishXsdParser({ schemaRoot: directory });
  try {
    const results = [];
    for (const schemaPath of schemaPaths) {
      const startedAt = performance.now();
      const { tree, dependencies } = await parser.parseFileDetailed(schemaPath);
      const treeBytes = Buffer.byteLength(JSON.stringify(tree));
      results.push({
        path: schemaPath, sourceBytes: (await fs.stat(path.join(directory, schemaPath))).size,
        treeBytes, resultBytes: Buffer.byteLength(JSON.stringify({ tree, dependencies })),
        dependencyCount: dependencies.length, desktopElapsedMs: Math.ceil(performance.now() - startedAt),
        treeExceedsNativeHttpResponse: treeBytes > 20480,
      });
    }
    return results;
  } finally {
    await parser.stop();
  }
}

export async function auditLibrarianNative({ measureDerivedStructures = false } = {}) {
  const nativeHost = await fs.readFile(path.join(root, 'pmachines', 'arduino', 'src', 'service_host.cpp'), 'utf8');
  const bindingTable = nativeHost.match(/const Binding bindings\[\] = \{([\s\S]*?)\n\};/);
  if (!bindingTable) throw new Error('Cannot locate native service-host binding table');
  const nativeBindings = new Set([...bindingTable[1].matchAll(/\{"([^"]+)"/g)]
    .map(match => `host.${match[1]}`));
  if (!nativeBindings.size) throw new Error('Native service-host binding inventory is empty');
  const extendedProbe = compilePascalishProgramWithAntlr(`
service 'pulse-librarian-extended-table-probe';
var nodeOffsets: array[0..3] of integer extendable;
get '/health';
begin
  nodeOffsets[3] := 17;
  return '{"status":"ok"}'
end
end.
`, { hostServices: true });
  const extendedTables = {
    compilerDeclarations: extendedProbe.programMap.extendableDeclarations,
    hostedDeclarationConfigurationDetected: /\bmachine\.setExtendableDeclarations\s*\(/.test(nativeHost),
    hardwareVerified: false,
    intendedUse: 'Volatile node/page offset indexes; revisioned artifacts remain in Pulse Filesystem.',
    notes: [
      'Native VM extended arrays exist; hosted wiring detection is static source evidence, not an execution test.',
      'Allocation is PSRAM-first with heap fallback; actual PSRAM placement and memory admission must be measured on esp32_s3_n16r8.',
      'Extended tables do not remove page byte limits, provide durability, or establish hosted instance isolation.',
    ],
  };
  const modules = [];
  for (const fileName of await sources(path.join(root, 'src', 'librarian'))) {
    const source = await fs.readFile(fileName, 'utf8');
    const compiled = compilePascalishProgramWithAntlr(source, { fileName, hostServices: true });
    const lines = compiled.pcodeText.trim().split(/\r?\n/);
    const bindings = [...new Set(lines.flatMap(line =>
      line.match(/\bhost\.[A-Za-z_][A-Za-z0-9_]*/g) || []))].sort();
    const desktopOnlyBindings = bindings.filter(name => SERVICE_HOST_BINDINGS[name]?.desktopOnly);
    const pcodeBytes = Buffer.byteLength(compiled.pcodeText);
    modules.push({
      source: path.relative(root, fileName), serviceId: compiled.programMap.runtimeUnit.id,
      pcodeBytes, instructions: lines.length, targets: compiled.programMap.targets,
      desktopOnlyBindings,
      missingNativeBindings: bindings.filter(name => !nativeBindings.has(name)),
      extendableDeclarations: compiled.programMap.extendableDeclarations || [],
      fitsCurrentImageBudget: pcodeBytes <= budgets.pcodeBytes && lines.length <= budgets.instructions,
      nativeTarget: compiled.programMap.targets.includes('esp32'),
    });
  }
  const desktop = await fs.readFile(path.join(root, 'aggregator', 'data-librarian.mjs'), 'utf8');
  const explicitDesktopRoutes = [...desktop.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)]
    .map(match => ({ method: match[1].toUpperCase(), path: match[2] }));
  const middlewareRoutes = [
    { method: 'GET', path: '/health', source: 'src\\librarian\\routes\\metadata.pas' },
    { method: 'GET', path: '/api/librarian/llm/base', source: 'src\\librarian\\routes\\metadata.pas' },
    { method: 'GET', path: '/api/librarian/llm/actions', source: 'src\\librarian\\routes\\metadata.pas' },
    { method: 'GET', path: '/api/librarian/llm/actions/:id', source: 'src\\librarian\\routes\\metadata.pas' },
    { method: 'ANY', path: '/api/librarian/file', source: 'src\\librarian\\routes\\file-download.pas' },
    { method: 'ANY', path: '/api/librarian/file/:path(*)', source: 'src\\librarian\\routes\\file-download.pas' },
  ];
  const consumers = [];
  const consumerFiles = [];
  for (const directory of [
    'aggregator\\src', 'aggregator\\public', 'aggregator\\scripts', 'scripts', 'src',
    'extensions\\pulse-pmachine-debugger\\src',
  ]) {
    consumerFiles.push(...await sources(path.join(root, directory), ['.mjs', '.js', '.jsx', '.ts', '.html', '.ps1', '.pas', '.wfl']));
  }
  consumerFiles.push(...['backend.mjs', 'data-mapper.mjs', 'data-librarian.mjs']
    .map(name => path.join(root, 'aggregator', name)));
  consumerFiles.push(path.join(root, 'aggregator', 'data', 'service-manifest.json'));
  for (const fileName of consumerFiles.sort()) {
    if (fileName === fileURLToPath(import.meta.url)) continue;
    const lines = (await fs.readFile(fileName, 'utf8')).split(/\r?\n/);
    const references = lines.flatMap((line, index) =>
      /\/api\/librarian|pulse-data-librarian|localhost:4300|127\.0\.0\.1:4300|data-librarian\.mjs|LIBRARIAN_PORT/.test(line)
        ? [{ line: index + 1,
          endpoints: [...new Set(line.match(/\/api\/librarian(?:\/[A-Za-z0-9_:.-]+)*/g) || [])] }]
        : []);
    if (references.length) {
      const source = path.relative(root, fileName);
      consumers.push({ source, classification: source.includes('archived-old-app')
        ? 'archived-reference-review-callers' : path.extname(source) === '.pas'
          ? 'pascalish-policy' : source.includes('src\\librarian\\') || source.endsWith('data-librarian.mjs')
            ? 'desktop-implementation' : ['.wfl', '.ps1', '.json'].includes(path.extname(source))
              ? 'deployment-configuration' : 'consumer-or-transport', references });
    }
  }
  const schemaDirectory = path.join(root, 'aggregator', 'data', 'services', 'librarian', 'schemas');
  const schemaCorpus = await auditSchemaCorpus(schemaDirectory);
  return {
    version: 4, profile: 'esp32_s3_n16r8', budgets, extendedTables, modules, explicitDesktopRoutes,
    middlewareRoutes, consumers,
    schemaCorpus,
    derivedStructures: measureDerivedStructures
      ? await auditDerivedXsdStructures(schemaDirectory,
        schemaCorpus.largest.filter(file => path.extname(file.path) === '.xsd').slice(0, 3).map(file => file.path))
      : null,
    notes: [
      'Static feasibility audit only; does not prove hardware memory or execution limits.',
      'Consumer references are static evidence, not proof of runtime reachability; archived imports need caller review.',
      'Middleware route inventory requires behavioral parity tests; existing downloads are method-agnostic path routes, not query routes.',
      'Schema corpus is the repository seed, not the authoritative operational storage.',
      'Optional derived sizes use the desktop Pascalish reference, without predigested artifacts; timings are not ESP32 measurements.',
      'Image budget compliance does not imply full Librarian API parity.',
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2);
  if (options.some(option => option !== '--derived-structures')) throw new Error('Unknown native audit option');
  console.log(JSON.stringify(await auditLibrarianNative({
    measureDerivedStructures: options.includes('--derived-structures'),
  }), null, 2));
}
