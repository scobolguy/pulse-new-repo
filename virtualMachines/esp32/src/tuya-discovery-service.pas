service 'tuya-discovery';

function shortLength(packet: string; offset: integer): integer;
begin
  if host.bytes_slice(packet, offset, 2) <> '0000' then return -1;
  return host.bytes_get(packet, offset + 2) * 256 + host.bytes_get(packet, offset + 3)
end;

function rejectPacket(): string;
begin
  host.http_status(400);
  return '{"error":"Invalid or unsupported Tuya discovery frame"}'
end;

function observe(): string;
var packet: string;
    plain: string;
    key: string;
    size: integer;
    offset: integer;
    deviceId: string;
    nameBytes: string;
    device: string;
begin
  packet := host.event_bytes();
  size := host.bytes_length(packet);
  if (size < 28) or (size > 1024) then return rejectPacket();
  key := '6c1ec8e2bb9bb59ab50b0daf649b410a';
  if host.bytes_slice(packet, 0, 4) = '000055aa' then
  begin
    if shortLength(packet, 12) <> size - 16 then return rejectPacket();
    if host.bytes_slice(packet, size - 4, 4) <> '0000aa55' then return rejectPacket();
    if host.bytes_slice(packet, 8, 4) <> '00000013' then return rejectPacket();
    if host.bytes_crc32(host.bytes_slice(packet, 0, size - 8)) <>
       host.bytes_slice(packet, size - 8, 4) then return rejectPacket();
    offset := 16;
    if host.bytes_slice(packet, 16, 4) = '00000000' then offset := 20;
    plain := host.bytes_aes_ecb_decrypt(
      host.bytes_slice(packet, offset, size - offset - 8), key)
  end
  else if host.bytes_slice(packet, 0, 4) = '00006699' then
  begin
    if size < 54 then return rejectPacket();
    if shortLength(packet, 14) <> size - 22 then return rejectPacket();
    if host.bytes_slice(packet, size - 4, 4) <> '00009966' then return rejectPacket();
    if host.bytes_slice(packet, 10, 4) <> '00000013' then return rejectPacket();
    plain := host.bytes_aes_gcm_decrypt(
      host.bytes_slice(packet, 30, size - 50), key,
      host.bytes_slice(packet, 18, 12), host.bytes_slice(packet, 4, 14),
      host.bytes_slice(packet, size - 20, 16));
    if host.bytes_length(plain) < 4 then return rejectPacket();
    if host.bytes_slice(plain, 0, 4) <> '00000000' then return rejectPacket();
    plain := host.bytes_slice(plain, 4, host.bytes_length(plain) - 4)
  end
  else return rejectPacket();
  plain := host.bytes_text(plain);
  deviceId := host.json_text(plain, 'gwId');
  nameBytes := host.bytes_from_text(deviceId);
  size := host.bytes_length(nameBytes);
  if (size < 6) or (size > 64) then return rejectPacket();
  device := host.json_set('{}', 'deviceId', deviceId);
  device := host.json_set(device, 'deviceName',
    host.bytes_text(host.bytes_join('5475796120', host.bytes_slice(nameBytes, size - 6, 6))));
  device := host.json_set(device, 'ipAddress', host.event_peer());
  device := host.json_set(device, 'deviceType', 'unknown');
  host.table_put('devices', deviceId, device, host.observation_ttl());
  return '{"status":"observed"}'
end;

get '/api/tuya/devices';
begin
  host.table_expire('devices');
  return host.table_snapshot_values('devices', host.event_query('cursor'), 2)
end

post '/events/udp';
begin
  return observe()
end
end.
