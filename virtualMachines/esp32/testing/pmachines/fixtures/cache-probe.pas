service 'cache-probe';
type Item = record count: integer; label: string; end;
var devices: cache of Item;
    item: Item;
    index, total: integer;

post '/api/cache-probe/seed';
begin
  item.label := 'seed';
  index := 0;
  while index < 50 do
  begin
    item.count := index;
    devices.put(host.json_set('{}', 'n', index), item, 180000);
    index := index + 1
  end;
  index := 0;
  total := 0;
  while index < 50 do
  begin
    item := devices.get(host.json_set('{}', 'n', index));
    if (item.count <> index) or (item.label <> 'seed') then
    begin
      host.http_status(500);
      return '{"error":"Cached record differs from inserted record"}'
    end;
    total := total + item.count;
    index := index + 1
  end;
  return host.json_set('{}', 'sum', total)
end

post '/api/cache-probe/put';
begin
  item.count := host.json_integer(host.event_body(), 'count');
  item.label := host.json_text(host.event_body(), 'label');
  devices.put(host.json_text(host.event_body(), 'key'), item,
    host.json_integer(host.event_body(), 'ttl'));
  return '{"ok":true}'
end

get '/api/cache-probe/get';
begin
  item := devices.get(host.event_query('key'));
  return host.json_set(host.json_set('{}', 'count', item.count), 'label', item.label)
end

post '/api/cache-probe/remove';
begin
  return host.json_set('{}', 'removed', devices.remove(host.json_text(host.event_body(), 'key')))
end
end.
