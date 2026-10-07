daemon 'second-service-daemon' every 1 second;
var previous: string;
    count: integer;
begin
  previous := host.table_get('devices', 'ticks');
  count := 0;
  if previous <> '{}' then count := host.json_integer(previous, 'count');
  host.table_put('devices', 'ticks', host.json_set('{}', 'count', count + 1), 180000);
  host.table_expire('devices')
end.
