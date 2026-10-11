daemon 'pc-bluetooth-discovery' refresh 250 ms;
var batch: string;
    event: string;
    fields: string;
    endpoint: string;
    device: string;
    endpointKey: string;
    key: string;
    address: string;
    transport: string;
    kind: string;
    action: string;
    visibility: string;
    states: string;
    state: string;
    index: integer;
    stateIndex: integer;
    stateFound: integer;
    paired: integer;
    connected: integer;
    present: integer;
    observedAt: integer;
    ttl: integer;
    shouldRemove: boolean;

begin
  host.table_expire('bluetooth-endpoints');
  host.table_expire('bluetooth-devices');
  batch := host.bluetooth_read(128);
  index := 0;
  while index < host.json_array_count(batch) do
  begin
    event := host.json_array_get(batch, index);
    kind := host.json_text(event, 'kind');
    transport := host.json_text(event, 'transport');
    observedAt := host.clock();
    ttl := 120000;
    shouldRemove := false;
    if kind = 'advertisement' then
    begin
      address := host.string_upper(host.json_text(event, 'address'));
      key := 'bluetooth:ble:' + address;
      device := host.table_get('bluetooth-devices', key);
      device := host.json_set(device, 'id', key);
      device := host.json_set(device, 'address', address);
      device := host.json_set(device, 'addressType',
        host.string_lower(host.json_text(event, 'addressType')));
      if host.json_text(event, 'name') <> '' then
        device := host.json_set(device, 'name', host.json_text(event, 'name'));
      device := host.json_set(device, 'rssi', host.json_integer(event, 'rssi'));
      device := host.json_set(device, 'lastAdvertisementMs', observedAt);
      visibility := 'advertising'
    end
    else if kind = 'endpoint' then
    begin
      action := host.json_text(event, 'action');
      endpointKey := host.text_hash_utf8(host.json_text(event, 'id'));
      endpoint := host.table_get('bluetooth-endpoints', endpointKey);
      if action <> 'removed' then
      begin
        fields := host.json_value(event, 'fields');
        endpoint := host.json_merge(endpoint, fields);
        host.table_put('bluetooth-endpoints', endpointKey, endpoint, 180000)
      end;
      address := '';
      if host.json_has(endpoint, 'address') then
        address := host.string_upper(host.string_replace(
          host.string_replace(host.json_text(endpoint, 'address'), ':', 'g', ''), '-', 'g', ''));
      if address = '' then
        key := 'bluetooth:' + transport + ':endpoint:' + endpointKey
      else
        key := 'bluetooth:' + transport + ':' + address;
      device := host.table_get('bluetooth-devices', key);
      device := host.json_set(device, 'id', key);
      device := host.json_set(device, 'address', address);
      states := '[]';
      if host.json_has(device, 'endpointStates') then
        states := host.json_value(device, 'endpointStates');
      stateIndex := 0;
      stateFound := -1;
      while stateIndex < host.json_array_count(states) do
      begin
        if host.json_text(host.json_array_get(states, stateIndex), 'endpointId') = endpointKey then
          stateFound := stateIndex;
        stateIndex := stateIndex + 1
      end;
      if action = 'removed' then
      begin
        host.table_remove('bluetooth-endpoints', endpointKey);
        if stateFound >= 0 then states := host.json_array_remove(states, stateFound);
        shouldRemove := true
      end
      else
      begin
        endpoint := host.json_set(endpoint, 'endpointId', endpointKey);
        if stateFound >= 0 then
          states := host.json_array_set(states, stateFound, endpoint)
        else
          states := host.json_array_append(states, endpoint);
        if host.json_has(endpoint, 'name') then
          if host.json_text(endpoint, 'name') <> '' then
            device := host.json_set(device, 'name', host.json_text(endpoint, 'name'));
        ttl := 180000
      end;
      device := host.json_embed(device, 'endpointStates', states);
      paired := 0;
      connected := 0;
      present := 0;
      stateIndex := 0;
      while stateIndex < host.json_array_count(states) do
      begin
        state := host.json_array_get(states, stateIndex);
        if host.json_has(state, 'paired') then
          if host.json_integer(state, 'paired') = 1 then paired := 1;
        if host.json_has(state, 'connected') then
          if host.json_integer(state, 'connected') = 1 then connected := 1;
        if host.json_has(state, 'present') then
          if host.json_integer(state, 'present') = 1 then present := 1;
        stateIndex := stateIndex + 1
      end;
      if host.json_array_count(states) > 0 then
      begin
        ttl := 180000;
        shouldRemove := false
      end;
      device := host.json_set(device, 'paired', paired);
      device := host.json_set(device, 'connected', connected);
      device := host.json_set(device, 'present', present);
      visibility := 'known';
      if host.json_has(device, 'present') then
        if host.json_integer(device, 'present') = 1 then visibility := 'os-present';
      if host.json_has(device, 'connected') then
        if host.json_integer(device, 'connected') = 1 then visibility := 'connected';
      if host.json_has(device, 'lastAdvertisementMs') then
        if observedAt - host.json_integer(device, 'lastAdvertisementMs') < 120000 then
        begin
          visibility := 'advertising';
          shouldRemove := false;
          if (action = 'removed') and (host.json_array_count(states) = 0) then
            ttl := 120000 - (observedAt - host.json_integer(device, 'lastAdvertisementMs'))
        end
    end
    else
      host.raise_error('Unexpected Bluetooth discovery event');
    if not host.json_has(device, 'name') then
      device := host.json_set(device, 'name', 'Unnamed Bluetooth device');
    device := host.json_set(device, 'protocol', 'bluetooth');
    device := host.json_set(device, 'transport', transport);
    device := host.json_set(device, 'visibility', visibility);
    device := host.json_set(device, 'lastUpdatedMs', observedAt);
    if shouldRemove then host.table_remove('bluetooth-devices', key)
    else host.table_put('bluetooth-devices', key, device, ttl);
    index := index + 1
  end
end.
