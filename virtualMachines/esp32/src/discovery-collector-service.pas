service 'pascalish-discovery-collector';

type Device = record name: string; protocol: string; address: string; deviceType: string; end;
var devices: cache of Device;

function ingestNode(body: string; peer: string): string;
var node: string;
    identity: string;
begin
  node := host.announcement(body, peer);
  identity := host.json_text(node, 'nodeId');
  node := host.json_merge(host.table_get('nodes', identity), node);
  host.table_put('nodes', identity, node, host.observation_ttl());
  return '{"status":"ok"}'
end;

function snapshot(): string;
var result: string;
    cursor: string;
begin
  cursor := host.event_query('cursor');
  host.table_expire('nodes');
  result := '{"protocolVersion":1}';
  result := host.json_set(result, 'collectorId', host.collector_id());
  result := host.json_set(result, 'bootId', host.boot_id());
  result := host.json_set(result, 'sequence', host.next_sequence());
  return host.json_merge(result, host.table_snapshot('nodes', cursor, 5))
end;

post '/api/pmachine/announce';
begin
  return ingestNode(host.event_body(), host.event_peer())
end

post '/events/udp';
begin
  if (host.json_text(host.event_body(), 'kind') = 'nodeBeacon') or
     (host.json_text(host.event_body(), 'kind') = 'machineAvailability') then
  begin
    ingestNode(host.event_body(), host.event_peer());
    host.udp_reply(host.json_set(host.json_set('{"kind":"nodeBeaconAck","requestDetails":false}',
      'collectorId', host.collector_id()), 'nodeId',
      host.json_text(host.announcement(host.event_body(), host.event_peer()), 'nodeId')));
    return '{"status":"ok"}'
  end;
  return '{"status":"ignored"}'
end

get '/api/discovery/snapshot';
begin
  return snapshot()
end

get '/api/devices/snapshot';
begin
  return devices.snapshot(host.event_query('cursor'), host.event_query('revision'))
end

get '/health';
begin
  return '{"status":"ok","role":"discovery-collector","protocolVersion":1,"runtime":"pascalish-hosted"}'
end
end.
