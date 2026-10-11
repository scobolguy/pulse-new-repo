service 'pc-bluetooth-collector';
var page: string;
    nodes: string;
    device: string;
    visibility: string;
    index: integer;

get '/api/bluetooth/devices';
begin
  host.table_expire('bluetooth-devices');
  page := host.table_snapshot('bluetooth-devices', host.event_query('cursor'), 5);
  nodes := host.json_value(page, 'nodes');
  index := 0;
  while index < host.json_array_count(nodes) do
  begin
    device := host.json_array_get(nodes, index);
    visibility := 'known';
    if host.json_has(device, 'present') then
      if host.json_integer(device, 'present') = 1 then visibility := 'os-present';
    if host.json_has(device, 'connected') then
      if host.json_integer(device, 'connected') = 1 then visibility := 'connected';
    if host.json_has(device, 'lastAdvertisementMs') then
      if host.clock() - host.json_integer(device, 'lastAdvertisementMs') < 120000 then
        visibility := 'advertising';
    device := host.json_set(device, 'visibility', visibility);
    device := host.json_remove(device, 'endpointStates');
    nodes := host.json_array_set(nodes, index, device);
    index := index + 1
  end;
  page := host.json_embed(page, 'nodes', nodes);
  return host.json_merge(host.json_set('{"protocolVersion":1,"protocol":"bluetooth"}',
    'collectorId', host.collector_id()),
    page)
end

get '/health';
begin
  page := host.bluetooth_status();
  if (host.json_text(page, 'lastError') <> '') or
     (host.json_value(page, 'running') <> 'true') then host.http_status(503);
  return host.json_embed('{"role":"pc-bluetooth-collector","runtime":"pascalish-hosted"}',
    'discovery', page)
end
end.
