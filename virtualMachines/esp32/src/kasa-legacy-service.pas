service 'kasa-legacy';

function encryptBytes(plain: string): string;
var index: integer;
    key: integer;
    encrypted: integer;
begin
  key := 171;
  index := 0;
  encrypted := host.buffer_create(host.bytes_length(plain));
  while index < host.bytes_length(plain) do
  begin
    key := host.byte_xor(key, host.bytes_get(plain, index));
    encrypted := host.buffer_append(encrypted, key);
    index := index + 1
  end;
  return host.buffer_hex(encrypted)
end;

function decryptBytes(encrypted: string): string;
var index: integer;
    key: integer;
    cipher: integer;
    plain: integer;
begin
  key := 171;
  index := 0;
  plain := host.buffer_create(host.bytes_length(encrypted));
  while index < host.bytes_length(encrypted) do
  begin
    cipher := host.bytes_get(encrypted, index);
    plain := host.buffer_append(plain, host.byte_xor(key, cipher));
    key := cipher;
    index := index + 1
  end;
  return host.buffer_text(plain)
end;

function exchange(address: string; command: string): string;
var encrypted: string;
    response: string;
begin
  encrypted := encryptBytes(host.bytes_from_text(command));
  response := host.tcp_exchange(address, 9999, host.bytes_join(
    host.bytes_append('000000', host.bytes_length(encrypted)), encrypted), 4, 1500, 2048);
  return decryptBytes(host.bytes_slice(response, 4, host.bytes_length(response) - 4))
end;

function deviceKind(model: string): string;
var family: string;
begin
  family := host.bytes_from_text(model);
  if host.bytes_length(family) < 3 then return 'unknown';
  family := host.bytes_text(host.bytes_slice(family, 0, 3));
  if (family = 'HS2') or (family = 'KS2') then return 'wallSwitch';
  if (family = 'HS1') or (family = 'KP1') or (family = 'KP4') or
     (family = 'EP1') or (family = 'EP2') or (family = 'EP4') then return 'smartPlug';
  return 'unknown'
end;

function remember(address: string; response: string; includeState: integer): string;
var systemInfo: string;
    device: string;
    result: string;
begin
  systemInfo := host.json_value(host.json_value(response, 'system'), 'get_sysinfo');
  if host.json_integer(systemInfo, 'err_code') <> 0 then
  begin
    host.http_status(502);
    return host.json_embed('{"error":"Kasa get_sysinfo failed"}', 'response', response)
  end;
  device := host.json_set('{}', 'deviceName', host.json_text(systemInfo, 'alias'));
  device := host.json_set(device, 'ipAddress', address);
  device := host.json_set(device, 'deviceType', deviceKind(host.json_text(systemInfo, 'model')));
  host.table_put('devices', address, device, host.observation_ttl());
  if includeState = 0 then return device;
  device := host.json_set(device, 'relay_state', host.json_integer(systemInfo, 'relay_state'));
  result := host.json_set('{"status":"ok","protocol":"kasa-legacy"}', 'ip', address);
  return host.json_embed(result, 'device', device)
end;

function invokeAction(): string;
var address: string;
    action: string;
    response: string;
    acknowledgement: string;
    info: string;
    state: integer;
begin
  address := host.json_text(host.event_body(), 'ip');
  action := host.json_text(host.event_body(), 'action');
  if action = 'status' then
    return remember(address, exchange(address, '{"system":{"get_sysinfo":{}}}'), 1);
  if (action <> 'on') and (action <> 'off') and (action <> 'toggle') then
  begin
    host.http_status(400);
    return '{"error":"Expected action status, on, off or toggle"}'
  end;
  state := 0;
  if action = 'on' then state := 1;
  if action = 'toggle' then
  begin
    response := exchange(address, '{"system":{"get_sysinfo":{}}}');
    info := host.json_value(host.json_value(response, 'system'), 'get_sysinfo');
    if host.json_integer(info, 'err_code') <> 0 then
    begin
      host.http_status(502);
      return '{"error":"Kasa status failed; relay unchanged"}'
    end;
    state := host.json_integer(info, 'relay_state');
    if (state <> 0) and (state <> 1) then
    begin
      host.http_status(502);
      return '{"error":"Invalid relay state; relay unchanged"}'
    end;
    state := 1 - state
  end;
  if state = 1 then
    response := exchange(address, '{"system":{"set_relay_state":{"state":1}}}')
  else
    response := exchange(address, '{"system":{"set_relay_state":{"state":0}}}');
  acknowledgement := host.json_value(host.json_value(response, 'system'), 'set_relay_state');
  if host.json_integer(acknowledgement, 'err_code') <> 0 then
  begin
    host.http_status(502);
    return host.json_embed('{"error":"Kasa relay command failed"}', 'response', response)
  end;
  return remember(address, exchange(address, '{"system":{"get_sysinfo":{}}}'), 1)
end;

get '/api/kasa/status';
begin
  return remember(host.event_query('ip'),
    exchange(host.event_query('ip'), '{"system":{"get_sysinfo":{}}}'), 1)
end

get '/api/kasa/discover';
begin
  return remember(host.event_query('ip'), decryptBytes(
    host.udp_exchange(host.event_query('ip'), 9999,
      encryptBytes(host.bytes_from_text('{"system":{"get_sysinfo":{}}}')), 1500, 2048)), 0)
end

get '/api/kasa/devices';
begin
  host.table_expire('devices');
  return host.table_snapshot_values('devices', host.event_query('cursor'), 5)
end

post '/api/kasa/action';
begin
  return invokeAction()
end

get '/health';
begin
  return '{"status":"ok","service":"kasa-legacy","runtime":"pascalish-hosted"}'
end
end.
