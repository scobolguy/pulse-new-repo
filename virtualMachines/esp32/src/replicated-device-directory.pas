type DirectoryDevice = record
  name: string;
  protocol: string;
  address: string;
end;

distributed table DeviceDirectory: map<string, DirectoryDevice>;

service 'replicated-device-directory';
var devices: cache<string, DirectoryDevice> backed by DeviceDirectory;
    device: DirectoryDevice;

get '/directory/device';
begin
  device := devices.get(host.event_query('key'));
  return host.json_set(host.json_set(host.json_set('{}',
    'name', device.name), 'protocol', device.protocol), 'address', device.address)
end

post '/directory/device';
begin
  device.name := host.json_text(host.event_body(), 'name');
  device.protocol := host.json_text(host.event_body(), 'protocol');
  device.address := host.json_text(host.event_body(), 'address');
  devices.put(host.event_query('key'), device);
  return '{"saved":true}'
end

delete '/directory/device';
begin
  devices.remove(host.event_query('key'));
  return '{"removed":true}'
end

get '/directory/contains';
begin
  return devices.contains(host.event_query('key'))
end

get '/directory/count';
begin
  return devices.count()
end

post '/directory/clear-local';
begin
  return devices.clearLocal()
end
end.
