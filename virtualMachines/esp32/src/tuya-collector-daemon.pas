daemon 'tuya-collector' refresh 60000 ms
{ Passive Tuya collector: the host delivers each datagram from its owned UDP port (6667) as a
  serialized "UDP" event (bounded size; shed under low heap). Timer turns are no-ops.
  Invalid frames are surfaced with host.raise_error. }
type Device = record name: string; protocol: string; address: string; deviceType: string; end;
var devices: cache of Device;
    device: Device;
    packet: string;
    plain: string;
    key: string;
    size: integer;
    offset: integer;
    deviceId: string;
    idBytes: string;

function joinText(left: string; right: string): string;
begin
  return host.bytes_text(host.bytes_join(host.bytes_from_text(left), host.bytes_from_text(right)))
end;
function shortLength(frame: string; at: integer): integer;
begin
  if host.bytes_slice(frame, at, 2) <> '0000' then return -1;
  return host.bytes_get(frame, at + 2) * 256 + host.bytes_get(frame, at + 3)
end;

function reject(): integer;
begin
  return host.raise_error('Invalid or unsupported Tuya discovery frame')
end;

begin
  if host.event_method() = 'UDP' then
  begin
    packet := host.event_bytes();
    size := host.bytes_length(packet);
    if (size < 28) or (size > 1024) then reject();
    key := '6c1ec8e2bb9bb59ab50b0daf649b410a';
    if host.bytes_slice(packet, 0, 4) = '000055aa' then
    begin
      if shortLength(packet, 12) <> size - 16 then reject();
      if host.bytes_slice(packet, size - 4, 4) <> '0000aa55' then reject();
      if host.bytes_slice(packet, 8, 4) <> '00000013' then reject();
      if host.bytes_crc32(host.bytes_slice(packet, 0, size - 8)) <>
         host.bytes_slice(packet, size - 8, 4) then reject();
      offset := 16;
      if host.bytes_slice(packet, 16, 4) = '00000000' then offset := 20;
      plain := host.bytes_aes_ecb_decrypt(
        host.bytes_slice(packet, offset, size - offset - 8), key)
    end
    else if host.bytes_slice(packet, 0, 4) = '00006699' then
    begin
      if size < 54 then reject();
      if shortLength(packet, 14) <> size - 22 then reject();
      if host.bytes_slice(packet, size - 4, 4) <> '00009966' then reject();
      if host.bytes_slice(packet, 10, 4) <> '00000013' then reject();
      plain := host.bytes_aes_gcm_decrypt(
        host.bytes_slice(packet, 30, size - 50), key,
        host.bytes_slice(packet, 18, 12), host.bytes_slice(packet, 4, 14),
        host.bytes_slice(packet, size - 20, 16));
      if host.bytes_length(plain) < 4 then reject();
      if host.bytes_slice(plain, 0, 4) <> '00000000' then reject();
      plain := host.bytes_slice(plain, 4, host.bytes_length(plain) - 4)
    end
    else reject();
    deviceId := host.json_text(host.bytes_text(plain), 'gwId');
    idBytes := host.bytes_from_text(deviceId);
    size := host.bytes_length(idBytes);
    if (size < 6) or (size > 64) then reject();
    device.name := host.bytes_text(host.bytes_join('5475796120', host.bytes_slice(idBytes, size - 6, 6)));
    device.protocol := 'tuya';
    device.address := host.event_peer();
    device.deviceType := 'unknown';
    devices.put(joinText('tuya:', deviceId), device, host.observation_ttl())
  end
end.
