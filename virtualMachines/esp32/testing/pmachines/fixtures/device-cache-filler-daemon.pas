daemon 'device-cache-filler' refresh 20 ms
{ Test fixture: fills a device cache past its 50-entry capacity with distinct ~45-byte names.
  Stops writing after 75 puts so a paged client walk sees a stable cache.
  Installed only in a temporary probe context, never in the real shared-devices context. }
type Device = record name: string; protocol: string; address: string; deviceType: string; end;
var devices: cache of Device;
    device: Device;
    index: integer;
begin
  index := host.next_sequence();
  if index <= 75 then
  begin
    device.name := host.json_set('{"pad":"Device name padded to 32 bytes"}', 'i', index);
    device.protocol := 'test';
    device.address := '10.0.0.1';
    device.deviceType := 'unknown';
    devices.put(host.json_set('{}', 'k', index), device, host.observation_ttl())
  end
end.