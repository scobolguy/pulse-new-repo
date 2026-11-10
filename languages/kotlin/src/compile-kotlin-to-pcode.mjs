import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileScalarToPcode } from '../../dotnet/compile-scalar-to-pcode.mjs';
import { createDotnetServiceContract } from '../../dotnet/service-contract.mjs';
import { parseKotlin } from './parser.mjs';

const hostFunctions = [
  ['http', 'requestBody', 'event_body', [], 'string'],
  ['http', 'requestMethod', 'event_method', [], 'string'],
  ['http', 'requestPath', 'event_path', [], 'string'],
  ['http', 'requestPeer', 'event_peer', [], 'string'],
  ['http', 'requestQuery', 'event_query', ['string'], 'string'],
  ['http', 'requestHeader', 'event_header', ['string'], 'string'],
  ['net', 'tcpExchange', 'tcp_exchange', ['string', 'int', 'string', 'int', 'int', 'int'], 'string'],
  ['net', 'udpExchange', 'udp_exchange', ['string', 'int', 'string', 'int', 'int'], 'string']
].map(([module, name, binding, parameterTypes, returnType]) => ({
  module, name, key: `Program.${name}`, label: `host.${binding}`, parameterTypes, returnType
}));
const standardLibraryFunctions = [
  { name: 'assertEquals', key: 'Program.assertEquals', label: 'system.assert.equals',
    parameterTypes: ['int', 'int'], returnType: 'void' },
  { name: 'yield', key: 'Program.yield', label: 'system.coroutine.yield',
    parameterTypes: [], returnType: 'void' }
];

export function compileKotlinToPcode(source, { fileName = 'program.kt', target = 'js', serviceId } = {}) {
  const program = parseKotlin(source, { fileName });
  let service = null;
  if (program.endpoints.length) {
    const id = serviceId ?? path.basename(fileName, path.extname(fileName));
    const contract = createDotnetServiceContract({ id, endpoints: program.endpoints,
      allowedVerbs: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] });
    for (const endpoint of program.endpoints) {
      if (endpoint.path !== '/health' && !endpoint.path.startsWith('/api/'))
        throw new Error('Kotlin hosted endpoint paths must be /health or start with /api/');
      if (program.classes[0].methods.filter(method => method.name === endpoint.handler).length !== 1)
        throw new Error(`Kotlin service handler '${endpoint.handler}' must not be overloaded`);
    }
    contract.sourceLanguage = 'kotlin';
    contract.capabilities.sourceLanguage = 'kotlin';
    contract.capabilities.provider = 'kotlin';
    contract.capabilities.runtime = 'kotlin-pmachine';
    contract.provider = 'kotlin';
    service = { id, handlers: program.endpoints.map(endpoint => endpoint.handler),
      dispatchEndpoints: program.endpoints, contract };
    contract.serviceEndpoints = contract.serviceEndpoints.map(({ verb, path: endpointPath }) =>
      ({ verb, path: endpointPath }));
  } else if (serviceId !== undefined) {
    throw new Error('serviceId requires at least one @HttpGet handler');
  }
  const artifact = compileScalarToPcode(program, source, {
    fileName, sourceLanguage: 'kotlin', target, service,
    imports: [
      ...(!service ? standardLibraryFunctions.filter(item =>
        program.hostImports.includes('importkotlin.test.*')
        || program.hostImports.includes('importkotlin.test.assertEquals')
        || program.hostImports.includes('importkotlinx.coroutines.*')
        || program.hostImports.includes('importkotlinx.coroutines.yield')) : []),
      ...(service ? hostFunctions.filter(item =>
        program.hostImports.includes(`importpulse.${item.module}.*`)
        || program.hostImports.includes(`importpulse.${item.module}.${item.name}`)) : [])
    ]
  });
  if (service && /^CALL_EXT (?!host\.)/m.test(artifact.pcodeText))
    throw new Error('Kotlin hosted services do not yet support scalar library calls such as integer division or integer-to-string conversion');
  return artifact;
}

export async function main(args = process.argv.slice(2)) {
  const [input, output, ...options] = args;
  const usage = 'Usage: node compile-kotlin-to-pcode.mjs input.kt output.pcode [--target js|esp32] [--service-id id]';
  if (!input || !output) throw new Error(usage);
  const settings = { fileName: path.resolve(input) };
  const seen = new Set();
  for (let index = 0; index < options.length; index += 2) {
    const option = options[index], value = options[index + 1];
    if (!['--target', '--service-id'].includes(option) || !value || value.startsWith('--') || seen.has(option))
      throw new Error(usage);
    seen.add(option);
    if (option === '--target') settings.target = value;
    else settings.serviceId = value;
  }
  const artifact = compileKotlinToPcode(await fs.readFile(input, 'utf8'), settings);
  const mapOutput = output.replace(/(?:\.pcode)?$/, '.program.json');
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, artifact.pcodeText, 'utf8');
  await fs.writeFile(mapOutput, JSON.stringify(artifact.programMap, null, 2) + '\n', 'utf8');
  console.log(`Compiled ${input} -> ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[KOTLIN] ${error.message}`); process.exitCode = 1; });
}
