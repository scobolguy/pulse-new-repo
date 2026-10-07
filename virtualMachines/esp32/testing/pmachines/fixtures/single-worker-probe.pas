service 'worker-probe';

function slowCounter(): string;
var previous: string;
    counter: integer;
    remaining: integer;
    result: string;
begin
  previous := host.table_get('probe', 'count');
  counter := 0;
  if previous <> '{}' then counter := host.json_integer(previous, 'count');
  remaining := 3000;
  while remaining > 0 do remaining := remaining - 1;
  result := host.json_set('{}', 'count', counter + 1);
  host.table_put('probe', 'count', result, 180000);
  return result
end;

get '/health';
begin
  return slowCounter()
end

get '/api/discovery/snapshot';
begin
  return host.table_get('probe', 'count')
end
end.
