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
  ['net', 'udpExchange', 'udp_exchange', ['string', 'int', 'string', 'int', 'int'], 'string'],
  ['net', 'udpSend', 'udp_send', ['string', 'int', 'string'], 'int'],
  ['net', 'networkPeerAllowed', 'network_peer_allowed', ['string', 'int'], 'int'],
  ['net', 'localIpv4Subnets', 'local_ipv4_subnets', [], 'string']
  ,['net', 'localIpv4Batch', 'local_ipv4_batch', ['int', 'int'], 'string']
  ,['host', 'eventMethod', 'event_method', [], 'string']
  ,['host', 'eventPeer', 'event_peer', [], 'string']
  ,['host', 'eventPort', 'event_port', [], 'int']
  ,['host', 'eventBytes', 'event_bytes', [], 'string']
  ,['host', 'bytesLength', 'bytes_length', ['string'], 'int']
  ,['host', 'bytesGet', 'bytes_get', ['string', 'int'], 'int']
  ,['host', 'byteXor', 'byte_xor', ['int', 'int'], 'int']
  ,['host', 'bufferCreate', 'buffer_create', ['int'], 'int']
  ,['host', 'bufferAppend', 'buffer_append', ['int', 'int'], 'int']
  ,['host', 'bufferJsonPathText', 'buffer_json_path_text', ['int', 'string'], 'string']
  ,['host', 'bufferJsonPathInteger', 'buffer_json_path_integer', ['int', 'string'], 'int']
  ,['host', 'bufferRelease', 'buffer_release', ['int'], 'int']
  ,['host', 'jsonArrayGet', 'json_array_get', ['string', 'int'], 'string']
  ,['host', 'jsonArrayCount', 'json_array_count', ['string'], 'int']
  ,['host', 'jsonText', 'json_text', ['string', 'string'], 'string']
  ,['host', 'jsonSetText', 'json_set', ['string', 'string', 'string'], 'string']
  ,['host', 'jsonSetInteger', 'json_set', ['string', 'string', 'int'], 'string']
  ,['host', 'jsonEmbed', 'json_embed', ['string', 'string', 'string'], 'string']
  ,['host', 'jsonAppendText', 'json_append', ['string', 'string', 'string'], 'string']
  ,['host', 'cacheCount', 'cache_count', ['string'], 'int']
  ,['host', 'cacheNext', 'cache_next', ['string', 'string'], 'string']
  ,['host', 'cacheGet', 'cache_get', ['string', 'string'], 'string']
  ,['host', 'cachePut', 'cache_put', ['string', 'string', 'string', 'int'], 'int']
  ,['host', 'cacheSnapshot', 'cache_snapshot', ['string', 'string', 'string'], 'string']
  ,['host', 'raiseError', 'raise_error', ['string'], 'int']
  ,['net', 'kasaDiscover', 'kasa_discover', [], 'string']
  ,['net', 'cameraDiscover', 'camera_discover', [], 'string']
  ,['net', 'bluetoothScan', 'bluetooth_scan', ['int'], 'string']
  ,['net', 'networkDiscoveryStep', 'network_discovery_step', [], 'string']
  ,['process', 'checkpointProcess', 'checkpoint_process', ['string', 'string', 'string'], 'string']
  ,['process', 'restoreCheckpoint', 'restore_checkpoint', ['string', 'string'], 'string']
  ,['process', 'beginTransaction', 'begin_transaction', ['string', 'string'], 'string']
  ,['process', 'commitTransaction', 'commit_transaction', ['string'], 'string']
  ,['process', 'abortTransaction', 'abort_transaction', ['string'], 'string']
  ,['pmachine', 'networkReady', 'pmachine_network_ready', [], 'string']
  ,['pmachine', 'installBundle', 'pmachine_install_bundle', ['string', 'string'], 'string']
  ,['pmachine', 'start', 'pmachine_start', ['string', 'string'], 'string']
  ,['pmachine', 'stop', 'pmachine_stop', ['string'], 'string']
  ,['pmachine', 'status', 'pmachine_status', [], 'string']
  ,['pmachine', 'checkpoint', 'pmachine_checkpoint', ['string', 'string', 'string'], 'string']
  ,['pmachine', 'restore', 'pmachine_restore', ['string', 'string'], 'string']
  ,['pmachine', 'bootFixed', 'pmachine_boot_fixed', ['string'], 'string']
].map(([module, name, binding, parameterTypes, returnType]) => ({
  module, name, key: `Program.${name}`, label: `host.${binding}`, parameterTypes, returnType
}));
const standardLibraryFunctions = [
  { name: 'assertEquals', key: 'Program.assertEquals', label: 'system.assert.equals',
    parameterTypes: ['int', 'int'], returnType: 'void' },
  { name: 'yield', key: 'Program.yield', label: 'system.coroutine.yield',
    parameterTypes: [], returnType: 'void' }
];
const nativeServiceOpcodes = new Set([
  'ADD', 'AND', 'CALL', 'CALL_EXT', 'CONCAT', 'EQ', 'GE', 'GT', 'HALT', 'JMP', 'JZ',
  'LE', 'LOAD', 'LOAD_NAME', 'LT', 'MAP_RETURN', 'MUL', 'NEQ', 'NOP', 'NOT', 'OR',
  'PUSH_INT', 'PUSH_STR', 'RET', 'STORE', 'STORE_NAME', 'STREQ', 'STRNEQ', 'SUB'
]);
const nativeServiceBindings = new Set([
  'host.event_body', 'host.event_method', 'host.event_path', 'host.event_peer', 'host.event_port',
  'host.http_status', 'host.bytes_from_text', 'host.bytes_length', 'host.bytes_get', 'host.bytes_text',
  'host.bytes_join', 'host.json_kind', 'host.json_to_text', 'host.json_array_count', 'host.json_array_get',
  'host.json_array_append', 'host.json_array_set', 'host.json_array_remove', 'host.json_value',
  'host.json_text', 'host.json_integer', 'host.json_has', 'host.json_remove', 'host.json_set',
  'host.json_embed', 'host.json_merge', 'host.json_format', 'host.json_object', 'host.json_append',
  'host.json_path_text', 'host.json_path_integer', 'host.json_parse_value', 'host.json_node_kind',
  'host.json_node_member', 'host.json_node_count', 'host.json_node_item', 'host.json_node_key',
  'host.json_node_object_count', 'host.json_node_value', 'host.text_trim', 'host.string_lower',
  'host.string_upper', 'host.string_index', 'host.text_index', 'host.string_slice',
  'host.string_replace', 'host.text_split', 'host.text_split_lines', 'host.text_split_whitespace',
  'host.number_parse_integer', 'host.text_hash', 'host.text_hash_utf8', 'host.number_compare',
  'host.string_compare', 'host.date_iso', 'host.date_parse', 'host.date_now', 'host.fs_read_text',
  'host.fs_read_text_auto', 'host.fs_exists', 'host.fs_write_text', 'host.fs_resolve_relative',
  'host.raise_error'
]);

function validateNativeServiceArtifact(pcodeText) {
  for (const line of pcodeText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.endsWith(':') || trimmed.startsWith('#')) continue;
    const [opcode, binding] = trimmed.split(/\s+/, 3);
    if (!nativeServiceOpcodes.has(opcode))
      throw new Error(`Kotlin native target does not support opcode ${opcode}`);
    if (opcode === 'CALL_EXT' && !nativeServiceBindings.has(binding))
      throw new Error(`Kotlin native target does not support binding ${binding || '(missing)'}`);
  }
}

export function compileKotlinToPcode(source, {
  fileName = 'program.kt', target = 'js', serviceId, daemonId, daemonRefreshMs = 1000
} = {}) {
  if (!['js', 'esp32', 'native'].includes(target))
    throw new Error('Kotlin target must be js, esp32, or native');
  if (serviceId !== undefined && daemonId !== undefined)
    throw new Error('Kotlin cannot compile a unit as both service and daemon');
  if (!Number.isSafeInteger(daemonRefreshMs) || daemonRefreshMs < 10 || daemonRefreshMs > 300000)
    throw new Error('Kotlin daemon refresh must be between 10 and 300000 ms');
  const program = parseKotlin(source, { fileName });
  if (program.runtimeDeclarations.length > 1)
    throw new Error('Kotlin source may declare only one @Daemon');
  if (program.runtimeDeclarations.length && daemonId !== undefined)
    throw new Error('Kotlin @Daemon cannot be combined with daemonId compiler metadata');
  const declaredDaemon = program.runtimeDeclarations[0];
  if (declaredDaemon) {
    daemonId = declaredDaemon.id;
    daemonRefreshMs = declaredDaemon.refreshMs;
  }
  if (target === 'native' && daemonId !== undefined)
    throw new Error('Kotlin native target supports hosted services only');
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
  if (target === 'native' && !service)
    throw new Error('Kotlin native target supports hosted services only');
  const artifact = compileScalarToPcode(program, source, {
    fileName, sourceLanguage: 'kotlin', target: target === 'native' ? 'js' : target, service,
    imports: [
      ...(!service ? standardLibraryFunctions.filter(item =>
        program.hostImports.includes('importkotlin.test.*')
        || program.hostImports.includes('importkotlin.test.assertEquals')
        || program.hostImports.includes('importkotlinx.coroutines.*')
        || program.hostImports.includes('importkotlinx.coroutines.yield')) : []),
      ...hostFunctions.filter(item =>
        (item.module !== 'http' || service)
        && (program.hostImports.includes(`importpulse.${item.module}.*`)
          || program.hostImports.includes(`importpulse.${item.module}.${item.name}`)))
    ]
  });
  if (daemonId !== undefined) {
    artifact.programMap.runtimeUnit = { kind: 'daemon', id: daemonId, refreshMs: daemonRefreshMs };
    artifact.runtimeUnit = artifact.programMap.runtimeUnit;
    artifact.programMap.targets = ['js', 'esp32'];
    artifact.programMap.hostBindingsVersion = 1;
  }
  if (service && target === 'native') {
    artifact.programMap.target = 'native';
    artifact.programMap.targets = ['js', 'native'];
  }
  if (program.cacheDeclarations.length || program.virtualCacheDeclarations.length) {
    artifact.programMap.hostCaches = [
      ...program.cacheDeclarations,
      ...program.virtualCacheDeclarations.map(cache => ({ ...cache, virtual: true }))
    ];
  }
  if (service && /^CALL_EXT (?!host\.|system\.int32\.tostring(?:\s|$))/m.test(artifact.pcodeText))
    throw new Error('Kotlin hosted services do not yet support scalar library calls such as integer division');
  if (service && target === 'native') validateNativeServiceArtifact(artifact.pcodeText);
  return artifact;
}

export async function main(args = process.argv.slice(2)) {
  const [input, output, ...options] = args;
  const usage = 'Usage: node compile-kotlin-to-pcode.mjs input.kt output.pcode [--target js|esp32|native] [--service-id id]';
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
