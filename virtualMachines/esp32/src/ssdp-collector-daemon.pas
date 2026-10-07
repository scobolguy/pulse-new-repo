daemon 'ssdp-collector' refresh 60000 ms
{ Passive NOTIFY only. No search, description fetch, or friendly-name inference here.
  The JS deployment may enqueue bounded description reads after accepted events;
  names are an aggregation display overlay, not new cache observations or votes.
  Canonical UUID keys deduplicate all advertised service variants.
  max-age is clamped to 180 seconds before millisecond conversion. }
type Device = record name: string; protocol: string; address: string; deviceType: string; end;
var devices: cache of Device;
    device: Device;
    packet: string;
    usn: string;
    uuid: string;
    nts: string;
    nt: string;
    cacheControl: string;
    bytes: string;
    key: string;
    size: integer;
    index: integer;
    digit: integer;
    age: integer;
    offset: integer;
    scanning: integer;

function joinText(left: string; right: string): string;
begin
  return host.bytes_text(host.bytes_join(host.bytes_from_text(left), host.bytes_from_text(right)))
end;

function reject(): integer;
begin
  return host.raise_error('Invalid SSDP notification')
end;

begin
  if host.event_method() = 'UDP' then
  begin
    packet := host.event_body();
    if host.text_header(packet, '') <> 'NOTIFY * HTTP/1.1' then reject();
    if host.text_lower(host.text_header(packet, 'HOST')) <> '239.255.255.250:1900' then reject();
    nts := host.text_lower(host.text_header(packet, 'NTS'));
    if (nts <> 'ssdp:alive') and (nts <> 'ssdp:update') and (nts <> 'ssdp:byebye') then reject();
    nt := host.text_lower(host.text_header(packet, 'NT'));
    if nt = '' then reject();
    usn := host.text_lower(host.text_header(packet, 'USN'));
    size := host.bytes_length(host.bytes_from_text(usn));
    if size < 41 then reject();
    if host.text_slice(usn, 0, 5) <> 'uuid:' then reject();
    if size > 41 then
    begin
      if size < 44 then reject();
      if host.text_slice(usn, 41, 2) <> '::' then reject();
      if host.text_slice(usn, 43, size - 43) <> nt then reject()
    end
    else if nt <> usn then reject();
    uuid := host.text_slice(usn, 5, 36);
    bytes := host.bytes_from_text(uuid);
    index := 0;
    while index < 36 do
    begin
      digit := host.bytes_get(bytes, index);
      if (index = 8) or (index = 13) or (index = 18) or (index = 23) then
      begin
        if digit <> 45 then reject()
      end
      else if ((digit < 48) or (digit > 57)) and ((digit < 97) or (digit > 102)) then reject();
      index := index + 1
    end;
    key := joinText('ssdp:', uuid);
    if nts = 'ssdp:byebye' then devices.remove(key)
    else
    begin
      cacheControl := host.text_lower(host.text_header(packet, 'CACHE-CONTROL'));
      offset := host.text_index(cacheControl, 'max-age=');
      if offset < 0 then reject();
      if offset > 0 then
      begin
        digit := host.bytes_get(host.bytes_from_text(cacheControl), offset - 1);
        if (digit <> 32) and (digit <> 44) then reject()
      end;
      bytes := host.bytes_from_text(cacheControl);
      size := host.bytes_length(bytes);
      index := offset + 8;
      age := 0;
      offset := index;
      scanning := 1;
      while (index < size) and (scanning = 1) do
      begin
        digit := host.bytes_get(bytes, index);
        if (digit < 48) or (digit > 57) then scanning := 0
        else
        begin
          if age < 180 then age := age * 10 + digit - 48;
          if age > 180 then age := 180;
          index := index + 1
        end
      end;
      if (index = offset) or (age = 0) then reject();
      scanning := 1;
      while (index < size) and (scanning = 1) do
      begin
        digit := host.bytes_get(bytes, index);
        if digit <> 32 then scanning := 0
        else index := index + 1
      end;
      if index < size then
        if host.bytes_get(bytes, index) <> 44 then reject();
      if host.text_index(host.text_slice(cacheControl, index, size - index), 'max-age=') >= 0 then reject();
      device.name := joinText('SSDP ', uuid);
      device.protocol := 'ssdp';
      device.address := host.event_peer();
      device.deviceType := 'unknown';
      devices.put(key, device, age * 1000)
    end
  end
end.
