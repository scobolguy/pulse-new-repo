export const SERVICE_HOST_BINDINGS_VERSION = 1;

export function compactServiceHostProgramMap(map) {
  if (map?.hostBindingsVersion !== SERVICE_HOST_BINDINGS_VERSION
    || !['service', 'daemon'].includes(map.runtimeUnit?.kind)) {
    throw new Error('Expected a hosted service or daemon program map');
  }
  return {
    version: map.version,
    hostBindingsVersion: map.hostBindingsVersion,
    targets: map.targets,
    runtimeUnit: map.runtimeUnit,
    ...(map.hostCapabilitiesVersion !== undefined ? { hostCapabilitiesVersion: map.hostCapabilitiesVersion } : {}),
    ...(map.requiredHostCapabilities !== undefined ? {
      requiredHostCapabilities: map.requiredHostCapabilities
    } : {}),
    ...(Array.isArray(map.serviceEndpoints) ? {
      serviceEndpoints: map.serviceEndpoints.map(({ verb, path }) => ({ verb, path }))
    } : {}),
    procedures: Object.fromEntries(Object.entries(map.procedures || {}).map(([label, procedure]) =>
      [label, { params: procedure.params }])),
    ...(Array.isArray(map.hostTables) ? { hostTables: map.hostTables } : {}),
    ...(Array.isArray(map.hostCaches) ? { hostCaches: map.hostCaches } : {})
  };
}

// Typed `cache of T` methods lower to these; source code cannot call them directly.
export const SERVICE_HOST_INTERNAL_BINDINGS = Object.freeze(new Set([
  'host.cache_get', 'host.cache_put', 'host.cache_remove', 'host.cache_next', 'host.cache_count', 'host.cache_snapshot'
]));

export const SERVICE_HOST_BINDINGS = Object.freeze({
  'host.xml_parse': { arity: 1, args: ['string'], result: 'integer', desktopOnly: true },
  'host.xml_append_document': { arity: 2, args: ['integer', 'integer'], result: 'integer', desktopOnly: true },
  'host.xml_parent': { arity: 2, args: ['integer', 'integer'], result: 'integer', desktopOnly: true },
  'host.xml_has_attribute': { arity: 3, args: ['integer', 'integer', 'string'], result: 'integer', desktopOnly: true },
  'host.text_split_whitespace': { arity: 1, args: ['string'], result: 'string', desktopOnly: true },
  'host.text_hash': { arity: 1, args: ['string'], result: 'string', desktopOnly: true },
  'host.fs_resolve_relative': { arity: 3, args: ['string', 'string', 'string'], result: 'string', capability: 'filesystem.read' },
  'host.fs_read_text_auto': { arity: 2, args: ['string', 'string'], result: 'string', capability: 'filesystem.read' },
  'host.xml_count': { arity: 1, args: ['integer'], result: 'integer', desktopOnly: true },
  ...Object.fromEntries(['local_name', 'namespace', 'text'].map(name =>
    [`host.xml_${name}`, { arity: 2, args: ['integer', 'integer'], result: 'string', desktopOnly: true }])),
  ...Object.fromEntries(['first_child', 'next_sibling', 'end'].map(name =>
    [`host.xml_${name}`, { arity: 2, args: ['integer', 'integer'], result: 'integer', desktopOnly: true }])),
  ...Object.fromEntries(['attribute', 'qname_local', 'qname_namespace'].map(name =>
    [`host.xml_${name}`, { arity: 3, args: ['integer', 'integer', 'string'], result: 'string', desktopOnly: true }])),
  'host.xml_attribute_integer': { arity: 4, args: ['integer', 'integer', 'string', 'integer'], result: 'integer', desktopOnly: true },
  'host.json_has': { arity: 2, args: ['string', 'string'], result: 'integer', desktopOnly: true },
  'host.capabilities': { arity: 0, result: 'string' },
  'host.fs_list': { arity: 4, args: ['string', 'string', 'string', 'integer'], result: 'string', capability: 'filesystem.read' },
  'host.fs_stat': { arity: 2, args: ['string', 'string'], result: 'string', capability: 'filesystem.read' },
  'host.fs_exists': { arity: 2, args: ['string', 'string'], result: 'integer', capability: 'filesystem.read' },
  'host.fs_read_text': { arity: 2, args: ['string', 'string'], result: 'string', capability: 'filesystem.read' },
  'host.fs_write_text': { arity: 3, args: ['string', 'string', 'string'], result: 'integer', capability: 'filesystem.write' },
  'host.fs_mkdir': { arity: 2, args: ['string', 'string'], result: 'integer', capability: 'filesystem.write' },
  'host.fs_rename': { arity: 3, args: ['string', 'string', 'string'], result: 'integer', capability: 'filesystem.write' },
  'host.fs_delete': { arity: 2, args: ['string', 'string'], result: 'integer', capability: 'filesystem.write' },
  'host.clock': { arity: 0, result: 'integer' },
  'host.event_body': { arity: 0, result: 'string' },
  'host.event_bytes': { arity: 0, result: 'string' },
  'host.event_peer': { arity: 0, result: 'string' },
  'host.event_port': { arity: 0, result: 'integer' },
  'host.event_method': { arity: 0, result: 'string' },
  'host.event_path': { arity: 0, result: 'string' },
  'host.event_query': { arity: 1, args: ['string'], result: 'string' },
  'host.text_header': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.text_lower': { arity: 1, args: ['string'], result: 'string' },
  'host.text_index': { arity: 2, args: ['string', 'string'], result: 'integer' },
  'host.text_slice': { arity: 3, args: ['string', 'integer', 'integer'], result: 'string' },
  'host.collector_id': { arity: 0, result: 'string' },
  'host.boot_id': { arity: 0, result: 'string' },
  'host.next_sequence': { arity: 0, result: 'integer' },
  'host.observation_ttl': { arity: 0, result: 'integer' },
  'host.announcement': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_text': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_value': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_integer': { arity: 2, args: ['string', 'string'], result: 'integer' },
  'host.json_path_text': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_path_integer': { arity: 2, args: ['string', 'string'], result: 'integer' },
  'host.buffer_json_path_text': { arity: 2, args: ['integer', 'string'], result: 'string' },
  'host.buffer_json_path_integer': { arity: 2, args: ['integer', 'string'], result: 'integer' },
  'host.json_set': { arity: 3, args: ['string', 'string', 'scalar'], result: 'string' },
  'host.json_embed': { arity: 3, args: ['string', 'string', 'string'], result: 'string' },
  'host.json_merge': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_array_count': { arity: 1, args: ['string'], result: 'integer', desktopOnly: true },
  'host.json_array_get': { arity: 2, args: ['string', 'integer'], result: 'string', desktopOnly: true },
  'host.json_array_append': { arity: 2, args: ['string', 'string'], result: 'string', desktopOnly: true },
  'host.json_array_set': { arity: 3, args: ['string', 'integer', 'string'], result: 'string', desktopOnly: true },
  'host.json_array_remove': { arity: 2, args: ['string', 'integer'], result: 'string', desktopOnly: true },
  'host.json_format': { arity: 2, args: ['string', 'integer'], result: 'string', desktopOnly: true },
  'host.json_append': { arity: 3, args: ['string', 'string', 'scalar'], result: 'string' },
  'host.raise_error': { arity: 1, args: ['string'], result: 'integer' },
  'host.table_get': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.cache_get': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.cache_put': { arity: 4, args: ['string', 'string', 'string', 'integer'], result: 'integer' },
  'host.cache_remove': { arity: 2, args: ['string', 'string'], result: 'integer' },
  'host.cache_next': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.cache_count': { arity: 1, args: ['string'], result: 'integer' },
  'host.cache_snapshot': { arity: 3, args: ['string', 'string', 'string'], result: 'string' },
  'host.table_put': { arity: 4, args: ['string', 'string', 'string', 'integer'], result: 'integer' },
  'host.table_expire': { arity: 1, args: ['string'], result: 'integer' },
  'host.table_snapshot': { arity: 3, args: ['string', 'string', 'integer'], result: 'string' },
  'host.table_snapshot_values': { arity: 3, args: ['string', 'string', 'integer'], result: 'string' },
  'host.udp_reply': { arity: 1, args: ['string'], result: 'integer' },
  'host.http_status': { arity: 1, args: ['integer'], result: 'integer' },
  'host.bytes_from_text': { arity: 1, args: ['string'], result: 'string' },
  'host.bytes_text': { arity: 1, args: ['string'], result: 'string' },
  'host.bytes_length': { arity: 1, args: ['string'], result: 'integer' },
  'host.bytes_get': { arity: 2, args: ['string', 'integer'], result: 'integer' },
  'host.bytes_append': { arity: 2, args: ['string', 'integer'], result: 'string' },
  'host.bytes_slice': { arity: 3, args: ['string', 'integer', 'integer'], result: 'string' },
  'host.bytes_join': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.bytes_crc32': { arity: 1, args: ['string'], result: 'string' },
  'host.bytes_aes_ecb_decrypt': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.bytes_aes_gcm_decrypt': { arity: 5, args: ['string', 'string', 'string', 'string', 'string'], result: 'string' },
  'host.byte_xor': { arity: 2, args: ['integer', 'integer'], result: 'integer' },
  'host.buffer_create': { arity: 1, args: ['integer'], result: 'integer' },
  'host.buffer_append': { arity: 2, args: ['integer', 'integer'], result: 'integer' },
  'host.buffer_length': { arity: 1, args: ['integer'], result: 'integer' },
  'host.buffer_get': { arity: 2, args: ['integer', 'integer'], result: 'integer' },
  'host.buffer_set': { arity: 3, args: ['integer', 'integer', 'integer'], result: 'integer' },
  'host.buffer_hex': { arity: 1, args: ['integer'], result: 'string' },
  'host.buffer_text': { arity: 1, args: ['integer'], result: 'string' },
  'host.buffer_release': { arity: 1, args: ['integer'], result: 'integer' },
  'host.tcp_exchange': { arity: 6, args: ['string', 'integer', 'string', 'integer', 'integer', 'integer'], result: 'string' },
  'host.tcp_exchange_buffer': { arity: 6, args: ['string', 'integer', 'string', 'integer', 'integer', 'integer'], result: 'integer' },
  'host.udp_exchange': { arity: 5, args: ['string', 'integer', 'string', 'integer', 'integer'], result: 'string' }
});
