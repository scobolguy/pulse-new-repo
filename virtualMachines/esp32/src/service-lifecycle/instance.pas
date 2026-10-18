service 'pulse-service-instance-policy';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    depsDoc: JSONDocument;
    availabilityDoc: JSONDocument;
    depBinding: JSONDocument;
    observation: JSONDocument;
    readiness: JSONDocument;
    report: JSONDocument;
    listenerDoc: JSONDocument;
    resultDoc: JSONDocument;
    blocked: JSONDocument;
    blockers: JSONArray;
    required: JSONArray;
    listenerList: JSONArray;
    index: integer;
    bindingIndex: integer;
    observationIndex: integer;
    readinessIndex: integer;
    handle: integer;
    serviceId: string;
    instanceId: string;
    reason: string;
    ready: boolean;
    routePath: string;

function failure(message: string): string;
begin
  resultDoc.load('{}');
  resultDoc.setBoolean('ok', false);
  resultDoc.setText('error', message);
  return resultDoc.serialize()
end;

function validText(document: JSONDocument; name: string): integer;
begin
  if host.json_kind(document.value(name)) <> 'string' then return 0;
  if document.text(name) = '' then return 0;
  return 1
end;

function optionalText(document: JSONDocument; name: string): string;
begin
  if host.json_has(document.serialize(), name) = 0 then return '';
  if host.json_kind(document.value(name)) <> 'string' then return '';
  return document.text(name)
end;

function probeReady(raw: string): boolean;
var probe: JSONDocument;
    bodyDoc: JSONDocument;
begin
  if host.json_kind(raw) <> 'object' then return false;
  probe.load(raw);
  if host.json_has(raw, 'status') = 0 then return probe.value('ready') = 'true';
  if (probe.intValue('status') < 200) or (probe.intValue('status') >= 300) then return false;
  if host.json_kind(probe.value('body')) <> 'object' then return false;
  bodyDoc.load(probe.value('body'));
  return bodyDoc.value('ready') = 'true'
end;

post '/transport-policy';
begin
  return '{"ok":true,"probeIntervalMs":3000,"reportIntervalMs":10000,"timeoutMs":1500,"reportAttempts":2,"retryDelayMs":250,"maxResponseBytes":65536,"transactionTimeoutMs":30000,"transactionPollMs":250}'
end

post '/transaction-action';
begin
  request.load(host.event_body());
  observation.load(request.value('transaction'));
  resultDoc.load('{}');
  resultDoc.setBoolean('ok', true);
  if observation.text('status') = 'completed' then resultDoc.setText('action', 'return')
  else if observation.text('status') = 'uncertain' then resultDoc.setText('action', 'fail')
  else if request.intValue('elapsedMs') >= 30000 then resultDoc.setText('action', 'timeout')
  else if (observation.text('status') = 'held') or (observation.text('status') = 'allocated') or
          (observation.text('status') = 'waiting-child') then
    resultDoc.setText('action', 'poll')
  else resultDoc.setText('action', 'fail');
  return resultDoc.serialize()
end

post '/gate';
begin
  request.load(host.event_body());
  routePath := request.text('path');
  ready := true;
  if (routePath <> '/health') and (routePath <> '/ready') and
     (host.string_index(routePath, '/api/runtime/instances/') <> 0) and
     (host.string_index(routePath, '/pmachine/') <> 0) then
  begin
    readiness.load(request.value('readiness'));
    ready := readiness.value('ready') = 'true'
  end;
  resultDoc.load('{}');
  resultDoc.setBoolean('ok', true);
  resultDoc.setBoolean('allowed', ready);
  if ready then resultDoc.setInteger('status', 200)
  else resultDoc.setInteger('status', 503);
  return resultDoc.serialize()
end

post '/evaluate';
begin
  request.load(host.event_body());
  if request.intValue('version') <> 1 then return failure('Unsupported lifecycle version');
  if (validText(request, 'serviceId') = 0) then return failure('Missing serviceId');
  if host.json_kind(request.value('requires')) <> 'array' then
    return failure('requires must be an array');
  if host.json_kind(request.value('bindings')) <> 'object' then
    return failure('bindings must be an object');
  if host.json_kind(request.value('observations')) <> 'object' then
    return failure('observations must be an object');

  required.load(request.value('requires'));
  if required.count() > 32 then return failure('Dependency capacity exceeded');
  depsDoc.load(request.value('bindings'));
  availabilityDoc.load(request.value('observations'));
  blockers.load('[]');
  index := 0;
  while index < required.count() do
  begin
    serviceId := host.json_to_text(required.item(index));
    if (host.json_kind(required.item(index)) <> 'string') or (serviceId = '') then
      return failure('Dependency id must be nonempty text');
    bindingIndex := host.json_node_member(host.json_parse_value(depsDoc.serialize()), 0, serviceId);
    observationIndex := host.json_node_member(host.json_parse_value(availabilityDoc.serialize()), 0, serviceId);
    instanceId := '';
    reason := '';
    ready := false;
    if bindingIndex < 0 then reason := 'missing-binding'
    else
    begin
      if host.json_kind(depsDoc.value(serviceId)) <> 'object' then
        return failure('Each dependency binding must be an object');
      depBinding.load(depsDoc.value(serviceId));
      instanceId := optionalText(depBinding, 'instanceId');
      if (instanceId = '') or (optionalText(depBinding, 'endpoint') = '') or
         (optionalText(depBinding, 'readinessUrl') = '') then reason := 'invalid-binding'
      else if observationIndex < 0 then reason := 'not-ready'
      else
      begin
        if host.json_kind(availabilityDoc.value(serviceId)) <> 'object' then
          return failure('Each observation must be an object');
        observation.load(availabilityDoc.value(serviceId));
        if probeReady(observation.serialize()) then
        begin
          if (optionalText(observation, 'instanceId') <> '') and
             (optionalText(observation, 'instanceId') <> instanceId) and
             (host.string_index(instanceId, 'external:') <> 0) then reason := 'instance-mismatch'
          else if host.json_has(observation.serialize(), 'usefulStatus') = 1 then
          begin
            if (observation.intValue('usefulStatus') >= 200) and
               (observation.intValue('usefulStatus') < 300) then ready := true
            else reason := 'useful-operation-failed'
          end
          else ready := true
        end
        else
        begin
          reason := optionalText(observation, 'reason');
          if reason = '' then reason := 'not-ready';
          if optionalText(observation, 'instanceId') <> '' then instanceId := optionalText(observation, 'instanceId')
        end
      end
    end;
    if not ready then
    begin
      if reason = '' then reason := 'not-ready';
      blocked.load('{}');
      blocked.setText('serviceId', serviceId);
      blocked.setText('instanceId', instanceId);
      blocked.setText('reason', reason);
      blockers.append(blocked.serialize())
    end;
    index := index + 1
  end;
  if host.json_has(request.serialize(), 'localObservation') = 1 then
  begin
    observation.load(request.value('localObservation'));
    if (observation.intValue('status') < 200) or (observation.intValue('status') >= 300) then
    begin
      blocked.load('{}');
      blocked.setText('serviceId', request.text('serviceId'));
      blocked.setText('instanceId', request.text('instanceId'));
      blocked.setText('reason', 'local-operation-failed');
      blockers.append(blocked.serialize())
    end
  end;
  readiness.load('{}');
  readiness.setBoolean('ready', blockers.count() = 0);
  readiness.embed('blockedBy', blockers.serialize());
  resultDoc.load('{}');
  resultDoc.setBoolean('ok', true);
  resultDoc.embed('readiness', readiness.serialize());
  return resultDoc.serialize()
end

post '/report';
begin
  request.load(host.event_body());
  if request.intValue('version') <> 1 then return failure('Unsupported lifecycle version');
  if (validText(request, 'serviceId') = 0) or
     (validText(request, 'instanceId') = 0) or
     (validText(request, 'nodeId') = 0) or
     (validText(request, 'bootId') = 0) or
     (validText(request, 'ownerAggregatorId') = 0) or
     (validText(request, 'endpoint') = 0) then
    return failure('Missing required report identity or endpoint');
  if (host.json_kind(request.value('sequence')) <> 'number') or (request.intValue('sequence') < 1) then
    return failure('sequence must be positive');
  if (host.json_kind(request.value('ttlMs')) <> 'number') or (request.intValue('ttlMs') <> 30000) then
    return failure('ttlMs must be 30000');
  if host.json_kind(request.value('dependencies')) <> 'object' then
    return failure('dependencies must be an object');
  if host.json_kind(request.value('readiness')) <> 'object' then
    return failure('readiness must be an object');
  if host.json_has(request.serialize(), 'listeners') = 0 then
    return failure('listeners must announce the actual bound ports');

  readiness.load(request.value('readiness'));
  readinessIndex := host.json_node_member(host.json_parse_value(readiness.serialize()), 0, 'ready');
  if (readinessIndex < 0) or (host.json_kind(readiness.value('ready')) <> 'boolean') then
    return failure('readiness.ready must be a boolean');
  if host.json_kind(readiness.value('blockedBy')) <> 'array' then
    return failure('readiness.blockedBy must be an array');
  blockers.load(readiness.value('blockedBy'));
  if blockers.count() > 32 then return failure('Readiness blocker capacity exceeded');
  if (readiness.value('ready') = 'true') and (blockers.count() > 0) then
    return failure('Ready reports cannot contain blockers');
  index := 0;
  while index < blockers.count() do
  begin
    blocked.load(blockers.item(index));
    if (validText(blocked, 'serviceId') = 0) or
     (host.json_has(blocked.serialize(), 'instanceId') = 0) or
     (validText(blocked, 'reason') = 0) then
    return failure('Each readiness blocker requires serviceId, instanceId, and reason');
  index := index + 1
  end;

  handle := host.json_parse_value(request.value('dependencies'));
  index := 0;
  while index < host.json_node_object_count(handle, 0) do
  begin
  serviceId := host.json_node_key(handle, 0, index);
  bindingIndex := host.json_node_member(handle, 0, serviceId);
  if host.json_node_kind(handle, bindingIndex) <> 'object' then
    return failure('Each dependency binding must be an object');
  depBinding.load(host.json_node_value(handle, bindingIndex));
  if (validText(depBinding, 'instanceId') = 0) or
     (validText(depBinding, 'endpoint') = 0) or
     (validText(depBinding, 'readinessUrl') = 0) then
    return failure('Each dependency binding requires instanceId, endpoint, and readinessUrl');
  index := index + 1
  end;

  report.load('{}');
  report.setInteger('version', 1);
  report.setText('serviceId', request.text('serviceId'));
  report.setText('instanceId', request.text('instanceId'));
  report.setText('nodeId', request.text('nodeId'));
  report.setText('bootId', request.text('bootId'));
  report.setInteger('sequence', request.intValue('sequence'));
  report.setText('ownerAggregatorId', request.text('ownerAggregatorId'));
  report.setText('endpoint', request.text('endpoint'));
  report.embed('readiness', readiness.serialize());
  report.embed('dependencies', request.value('dependencies'));
  report.setInteger('ttlMs', 30000);
  if host.json_has(request.serialize(), 'listeners') = 1 then
  begin
    if host.json_kind(request.value('listeners')) <> 'array' then
      return failure('listeners must be an array');
    listenerList.load(request.value('listeners'));
    if listenerList.count() > 16 then return failure('Listener capacity exceeded');
    index := 0;
    while index < listenerList.count() do
    begin
      listenerDoc.load(listenerList.item(index));
      if (listenerDoc.text('protocol') <> 'http') and
         (listenerDoc.text('protocol') <> 'https') and
         (listenerDoc.text('protocol') <> 'tcp') and
         (listenerDoc.text('protocol') <> 'udp') then
        return failure('Unsupported listener protocol');
      if (listenerDoc.text('host') = '') or (listenerDoc.intValue('port') < 1) or
         (listenerDoc.intValue('port') > 65535) then
        return failure('Listener must announce a bound host and port');
      index := index + 1
    end;
    report.embed('listeners', listenerList.serialize())
  end;
  resultDoc.load('{}');
  resultDoc.setBoolean('ok', true);
  resultDoc.embed('report', report.serialize());
  return resultDoc.serialize()
end
end.
