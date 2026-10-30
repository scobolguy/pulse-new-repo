service 'CobolRuntimeInventory';

function inventoryError(status: integer; message: string): string;
begin
  return host.json_set(host.json_set('{}', 'status', status), 'error', message)
end;

function inventoryNumber(value: integer): string;
begin
  return host.json_value(host.json_set('{}', 'n', value), 'n')
end;

function inventoryKey(value: string): integer;
var bytes: string;
    index: integer;
    ch: integer;
begin
  bytes := host.bytes_from_text(value);
  if (host.bytes_length(bytes) < 1) or (host.bytes_length(bytes) > 16) then return 0;
  for index := 0 to host.bytes_length(bytes) - 1 do
  begin
    ch := host.bytes_get(bytes, index);
    if not (((ch >= 65) and (ch <= 90)) or
      ((index > 0) and (((ch >= 48) and (ch <= 57)) or (ch = 45) or (ch = 95)))) then return 0
  end;
  return 1
end;

function inventoryExchange(address: string; port: integer; query: string): string;
var bytes: string;
    length: integer;
    buffer: integer;
    response: string;
begin
  bytes := host.bytes_from_text(query);
  length := host.bytes_length(bytes);
  buffer := host.tcp_exchange_buffer(address, port,
    host.bytes_join(host.bytes_append(host.bytes_append('0000', length / 256),
      length - (length / 256) * 256), bytes), 4, 1500, 1024);
  response := host.buffer_text(buffer);
  return response
end;

function COBOL_RT_INVENTORY(recordText: string; address: string; port: integer): string;
var bytes: string;
    wordBytes: string;
    words: string;
    wordText: string;
    operation: string;
    item: string;
    reservation: string;
    amount: string;
    canonical: string;
    query: string;
    response: string;
    snapshot: string;
    reply: string;
    sku: string;
    index: integer;
    ch: integer;
    count: integer;
    quantity: integer;
    available: integer;
    total: integer;
    savedQuantity: integer;
    released: integer;
    writeRow: integer;
begin
  bytes := host.bytes_from_text(recordText);
  if host.bytes_length(bytes) > 128 then
    return inventoryError(400, 'Inventory command exceeds 128 bytes');
  words := '{}';
  count := 0;
  wordBytes := '';
  for index := 0 to host.bytes_length(bytes) do
  begin
    ch := 32;
    if index < host.bytes_length(bytes) then ch := host.bytes_get(bytes, index);
    if (ch < 32) or (ch > 126) then
      return inventoryError(400, 'Inventory command must be printable ASCII');
    if ch = 32 then
    begin
      if host.bytes_length(wordBytes) > 0 then
      begin
        wordText := host.bytes_text(wordBytes);
        words := host.json_set(words, inventoryNumber(count), wordText);
        count := count + 1;
        wordBytes := ''
      end
    end
    else
    begin
      if (ch >= 97) and (ch <= 122) then ch := ch - 32;
      wordBytes := host.bytes_append(wordBytes, ch)
    end
  end;
  if (count <> 2) and (count <> 4) then
    return inventoryError(400, 'Use INQUIRE sku, RESERVE sku quantity reservation-id, or RELEASE reservation-id');
  operation := host.json_text(words, '0');
  item := host.json_text(words, '1');
  if inventoryKey(item) = 0 then return inventoryError(400, 'Invalid inventory identifier');
  reservation := '';
  quantity := 0;
  canonical := host.json_set('{}', 'operation', operation);
  if (operation = 'RELEASE') and (count = 2) then
  begin
    reservation := item;
    item := '';
    canonical := host.json_set(canonical, 'reservation', reservation)
  end
  else if (operation = 'INQUIRE') and (count = 2) then
    canonical := host.json_set(canonical, 'item', item)
  else if (operation = 'RESERVE') and (count = 4) then
  begin
    amount := host.json_text(words, '2');
    reservation := host.json_text(words, '3');
    bytes := host.bytes_from_text(amount);
    if (host.bytes_length(bytes) < 1) or (host.bytes_length(bytes) > 6) or
      (inventoryKey(reservation) = 0) then return inventoryError(400, 'Invalid reservation or quantity');
    for index := 0 to host.bytes_length(bytes) - 1 do
    begin
      ch := host.bytes_get(bytes, index);
      if (ch < 48) or (ch > 57) or ((index = 0) and (ch = 48)) then
        return inventoryError(400, 'Quantity must be 1..999999 without leading zeros');
      quantity := quantity * 10 + ch - 48
    end;
    canonical := host.json_set(host.json_set(host.json_set(canonical,
      'item', item), 'quantity', quantity), 'reservation', reservation)
  end
  else return inventoryError(400, 'Unknown inventory command or argument count');
  query := host.json_set(host.json_set(host.json_set(host.json_set(host.json_set(
    '{"action":"read"}', 'canonical', canonical), 'item', item), 'reservation', reservation),
    'requestId', host.json_text(host.event_body(), 'requestId')),
    'inventoryToken', host.json_text(host.event_body(), 'inventoryToken'));
  response := inventoryExchange(address, port, query);
  if host.json_integer(response, 'status') <> 200 then return response;
  if host.json_has(response, 'reply') <> 0 then return response;
  snapshot := host.json_text(response, 'snapshot');
  sku := host.json_text(snapshot, 'sku');
  available := host.json_integer(snapshot, 'available');
  total := host.json_integer(snapshot, 'total');
  savedQuantity := host.json_integer(snapshot, 'quantity');
  released := host.json_integer(snapshot, 'released');
  writeRow := 0;
  if operation = 'RELEASE' then
  begin
    if host.json_text(snapshot, 'reservationSku') = '' then
      reply := 'NOT FOUND reservation ' + reservation
    else if released = 1 then reply := 'ALREADY RELEASED ' + reservation
    else
    begin
      available := available + savedQuantity;
      released := 1;
      writeRow := 1;
      reply := 'RELEASED ' + reservation + ' ' + sku + ' AVAILABLE ' + inventoryNumber(available)
    end
  end
  else if sku = '' then reply := 'NOT FOUND sku ' + item
  else if operation = 'INQUIRE' then
    reply := item + ' AVAILABLE ' + inventoryNumber(available) + ' RESERVED ' + inventoryNumber(total - available)
  else if host.json_text(snapshot, 'reservationSku') <> '' then
    reply := 'CONFLICT reservation ' + reservation + ' already exists'
  else if available < quantity then reply := 'INSUFFICIENT ' + item + ' AVAILABLE ' + inventoryNumber(available)
  else
  begin
    available := available - quantity;
    savedQuantity := quantity;
    released := 0;
    writeRow := 1;
    reply := 'RESERVED ' + reservation + ' ' + item + ' QTY ' + inventoryNumber(quantity) +
      ' AVAILABLE ' + inventoryNumber(available)
  end;
  query := host.json_set(host.json_set(host.json_set(host.json_set(host.json_set(host.json_set(
    host.json_set(query, 'action', 'commit'), 'snapshot', snapshot), 'available', available),
    'quantity', savedQuantity), 'released', released), 'writeRow', writeRow), 'reply', reply);
  return inventoryExchange(address, port, query)
end;

post '/library';
begin
  return ''
end
end.
