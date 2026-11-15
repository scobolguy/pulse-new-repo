import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCsharp } from './parser.mjs';
import { compileScalarToPcode } from '../../dotnet/compile-scalar-to-pcode.mjs';
import { prepareScalarImports, linkScalarLibraries } from '../../dotnet/scalar-library.mjs';
import { createDotnetServiceContract } from '../../dotnet/service-contract.mjs';
import { PULSE_NETWORK_IMPORTS } from '../../dotnet/pulse-network-library.mjs';
import { cacheConstraintError, parseCacheFields } from '../../dotnet/cache-schema.mjs';

function attributeValues(attribute) {
  const values = {};
  const positional = [];
  for (const argument of attribute.arguments || []) {
    if (argument.kind === 'assign' && argument.left.kind === 'name') values[argument.left.name] = argument.right;
    else positional.push(argument);
  }
  return { positional, values };
}

function literalValue(node) {
  return node?.kind === 'literal' ? node.value : undefined;
}

export function compileCsharpToPcode(source, { fileName = 'program.cs', libraries = [], target = 'js' } = {}) {
  if (typeof source !== 'string') throw new TypeError('C# source must be a string');
  const program = parseCsharp(source, { fileName });
  const daemonClasses = program.classes.filter(item => item.attributes?.some(attribute => attribute.name === 'Daemon'));
  const cacheDeclarations = program.classes.flatMap(item => item.attributes?.filter(attribute => attribute.name === 'Cache')
    .map(attribute => ({ attribute, owner: item.name })) || []);
  const virtualCacheDeclarations = program.classes.flatMap(item => item.attributes?.filter(attribute => attribute.name === 'VirtualCache')
    .map(attribute => ({ attribute, owner: item.name })) || []);
  if (daemonClasses.length > 1) throw new Error('C# source may declare only one [Daemon]');
  const daemon = daemonClasses[0]?.attributes.find(attribute => attribute.name === 'Daemon');
  const daemonValues = daemon ? attributeValues(daemon) : null;
  const daemonId = daemon && literalValue(daemonValues.positional[0]);
  const daemonRefreshMs = daemon && Number(literalValue(daemonValues.values.RefreshMs));
  if (daemon && (typeof daemonId !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(daemonId)
      || !Number.isSafeInteger(daemonRefreshMs) || daemonRefreshMs < 10 || daemonRefreshMs > 300000))
    throw new Error('[Daemon] requires an id and RefreshMs between 10 and 300000');
  const serviceClass = program.classes.find(item =>
    item.modifiers.has('sealed') && item.methods.some(method => method.attributes.some(attribute =>
      ['HttpGet', 'HttpPost'].includes(attribute.name))));
  const serviceEndpoints = serviceClass ? serviceClass.methods.flatMap(method => method.attributes
    .filter(attribute => ['HttpGet', 'HttpPost'].includes(attribute.name))
    .map(attribute => ({
      verb: attribute.name === 'HttpGet' ? 'GET' : 'POST',
      path: attribute.arguments[0]?.value,
      handler: method.name
    }))) : [];
  let service = null;
  if (serviceClass) {
    if (program.classes.length !== 1) throw new Error('C# hosted services must contain one sealed service class');
    for (const endpoint of serviceEndpoints) {
      const method = serviceClass.methods.find(item => item.name === endpoint.handler);
      if (!method.async || method.returnType.name !== 'Task' || method.returnType.typeArguments?.length !== 1) {
        throw new Error(`C# service handler '${endpoint.handler}' must return async Task<T>`);
      }
      const cancellation = method.params.filter(parameter => parameter.type.name === 'CancellationToken');
      if (cancellation.length > 1 || method.params.some(parameter => parameter.type.name !== 'CancellationToken')) {
        throw new Error(`C# service handler '${endpoint.handler}' must use only CancellationToken parameters`);
      }
      method.returnType = method.returnType.typeArguments[0];
      method.params = [];
    }
    service = {
      id: serviceClass.name,
      handlers: serviceEndpoints.map(endpoint => endpoint.handler),
      contract: createDotnetServiceContract({ id: serviceClass.name, endpoints: serviceEndpoints })
    };
  }
  const imports = [...PULSE_NETWORK_IMPORTS, ...prepareScalarImports(libraries, 'csharp', target)];
  const artifact = linkScalarLibraries(compileScalarToPcode(program, source, {
    fileName, sourceLanguage: 'csharp', imports, target, service
  }), libraries);
  if (daemon) {
    artifact.programMap.runtimeUnit = { kind: 'daemon', id: daemonId, refreshMs: daemonRefreshMs };
    artifact.runtimeUnit = artifact.programMap.runtimeUnit;
    artifact.programMap.targets = ['js', 'esp32'];
    artifact.programMap.hostBindingsVersion = 1;
  }
  const caches = cacheDeclarations.map(cache => {
    const values = attributeValues(cache.attribute);
    const name = literalValue(values.positional[0]);
    const capacity = Number(literalValue(values.values.Capacity));
    const ttlMs = Number(literalValue(values.values.TtlMs));
    const storage = literalValue(values.values.Storage) || 'RAM';
    const mode = literalValue(values.values.Mode) || 'PERSISTENT';
    const parsedFields = parseCacheFields(literalValue(values.values.Fields));
    const uniqueBy = literalValue(values.values.UniqueBy);
    const latestBy = literalValue(values.values.LatestBy);
    if (typeof name !== 'string' || capacity !== 50
      || !Number.isSafeInteger(ttlMs) || ttlMs < 1
      || !['RAM', 'FFS'].includes(storage) || !['PERSISTENT', 'UPDATEABLE'].includes(mode)
      || parsedFields.error
      || uniqueBy !== undefined && (typeof uniqueBy !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(uniqueBy))
      || latestBy !== undefined && (typeof latestBy !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(latestBy)))
      throw new Error(`[Cache] requires a name, Capacity 50, positive TtlMs, and Fields: ${parsedFields.error || 'invalid declaration'}`);
    const constraintError = cacheConstraintError(parsedFields.fields, uniqueBy, latestBy);
    if (constraintError) throw new Error(`[Cache] ${constraintError}`);
    return { name, capacity, ttlMs, storage, mode, fields: parsedFields.fields,
      ...(uniqueBy ? { uniqueBy } : {}), ...(latestBy ? { latestBy } : {}) };
  });
  const virtualCaches = virtualCacheDeclarations.map(cache => {
    const values = attributeValues(cache.attribute);
    const name = literalValue(values.positional[0]);
    const sources = literalValue(values.values.Sources)?.split(',').map(source => source.trim()).filter(Boolean);
    const storage = literalValue(values.values.Storage) || 'RAM';
    const mode = literalValue(values.values.Mode) || 'PERSISTENT';
    if (typeof name !== 'string' || !Array.isArray(sources) || !sources.length
      || sources.some(source => !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(source))
      || !['RAM', 'FFS'].includes(storage) || !['PERSISTENT', 'UPDATEABLE'].includes(mode))
      throw new Error('[VirtualCache] requires a name, comma-separated Sources, Storage, and Mode');
    return { name, capacity: 50, fields: [], virtual: true, sources, storage, mode };
  });
  const names = [...caches, ...virtualCaches].map(cache => cache.name);
  if (new Set(names).size !== names.length)
    throw new Error('Cache names must be unique within a node');
  if (caches.length || virtualCaches.length) {
    artifact.programMap.hostCaches = [...caches, ...virtualCaches];
  }
  if (service) {
    artifact.programMap.serviceEndpoints = service.contract.serviceEndpoints.map(endpoint => {
      const procedure = Object.values(artifact.programMap.procedures)
        .find(candidate => candidate.name.endsWith(`.${endpoint.handler}`));
      if (!procedure) throw new Error(`C# service endpoint handler not emitted: ${endpoint.handler}`);
      return { ...endpoint, entryLabel: procedure.label };
    });
  }
  return artifact;
}

export async function main(args = process.argv.slice(2)) {
  const [input, output, ...extra] = args;
  if (!input || !output || extra.length) throw new Error('Usage: node compile-csharp-to-pcode.mjs input.cs output.pcode');
  const artifact = compileCsharpToPcode(await fs.readFile(input, 'utf8'), { fileName: path.resolve(input) });
  const mapOutput = output.replace(/(?:\.pcode)?$/, '.program.json');
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, artifact.pcodeText, 'utf8');
  await fs.writeFile(mapOutput, JSON.stringify(artifact.programMap, null, 2) + '\n', 'utf8');
  console.log(`Compiled ${input} -> ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[CSHARP] ${error.message}`); process.exitCode = 1; });
}
