service 'inventory-stock';

function stock(item: string): string;
var requestBytes: string;
    response: string;
    result: string;
begin
  requestBytes := host.bytes_from_text(host.json_set('{}', 'item', item));
  response := host.tcp_exchange('@GATEWAY_IP@', @GATEWAY_PORT@,
    host.bytes_join(host.bytes_append('000000', host.bytes_length(requestBytes)), requestBytes),
    4, 1500, 512);
  response := host.bytes_text(host.bytes_slice(response, 4, host.bytes_length(response) - 4));
  if host.json_integer(response, 'status') <> 200 then
  begin
    host.http_status(host.json_integer(response, 'status'));
    return host.json_set('{}', 'error', host.json_text(response, 'error'))
  end;
  result := host.json_set('{}', 'inStock', host.json_integer(response, 'inStock'));
  return host.json_set(result, 'committed', host.json_integer(response, 'committed'))
end;

function pathwayStock(): string;
var result: string;
begin
  result := stock(host.json_text(host.event_body(), 'data'));
  if host.json_has(result, 'error') <> 0 then return result;
  return host.json_set('{"code":0}', 'data', result)
end;

function apiStock(): string;
begin
  return stock(host.json_text(host.event_body(), 'item'))
end;

post '/api/pathway/inventory-stock';
begin
  return pathwayStock()
end

post '/api/inventory/stock';
begin
  return apiStock()
end
end.
