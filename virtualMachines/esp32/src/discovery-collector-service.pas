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

post '/api/pmachine/announce';
begin
  return ingestNode(host.event_body(), host.event_peer())
end

post '/events/udp';
begin
  return '{"status":"ignored"}'
end

get '/api/discovery/snapshot';
begin
  return host.table_snapshot('nodes', host.event_query('cursor'), 5)
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
