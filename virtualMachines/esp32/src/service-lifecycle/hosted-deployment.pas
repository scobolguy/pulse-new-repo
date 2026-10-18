service 'pulse-hosted-deployment-policy';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    mapDoc: JSONDocument;
    intent: JSONDocument;
    bindings: JSONDocument;
    responseDoc: JSONDocument;
    lifecycle: JSONDocument;
    serviceReqs: JSONArray;
    compiledRequires: JSONArray;
    index: integer;
    serviceId: string;
    requiredId: string;
    ownerId: string;
    callerOwnerId: string;
    deployAction: boolean;
    otherIndex: integer;

function failure(message: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', false);
  responseDoc.setText('error', message);
  return responseDoc.serialize()
end;

function contains(values: JSONArray; value: string): boolean;
var itemIndex: integer;
begin
  itemIndex := 0;
  while itemIndex < values.count() do
  begin
    if host.json_to_text(values.item(itemIndex)) = value then return true;
    itemIndex := itemIndex + 1
  end;
  return false
end;

post '/validate';
begin
  request.load(host.event_body());
  mapDoc.load(request.value('compiledProgramMap'));
  intent.load(request.value('intent'));
  serviceId := intent.text('serviceId');
  if (serviceId = '') or (mapDoc.text('serviceId') <> serviceId) then
    return failure('Hosted deployment service id does not match the compiled program');

  ownerId := intent.text('ownerAggregatorId');
  callerOwnerId := intent.text('callerOwnerAggregatorId');
  if ownerId = '' then return failure('Hosted deployment owner is required');
  if (request.value('installAction') = 'true') and (callerOwnerId <> ownerId) then
    return failure('HOSTED SERVICE install requires its explicitly configured owner aggregator: ' + ownerId);

  if (host.json_kind(intent.value('serviceLifecycle')) <> 'object') or
     (intent.intValue('lifecycleVersion') <> 1) then
    return failure('Hosted deployment lifecycle intent must use version 1');
  if host.json_kind(intent.value('bindings')) <> 'object' then
    return failure('Hosted deployment bindings must be an object');
  if host.json_kind(intent.value('requires')) <> 'array' then
    return failure('Hosted deployment requirements must be an array');
  if (host.json_has(mapDoc.serialize(), 'serviceLifecycle') <> 0) and
     (host.json_kind(mapDoc.value('serviceLifecycle')) <> 'object') then
    return failure('Compiled serviceLifecycle declaration must be an object');
  if host.json_has(mapDoc.serialize(), 'serviceLifecycle') <> 0 then
  begin
    lifecycle.load(mapDoc.value('serviceLifecycle'));
    if lifecycle.intValue('version') <> 1 then
      return failure('Compiled serviceLifecycle declaration must use version 1');
    if host.json_kind(lifecycle.value('requires')) <> 'array' then
      return failure('Compiled serviceLifecycle requires must be an array')
  end
  else lifecycle.load('{"version":1,"requires":[]}');

  serviceReqs.load(intent.value('requires'));
  compiledRequires.load(lifecycle.value('requires'));
  bindings.load(intent.value('bindings'));
  if (serviceReqs.count() > 32) or (compiledRequires.count() > 32) then
    return failure('Hosted deployment requirement capacity exceeded');

  index := 0;
  while index < serviceReqs.count() do
  begin
    requiredId := host.json_to_text(serviceReqs.item(index));
    if (requiredId = '') or (host.json_has(bindings.serialize(), requiredId) = 0) then
      return failure('Every declared hosted requirement must have an explicit binding');
    if index > 0 then
    begin
      otherIndex := 0;
      while otherIndex < index do
      begin
        if host.json_to_text(serviceReqs.item(otherIndex)) = requiredId then
          return failure('Hosted deployment requirements must be unique');
        otherIndex := otherIndex + 1
      end
    end;
    index := index + 1
  end;
  if host.json_node_object_count(host.json_parse_value(bindings.serialize()), 0) <> serviceReqs.count() then
    return failure('Hosted deployment bindings must exactly match its requirements');

  index := 0;
  while index < compiledRequires.count() do
  begin
    requiredId := host.json_to_text(compiledRequires.item(index));
    if (requiredId = '') or not contains(serviceReqs, requiredId) then
      return failure('Hosted deployment omits compiled service requirements: ' + requiredId);
    if host.json_has(bindings.serialize(), requiredId) = 0 then
      return failure('Hosted deployment omits the compiled requirement binding: ' + requiredId);
    index := index + 1
  end;

  lifecycle.load(intent.value('serviceLifecycle'));
  lifecycle.embed('compiledRequires', compiledRequires.serialize());
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.embed('intent', lifecycle.serialize());
  return responseDoc.serialize()
end
end.
