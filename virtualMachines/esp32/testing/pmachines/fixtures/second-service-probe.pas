service 'second-service-probe';

function identity(value: string): string;
begin
  value := host.json_set(value, 'collectorId', host.collector_id());
  value := host.json_set(value, 'bootId', host.boot_id());
  return host.json_set(value, 'sequence', host.next_sequence())
end;

function slowCounter(): string;
var previous: string;
    count: integer;
    remaining: integer;
begin
  previous := host.table_get('devices', 'slow');
  count := 0;
  if previous <> '{}' then count := host.json_integer(previous, 'count');
  remaining := 3000;
  while remaining > 0 do remaining := remaining - 1;
  previous := host.json_set('{}', 'count', count + 1);
  host.table_put('devices', 'slow', previous, 180000);
  return identity(previous)
end;

get '/api/service-probe/state';
begin
  return identity(host.json_embed(
    host.json_embed('{}', 'devices', host.table_snapshot_values('devices', '', 5)),
    'ticks', host.table_get('devices', 'ticks')))
end

post '/api/service-probe/put';
begin
  host.table_put('devices', '192.168.2.28', host.event_body(), 180000);
  return identity(host.event_body())
end

get '/api/service-probe/blocked';
begin
  return host.udp_exchange('192.168.2.28', 9999, '00', 100, 64)
end

get '/api/service-probe/slow';
begin
  return slowCounter()
end

post '/events/udp';
begin
  host.table_put('devices', 'udp', host.event_body(), 180000);
  host.udp_reply(identity('{"status":"ack"}'));
  return '{"status":"ok"}'
end
end.
