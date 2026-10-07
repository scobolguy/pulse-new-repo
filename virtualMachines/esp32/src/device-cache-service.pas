service 'device-cache';
{ Read-only view of the shared device cache written by the Kasa and Tuya collector daemons
  hosted in the same context. GET /api/devices/names returns a page of at most 10 names in
  key order; clients pass nextCursor back as ?cursor= until continuation = 'end' to collect
  every cached name (at most 50, so at most 5 pages). A single 50-name body was measured to
  fragment the ESP32 heap (largest free block < 2 KB) while it was being grown. }
type Device = record name: string; protocol: string; address: string; deviceType: string; end;
var devices: cache of Device;
    cursor: string;
    last: string;
    body: string;
    listed: integer;

get '/api/devices/names';
begin
  body := host.json_embed(host.json_set('{}', 'count', devices.count()), 'names', '[]');
  last := '';
  listed := 0;
  cursor := devices.next(host.event_query('cursor'));
  while (cursor <> '') and (listed < 10) do
  begin
    body := host.json_append(body, 'names', devices.get(cursor).name);
    listed := listed + 1;
    last := cursor;
    cursor := devices.next(cursor)
  end;
  if cursor = '' then
    return host.json_set(host.json_set(body, 'continuation', 'end'), 'nextCursor', '');
  return host.json_set(host.json_set(body, 'continuation', 'continue'), 'nextCursor', last)
end

get '/health';
begin
  return '{"status":"ok","service":"device-cache","runtime":"pascalish-hosted"}'
end
get '/api/devices/snapshot';
begin
  return devices.snapshot(host.event_query('cursor'), host.event_query('revision'))
end
end.