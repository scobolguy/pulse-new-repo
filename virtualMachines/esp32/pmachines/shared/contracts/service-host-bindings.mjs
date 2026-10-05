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
    procedures: map.procedures,
    ...(Array.isArray(map.hostTables) ? { hostTables: map.hostTables } : {})
  };
}

export const SERVICE_HOST_BINDINGS = Object.freeze({
  'host.clock': { arity: 0, result: 'integer' },
  'host.event_body': { arity: 0, result: 'string' },
  'host.event_peer': { arity: 0, result: 'string' },
  'host.event_port': { arity: 0, result: 'integer' },
  'host.event_method': { arity: 0, result: 'string' },
  'host.event_path': { arity: 0, result: 'string' },
  'host.event_query': { arity: 1, args: ['string'], result: 'string' },
  'host.collector_id': { arity: 0, result: 'string' },
  'host.boot_id': { arity: 0, result: 'string' },
  'host.next_sequence': { arity: 0, result: 'integer' },
  'host.observation_ttl': { arity: 0, result: 'integer' },
  'host.announcement': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_text': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.json_set': { arity: 3, args: ['string', 'string', 'scalar'], result: 'string' },
  'host.json_embed': { arity: 3, args: ['string', 'string', 'string'], result: 'string' },
  'host.json_merge': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.table_get': { arity: 2, args: ['string', 'string'], result: 'string' },
  'host.table_put': { arity: 4, args: ['string', 'string', 'string', 'integer'], result: 'integer' },
  'host.table_expire': { arity: 1, args: ['string'], result: 'integer' },
  'host.table_snapshot': { arity: 3, args: ['string', 'string', 'integer'], result: 'string' },
  'host.udp_reply': { arity: 1, args: ['string'], result: 'integer' },
  'host.http_status': { arity: 1, args: ['integer'], result: 'integer' }
});
