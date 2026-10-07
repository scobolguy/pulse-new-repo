program 'esp8266-sensor-node';
var
  raw, stable, previous, stamp: integer;
begin
  raw := device.gpio_read(14);
  if device.state_get('initialized') = 0 then
  begin
    device.state_set('initialized', 1);
    device.state_set('raw', raw);
    device.state_set('stable', raw);
    device.state_set('changed', device.clock());
    device.state_set('sampled', device.clock());
    writeln('DHT11 sensor node ready');
  end;

  previous := device.state_get('raw');
  if raw <> previous then
  begin
    device.state_set('raw', raw);
    device.state_set('changed', device.clock());
  end;
  stamp := device.state_get('changed');
  stable := device.state_get('stable');
  if (device.elapsed(stamp) >= 50) and (raw <> stable) then
  begin
    device.state_set('stable', raw);
    if raw = 0 then writeln('Button pressed');
  end;

  stamp := device.state_get('sampled');
  if device.elapsed(stamp) >= 5000 then
  begin
    device.state_set('sampled', device.clock());
    if device.dht_read(4) then
      writeln('DHT11 temperature=', device.dht_temperature(),
              ' C humidity=', device.dht_humidity(), ' %')
    else
      writeln('DHT11 read failed');
  end;
end.
