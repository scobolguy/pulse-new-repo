service 'pulse-service-transaction-policy';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    responseDoc: JSONDocument;
    candidate: JSONDocument;
    readiness: JSONDocument;
    listener: JSONDocument;
    selected: JSONDocument;
    candidates: JSONArray;
    listeners: JSONArray;
    position: integer;
    listenerIndex: integer;
    load: integer;
    bestLoad: integer;
    found: boolean;
    requestedService: string;
    eventName: string;
    previousState: string;
    eligible: JSONDocument;
    identities: JSONDocument;
    binding: JSONDocument;
    bindings: JSONArray;
    pass: integer;
    bindingIndex: integer;
    progress: boolean;
    dependenciesReady: boolean;
    parentDoc: JSONDocument;
    childDoc: JSONDocument;
    continuation: JSONDocument;
    allowed: boolean;

post '/dispatch-policy';
begin
  request.load(host.event_body());
  if (request.text('serviceId') = 'pulse-local-mcp') or
     (request.text('serviceId') = 'pulse-data-mapper') then
    return '{"ok":true,"timeoutMs":180000}';
  return '{"ok":true,"timeoutMs":15000}'
end

post '/continuation';
begin
  request.load(host.event_body());
  parentDoc.load(request.value('parent'));
  childDoc.load(request.value('child'));
  continuation.load(request.value('continuation'));
  allowed := false;
  bindings.load(parentDoc.value('allocatedDependencies'));
  bindingIndex := 0;
  while bindingIndex < bindings.count() do
  begin
    binding.load(bindings.item(bindingIndex));
    if binding.text('serviceId') = continuation.text('serviceId') then allowed := true;
    bindingIndex := bindingIndex + 1
  end;
  if (parentDoc.text('status') <> 'allocated') or
     (childDoc.text('parentTransactionId') <> parentDoc.text('transactionId')) or
     (childDoc.text('transactionId') <> continuation.text('transactionId')) or
     (childDoc.text('serviceId') <> continuation.text('serviceId')) or not allowed then
  begin
    host.http_status(409);
    return '{"error":"Invalid or unbound transaction continuation"}'
  end;
  return '{"ok":true}'
end

post '/allocate';
begin
  request.load(host.event_body());
  requestedService := request.text('serviceId');
  candidates.load(request.value('instances'));
  if candidates.count() > 1024 then
  begin
    host.http_status(400);
    return '{"error":"Instance capacity exceeded"}'
  end;
  found := false;
  bestLoad := 2147483647;
  eligible.load('{}');
  identities.load('{}');
  position := 0;
  while position < candidates.count() do
  begin
    candidate.load(candidates.item(position));
    eligible.setBoolean(candidate.text('instanceId'), false);
    identities.setText(candidate.text('instanceId'), candidate.text('serviceId'));
    position := position + 1
  end;
  pass := 0;
  progress := true;
  while (pass < candidates.count()) and progress do
  begin
    progress := false;
    position := 0;
    while position < candidates.count() do
    begin
      candidate.load(candidates.item(position));
      readiness.load(candidate.value('readiness'));
      if (eligible.value(candidate.text('instanceId')) <> 'true') and
         (candidate.text('reporting') = 'fresh') and
         (candidate.value('draining') <> 'true') and
         (readiness.value('ready') = 'true') then
      begin
        dependenciesReady := true;
        bindings.load(candidate.value('dependencyBindings'));
        bindingIndex := 0;
        while bindingIndex < bindings.count() do
        begin
          binding.load(bindings.item(bindingIndex));
          if host.json_has(eligible.serialize(), binding.text('instanceId')) = 0 then
            dependenciesReady := false
          else if eligible.value(binding.text('instanceId')) <> 'true' then
            dependenciesReady := false
          else if identities.text(binding.text('instanceId')) <> binding.text('serviceId') then
            dependenciesReady := false;
          bindingIndex := bindingIndex + 1
        end;
        if dependenciesReady then
        begin
          eligible.setBoolean(candidate.text('instanceId'), true);
          progress := true
        end
      end;
      position := position + 1
    end;
    pass := pass + 1
  end;
  position := 0;
  while position < candidates.count() do
  begin
    candidate.load(candidates.item(position));
    readiness.load(candidate.value('readiness'));
    if (candidate.text('serviceId') = requestedService) and
       (eligible.value(candidate.text('instanceId')) = 'true') then
    begin
      load := candidate.intValue('inflight');
      if load < bestLoad then
      begin
        listeners.load(candidate.value('listeners'));
        listenerIndex := 0;
        while listenerIndex < listeners.count() do
        begin
          listener.load(listeners.item(listenerIndex));
          if (listener.text('protocol') = 'http') or (listener.text('protocol') = 'https') then
          begin
            selected.load('{}');
            selected.setText('instanceId', candidate.text('instanceId'));
            selected.embed('listener', listener.serialize());
            selected.embed('dependencies', candidate.value('dependencyBindings'));
            found := true;
            bestLoad := load;
            listenerIndex := listeners.count()
          end;
          listenerIndex := listenerIndex + 1
        end
      end
    end;
    position := position + 1
  end;
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.embed('eligible', eligible.serialize());
  if found then
  begin
    responseDoc.setText('action', 'allocate');
    responseDoc.embed('selection', selected.serialize())
  end
  else
  begin
    responseDoc.setText('action', 'hold');
    responseDoc.setText('reason', 'No fresh ready dependency chain with an announced HTTP listener')
  end;
  return responseDoc.serialize()
end

post '/transition';
begin
  request.load(host.event_body());
  eventName := request.text('event');
  previousState := request.text('status');
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.setText('status', previousState);
  if (eventName = 'accept') and (previousState = '') then
    responseDoc.setText('status', 'held')
  else if (eventName = 'allocate') and (previousState = 'held') then
    responseDoc.setText('status', 'allocated')
  else if (eventName = 'reply') and (previousState = 'allocated') then
    responseDoc.setText('status', 'completed')
  else if (eventName = 'continuation') and (previousState = 'allocated') then
    responseDoc.setText('status', 'waiting-child')
  else if (eventName = 'child-reply') and (previousState = 'waiting-child') then
    responseDoc.setText('status', 'completed')
  else if (eventName = 'child-uncertain') and (previousState = 'waiting-child') then
  begin
    responseDoc.setText('status', 'uncertain');
    responseDoc.setText('reason', 'Downstream delivery outcome is uncertain; automatic retry is not permitted')
  end
  else if ((eventName = 'transport-failed') or (eventName = 'restore')) and
          (previousState = 'allocated') then
  begin
    responseDoc.setText('status', 'uncertain');
    responseDoc.setText('reason', 'Delivery outcome is uncertain; automatic retry is not permitted')
  end
  else if (eventName = 'restore') or (eventName = 'hold') then
    responseDoc.setText('status', previousState)
  else
  begin
    host.http_status(409);
    return '{"error":"Invalid transaction state transition"}'
  end;
  return responseDoc.serialize()
end
end.
