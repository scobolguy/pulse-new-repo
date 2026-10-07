daemon 'kasa-collector' refresh 30000 ms
{ Read-only Kasa collector: each turn sends get_sysinfo to one configured device, alternating,
  so each device is polled about every 60 s. Failures are surfaced with host.raise_error and leave the
  existing cache record in place until its TTL expires. No relay commands are issued. }
type Device = record name: string; protocol: string; address: string; deviceType: string; end;
var devices: cache of Device;
    device: Device;
    turn: integer;
    address: string;
    response: integer;
    alias: string;
    model: string;

function joinText(left: string; right: string): string;
begin
  return host.bytes_text(host.bytes_join(host.bytes_from_text(left), host.bytes_from_text(right)))
end;
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

function decryptBytes(encrypted: integer): integer;
var index: integer;
    key: integer;
    cipher: integer;
begin
  key := 171;
  index := 0;
  while index < host.buffer_length(encrypted) do
  begin
    cipher := host.buffer_get(encrypted, index);
    encrypted := host.buffer_set(encrypted, index, host.byte_xor(key, cipher));
    key := cipher;
    index := index + 1
  end;
  return encrypted
end;

function exchange(peerAddress: string; command: string): integer;
var encrypted: string;
    reply: integer;
begin
  encrypted := encryptBytes(host.bytes_from_text(command));
  reply := host.tcp_exchange_buffer(peerAddress, 9999, host.bytes_join(
    host.bytes_append('000000', host.bytes_length(encrypted)), encrypted), 4, 1500, 2048);
  return decryptBytes(reply)
end;

function deviceKind(text: string): string;
var family: string;
begin
  family := host.bytes_from_text(text);
  if host.bytes_length(family) < 3 then return 'unknown';
  family := host.bytes_text(host.bytes_slice(family, 0, 3));
  if (family = 'HS2') or (family = 'KS2') then return 'wallSwitch';
  if (family = 'HS1') or (family = 'KP1') or (family = 'KP4') or
     (family = 'EP1') or (family = 'EP2') or (family = 'EP4') then return 'smartPlug';
  return 'unknown'
end;

begin
  if host.event_method() = 'UDP' then
    host.raise_error('Kasa collector does not own a UDP port');
  turn := host.next_sequence();
  address := '192.168.2.28';
  if turn - (turn / 2) * 2 = 1 then address := '192.168.2.29';
  response := exchange(address, '{"system":{"get_sysinfo":{}}}');
  if host.buffer_json_path_integer(response, 'system.get_sysinfo.err_code') <> 0 then
    host.raise_error(joinText('Kasa get_sysinfo failed for ', address));
  alias := host.buffer_json_path_text(response, 'system.get_sysinfo.alias');
  if (host.bytes_length(host.bytes_from_text(alias)) < 1) or
     (host.bytes_length(host.bytes_from_text(alias)) > 32) then
    host.raise_error(joinText('Kasa alias must be 1..32 bytes for ', address));
  model := host.buffer_json_path_text(response, 'system.get_sysinfo.model');
  host.buffer_release(response);
  device.name := alias;
  device.protocol := 'kasa';
  device.address := address;
  device.deviceType := deviceKind(model);
  devices.put(joinText('kasa:', address), device, host.observation_ttl())
end.
