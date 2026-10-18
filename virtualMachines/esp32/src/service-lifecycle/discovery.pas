service 'pulse-lan-discovery-policy';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
var messageDoc: JSONDocument;
var responseDoc: JSONDocument;
var item: JSONDocument;
var candidate: JSONDocument;
var items: JSONArray;
var resultList: JSONArray;
var listeners: JSONArray;
var index: integer;
var endpoint: string;

function joinText(left: string; right: string): string;
begin
  return host.bytes_text(host.bytes_join(host.bytes_from_text(left), host.bytes_from_text(right)))
end;

function failure(message: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', false);
  responseDoc.setText('error', message);
  return responseDoc.serialize()
end;

function validText(document: JSONDocument; name: string): boolean;
begin
  if host.json_kind(document.value(name)) <> 'string' then return false;
  if document.text(name) = '' then return false;
  return host.bytes_length(host.bytes_from_text(document.text(name))) <= 128
end;

function lanAddress(address: string): boolean;
var bytes: string;
var offset: integer;
var digit: integer;
var octet: integer;
var count: integer;
var digits: integer;
begin
  bytes := host.bytes_from_text(address);
  if (host.bytes_length(bytes) < 7) or (host.bytes_length(bytes) > 15) then return false;
  offset := 0;
  octet := 0;
  count := 0;
  digits := 0;
  while offset < host.bytes_length(bytes) do
  begin
    digit := host.bytes_get(bytes, offset);
    if digit = 46 then
    begin
      if (digits = 0) or (octet > 255) then return false;
      if count = 0 then
        if (octet = 0) or (octet = 127) or (octet >= 224) then return false;
      count := count + 1;
      digits := 0;
      octet := 0
    end
    else
    begin
      if (digit < 48) or (digit > 57) then return false;
      octet := octet * 10 + digit - 48;
      digits := digits + 1;
      if digits > 3 then return false
    end;
    offset := offset + 1
  end;
  return (count = 3) and (digits > 0) and (octet <= 255)
end;

function validPort(document: JSONDocument): boolean;
begin
  if host.json_kind(document.value('port')) <> 'number' then return false;
  if host.text_index(document.value('port'), '.') >= 0 then return false;
  return (document.intValue('port') > 0) and (document.intValue('port') <= 65535)
end;

{ Hosts supply a modulo-2^30 monotonic clock so deadlines fit signed JSON integers. }
function deadlineAfter(nowMs: integer; delayMs: integer): integer;
begin
  if nowMs >= 1073741824 - delayMs then return nowMs - (1073741824 - delayMs);
  return nowMs + delayMs
end;

function beforeDeadline(nowMs: integer; deadline: integer): boolean;
begin
  if deadline >= nowMs then return (deadline - nowMs > 0) and (deadline - nowMs < 536870912);
  return nowMs - deadline > 536870912
end;

post '/settings';
begin
  return '{"ok":true,"pollMs":1000,"retryMs":5000,"jitterMs":1000,"ttlMs":30000,"maxPacketBytes":4096,"maxTargets":16,"announcementIntervalMs":10000,"clockPeriodMs":1073741824}'
end

post '/poll';
begin
  request.load(host.event_body());
  responseDoc.load('{"ok":true}');
  responseDoc.setBoolean('send', (request.intValue('nextAt') < 0) or
    not beforeDeadline(request.intValue('nowMs'), request.intValue('nextAt')));
  return responseDoc.serialize()
end

post '/interfaces';
begin
  request.load(host.event_body());
  items.load(request.value('interfaces'));
  if items.count() > 128 then return failure('Interface capacity exceeded');
  resultList.load('[]');
  index := 0;
  while index < items.count() do
  begin
    item.load(items.item(index));
    if (item.value('internal') = 'false') and lanAddress(item.text('address')) then
      resultList.append(item.serialize());
    index := index + 1
  end;
  responseDoc.load('{"ok":true}');
  responseDoc.embed('interfaces', resultList.serialize());
  return responseDoc.serialize()
end

post '/request';
begin
  request.load(host.event_body());
  if not validText(request, 'requestId') then return failure('Missing discovery requestId');
  if not validText(request, 'nodeId') then return failure('Missing discovery nodeId');
  if not validText(request, 'bootId') then return failure('Missing discovery bootId');
  if (request.intValue('jitterMs') < 0) or (request.intValue('jitterMs') > 1000) then
    return failure('Invalid discovery jitter');
  messageDoc.load('{"kind":"pulseDiscoveryRequest","version":1}');
  messageDoc.setText('requestId', request.text('requestId'));
  messageDoc.setText('nodeId', request.text('nodeId'));
  messageDoc.setText('bootId', request.text('bootId'));
  responseDoc.load('{"ok":true}');
  responseDoc.embed('packet', messageDoc.serialize());
  responseDoc.setInteger('nextAt', deadlineAfter(request.intValue('nowMs'), 5000 + request.intValue('jitterMs')));
  return responseDoc.serialize()
end

post '/respond';
begin
  request.load(host.event_body());
  messageDoc.load(request.value('packet'));
  if messageDoc.text('kind') <> 'pulseDiscoveryRequest' then return failure('Not a discovery request');
  if messageDoc.intValue('version') <> 1 then return failure('Unsupported discovery version');
  if not validText(messageDoc, 'requestId') or not validText(messageDoc, 'nodeId') or
     not validText(messageDoc, 'bootId') then return failure('Invalid discovery request identity');
  if not lanAddress(request.text('peer')) then return failure('Discovery peer must be a LAN IPv4 address');
  if not validText(request, 'aggregatorId') or not validText(request, 'bootId') then
    return failure('Missing aggregator identity');
  items.load(request.value('listeners'));
  if items.count() > 16 then return failure('Listener capacity exceeded');
  resultList.load('[]');
  index := 0;
  while index < items.count() do
  begin
    item.load(items.item(index));
    if ((item.text('protocol') = 'http') or (item.text('protocol') = 'https')) and
       lanAddress(item.text('host')) and validPort(item) then resultList.append(item.serialize());
    index := index + 1
  end;
  if resultList.count() = 0 then return failure('No reachable bound aggregator listener');
  responseDoc.load('{"kind":"pulseDiscoveryReply","version":1}');
  responseDoc.setText('requestId', messageDoc.text('requestId'));
  responseDoc.setText('aggregatorId', request.text('aggregatorId'));
  responseDoc.setText('bootId', request.text('bootId'));
  responseDoc.embed('listeners', resultList.serialize());
  messageDoc.load(responseDoc.serialize());
  responseDoc.load('{"ok":true}');
  responseDoc.embed('packet', messageDoc.serialize());
  return responseDoc.serialize()
end

post '/accept';
begin
  request.load(host.event_body());
  messageDoc.load(request.value('packet'));
  if messageDoc.text('kind') <> 'pulseDiscoveryReply' then return failure('Not a discovery reply');
  if messageDoc.intValue('version') <> 1 then return failure('Unsupported discovery version');
  if messageDoc.text('requestId') <> request.text('requestId') then return failure('Uncorrelated discovery reply');
  if not validText(messageDoc, 'aggregatorId') or not validText(messageDoc, 'bootId') then
    return failure('Invalid aggregator identity');
  if not lanAddress(request.text('peer')) or not lanAddress(request.text('localAddress')) then
    return failure('Discovery requires reachable LAN addresses');
  listeners.load(messageDoc.value('listeners'));
  if listeners.count() > 16 then return failure('Listener capacity exceeded');
  endpoint := '';
  index := 0;
  while index < listeners.count() do
  begin
    item.load(listeners.item(index));
    if (item.text('host') = request.text('peer')) and validPort(item) and
       ((item.text('protocol') = 'http') or (item.text('protocol') = 'https')) then
    begin
      if endpoint <> '' then return failure('Ambiguous aggregator listener');
      endpoint := joinText(item.text('protocol'), '://');
      endpoint := joinText(endpoint, item.text('host'));
      endpoint := joinText(endpoint, ':');
      endpoint := joinText(endpoint, item.value('port'))
    end;
    index := index + 1
  end;
  if endpoint = '' then return failure('Reply has no listener matching its source address');
  items.load(request.value('targets'));
  if items.count() > 16 then return failure('Aggregator capacity exceeded');
  resultList.load('[]');
  index := 0;
  while index < items.count() do
  begin
    item.load(items.item(index));
    if (item.text('aggregatorId') <> messageDoc.text('aggregatorId')) and
       beforeDeadline(request.intValue('nowMs'), item.intValue('expiresAt')) then resultList.append(item.serialize());
    index := index + 1
  end;
  if resultList.count() >= 16 then return failure('Aggregator capacity exceeded');
  candidate.load('{}');
  candidate.setText('aggregatorId', messageDoc.text('aggregatorId'));
  candidate.setText('bootId', messageDoc.text('bootId'));
  candidate.setText('endpoint', endpoint);
  candidate.setText('localAddress', request.text('localAddress'));
  candidate.setText('peer', request.text('peer'));
  candidate.setInteger('expiresAt', deadlineAfter(request.intValue('nowMs'), 30000));
  resultList.append(candidate.serialize());
  responseDoc.load('{"ok":true}');
  responseDoc.embed('targets', resultList.serialize());
  responseDoc.setBoolean('changed', true);
  return responseDoc.serialize()
end

post '/targets';
begin
  request.load(host.event_body());
  items.load(request.value('targets'));
  if items.count() > 16 then return failure('Aggregator capacity exceeded');
  resultList.load('[]');
  index := 0;
  while index < items.count() do
  begin
    item.load(items.item(index));
    if beforeDeadline(request.intValue('nowMs'), item.intValue('expiresAt')) then resultList.append(item.serialize());
    index := index + 1
  end;
  responseDoc.load('{"ok":true}');
  responseDoc.embed('targets', resultList.serialize());
  responseDoc.setBoolean('changed', resultList.count() <> items.count());
  return responseDoc.serialize()
end

post '/advertise';
begin
  request.load(host.event_body());
  if not validText(request, 'nodeId') then return failure('Missing node identity');
  if not lanAddress(request.text('localAddress')) then return failure('No reachable node address');
  items.load(request.value('listeners'));
  resultList.load('[]');
  endpoint := '';
  index := 0;
  while index < items.count() do
  begin
    item.load(items.item(index));
    if not validPort(item) then return failure('Invalid bound listener port');
    if (item.text('host') = '0.0.0.0') or (item.text('host') = '::') then
      item.setText('host', request.text('localAddress'));
    if item.text('host') = request.text('localAddress') then
    begin
      resultList.append(item.serialize());
      if (item.text('protocol') = 'http') or (item.text('protocol') = 'https') then
      begin
        if endpoint <> '' then return failure('Ambiguous node HTTP listener');
        endpoint := joinText(item.text('protocol'), '://');
        endpoint := joinText(endpoint, item.text('host'));
        endpoint := joinText(endpoint, ':');
        endpoint := joinText(endpoint, item.value('port'));
        responseDoc.load(item.serialize())
      end
    end;
    index := index + 1
  end;
  if endpoint = '' then return failure('No reachable bound node HTTP listener');
  messageDoc.load('{"kind":"nodeBeacon","status":"here","available":true}');
  messageDoc.setText('nodeId', request.text('nodeId'));
  messageDoc.setText('nodeName', request.text('nodeId'));
  messageDoc.setText('ip', request.text('localAddress'));
  messageDoc.setInteger('httpPort', responseDoc.intValue('port'));
  messageDoc.setInteger('port', responseDoc.intValue('port'));
  messageDoc.setText('protocol', responseDoc.text('protocol'));
  if host.json_has(request.serialize(), 'metadata') = 1 then
  begin
    item.load(request.value('metadata'));
    if host.json_has(item.serialize(), 'hardware') = 1 then messageDoc.setText('hardware', item.text('hardware'));
    if host.json_has(item.serialize(), 'runtime') = 1 then messageDoc.setText('runtime', item.text('runtime'));
    if host.json_has(item.serialize(), 'services') = 1 then messageDoc.embed('services', item.value('services'))
  end;
  responseDoc.load('{"ok":true}');
  responseDoc.embed('packet', messageDoc.serialize());
  responseDoc.setText('endpoint', endpoint);
  responseDoc.embed('listeners', resultList.serialize());
  return responseDoc.serialize()
end

post '/owner-target';
begin
  request.load(host.event_body());
  if not validText(request, 'ownerAggregatorId') then return failure('Logical work requires an explicit owner');
  items.load(request.value('targets'));
  if items.count() > 16 then return failure('Aggregator capacity exceeded');
  endpoint := '';
  index := 0;
  while index < items.count() do
  begin
    item.load(items.item(index));
    if (item.text('aggregatorId') = request.text('ownerAggregatorId')) and
       beforeDeadline(request.intValue('nowMs'), item.intValue('expiresAt')) then
    begin
      if endpoint <> '' then return failure('Ambiguous owner discovery');
      endpoint := item.text('endpoint')
    end;
    index := index + 1
  end;
  if endpoint = '' then return failure('Deployment owner is not discovered');
  responseDoc.load('{"ok":true}');
  responseDoc.setText('endpoint', endpoint);
  return responseDoc.serialize()
end
end.
