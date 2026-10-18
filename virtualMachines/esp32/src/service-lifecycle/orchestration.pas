service 'pulse-service-orchestration';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    catalogDoc: JSONDocument;
    observations: JSONDocument;
    serviceDoc: JSONDocument;
    observation: JSONDocument;
    dependencyObservation: JSONDocument;
    required: JSONDocument;
    emitted: JSONDocument;
    responseDoc: JSONDocument;
    blocked: JSONDocument;
    result: JSONDocument;
    ids: JSONArray;
    dependencies: JSONArray;
    order: JSONArray;
    blockers: JSONArray;
    roots: JSONArray;
    index: integer;
    dependencyIndex: integer;
    pass: integer;
    remaining: integer;
    previous: integer;
    id: string;
    dependencyId: string;
    requestedId: string;
    owner: string;
    valid: boolean;
    ready: boolean;
    cascade: boolean;
    desiredDoc: JSONDocument;
    attempts: integer;
    delaySeconds: integer;

function failure(message: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', false);
  responseDoc.setText('error', message);
  return responseDoc.serialize()
end;

post '/infrastructure-dependencies';
begin
  request.load(host.event_body());
  if request.text('brokerProvider') = 'rabbitmq' then
    return '{"ok":true,"dependencies":{"broker":["rabbitmq"]}}';
  return '{"ok":true,"dependencies":{"broker":[]}}'
end

post '/startup-policy';
begin
  request.load(host.event_body());
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  if request.text('serviceId') = 'pulse-frontend' then
    responseDoc.setInteger('timeoutMs', 120000)
  else responseDoc.setInteger('timeoutMs', request.intValue('defaultTimeoutMs'));
  return responseDoc.serialize()
end

post '/startup-timeout';
begin
  request.load(host.event_body());
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  if request.value('alive') = 'true' then responseDoc.setText('action', 'keep')
  else responseDoc.setText('action', 'terminate');
  return responseDoc.serialize()
end

post '/start-order';
begin
  request.load(host.event_body());
  catalogDoc.load(request.value('services'));
  ids.load(request.value('ids'));
  roots.load(request.value('roots'));
  if (ids.count() > 32) or (roots.count() > 32) then
    return failure('Service graph capacity exceeded');
  required.load('{}');
  emitted.load('{}');
  order.load('[]');
  index := 0;
  while index < ids.count() do
  begin
    id := host.json_to_text(ids.item(index));
    required.setBoolean(id, false);
    emitted.setBoolean(id, false);
    index := index + 1
  end;
  index := 0;
  while index < roots.count() do
  begin
    id := host.json_to_text(roots.item(index));
    if host.json_has(catalogDoc.serialize(), id) = 0 then
      return failure('Unknown service: ' + id);
    required.setBoolean(id, true);
    index := index + 1
  end;
  pass := 0;
  while pass < ids.count() do
  begin
    index := 0;
    while index < ids.count() do
    begin
      id := host.json_to_text(ids.item(index));
      if required.value(id) = 'true' then
      begin
        serviceDoc.load(catalogDoc.value(id));
        dependencies.load(serviceDoc.value('dependencies'));
        if dependencies.count() > 32 then
          return failure('Dependency capacity exceeded: ' + id);
        dependencyIndex := 0;
        while dependencyIndex < dependencies.count() do
        begin
          dependencyId := host.json_to_text(dependencies.item(dependencyIndex));
          if host.json_has(catalogDoc.serialize(), dependencyId) = 0 then
            return failure('Unknown dependency: ' + id + ' -> ' + dependencyId);
          required.setBoolean(dependencyId, true);
          dependencyIndex := dependencyIndex + 1
        end
      end;
      index := index + 1
    end;
    pass := pass + 1
  end;
  remaining := 0;
  index := 0;
  while index < ids.count() do
  begin
    id := host.json_to_text(ids.item(index));
    if required.value(id) = 'true' then remaining := remaining + 1;
    index := index + 1
  end;
  while remaining > 0 do
  begin
    previous := remaining;
    index := 0;
    while index < ids.count() do
    begin
      id := host.json_to_text(ids.item(index));
      if (required.value(id) = 'true') and (emitted.value(id) <> 'true') then
      begin
        serviceDoc.load(catalogDoc.value(id));
        dependencies.load(serviceDoc.value('dependencies'));
        valid := true;
        dependencyIndex := 0;
        while dependencyIndex < dependencies.count() do
        begin
          dependencyId := host.json_to_text(dependencies.item(dependencyIndex));
          if emitted.value(dependencyId) <> 'true' then valid := false;
          dependencyIndex := dependencyIndex + 1
        end;
        if valid then
        begin
          order.append(host.json_value(host.json_set('{}', 'id', id), 'id'));
          emitted.setBoolean(id, true);
          remaining := remaining - 1
        end
      end;
      index := index + 1
    end;
    if remaining = previous then
      return failure('Service dependency cycle in requested graph')
  end;
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.embed('order', order.serialize());
  return responseDoc.serialize()
end

post '/evaluate';
begin
  request.load(host.event_body());
  catalogDoc.load(request.value('services'));
  observations.load(request.value('observations'));
  id := request.text('id');
  owner := request.text('owner');
  if host.json_has(catalogDoc.serialize(), id) = 0 then
    return failure('Unknown service: ' + id);
  serviceDoc.load(catalogDoc.value(id));
  observation.load(observations.value(id));
  dependencies.load(serviceDoc.value('dependencies'));
  blockers.load('[]');
  dependencyIndex := 0;
  while dependencyIndex < dependencies.count() do
  begin
    dependencyId := host.json_to_text(dependencies.item(dependencyIndex));
    dependencyObservation.load(observations.value(dependencyId));
    if dependencyObservation.value('ready') <> 'true' then
    begin
      blocked.load('{}');
      blocked.setText('serviceId', dependencyId);
      blocked.setText('reason', dependencyObservation.text('reason'));
      blockers.append(blocked.serialize())
    end;
    dependencyIndex := dependencyIndex + 1
  end;
  ready := (observation.value('ready') = 'true') and (blockers.count() = 0);
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.setBoolean('ready', ready);
  responseDoc.embed('blockedBy', blockers.serialize());
  if blockers.count() > 0 then responseDoc.setText('state', 'blocked')
  else if ready then responseDoc.setText('state', 'ready')
  else if observation.value('alive') = 'true' then responseDoc.setText('state', 'not-ready')
  else responseDoc.setText('state', 'stopped');
  if observation.value('alive') = 'true' then responseDoc.setText('action', 'observe')
  else if (serviceDoc.text('management') = 'external') or
    ((serviceDoc.text('ownerAggregatorId') <> '') and
     (serviceDoc.text('ownerAggregatorId') <> owner)) then
    responseDoc.setText('action', 'observe')
  else if blockers.count() > 0 then responseDoc.setText('action', 'wait')
  else responseDoc.setText('action', 'start');
  return responseDoc.serialize()
end

post '/stop-order';
begin
  request.load(host.event_body());
  catalogDoc.load(request.value('services'));
  ids.load(request.value('ids'));
  order.load(request.value('order'));
  desiredDoc.load(request.value('desired'));
  requestedId := request.text('id');
  owner := request.text('owner');
  cascade := request.value('cascade') = 'true';
  if host.json_has(catalogDoc.serialize(), requestedId) = 0 then
    return failure('Unknown service: ' + requestedId);
  required.load('{}');
  index := 0;
  while index < ids.count() do
  begin
    required.setBoolean(host.json_to_text(ids.item(index)), false);
    index := index + 1
  end;
  required.setBoolean(requestedId, true);
  pass := 0;
  while pass < ids.count() do
  begin
    index := 0;
    while index < ids.count() do
    begin
      id := host.json_to_text(ids.item(index));
      if (desiredDoc.value(id) = 'true') and (required.value(id) <> 'true') then
      begin
        serviceDoc.load(catalogDoc.value(id));
        dependencies.load(serviceDoc.value('dependencies'));
        dependencyIndex := 0;
        while dependencyIndex < dependencies.count() do
        begin
          dependencyId := host.json_to_text(dependencies.item(dependencyIndex));
          if required.value(dependencyId) = 'true' then
          begin
            if not cascade then return failure('Service is in use by ' + id + '; explicit cascade is required');
            required.setBoolean(id, true)
          end;
          dependencyIndex := dependencyIndex + 1
        end
      end;
      index := index + 1
    end;
    pass := pass + 1
  end;
  roots.load('[]');
  index := order.count() - 1;
  while index >= 0 do
  begin
    id := host.json_to_text(order.item(index));
    if required.value(id) = 'true' then
    begin
      serviceDoc.load(catalogDoc.value(id));
      if (serviceDoc.text('management') = 'external') or
         ((serviceDoc.text('ownerAggregatorId') <> '') and
          (serviceDoc.text('ownerAggregatorId') <> owner)) then
        return failure('Aggregator does not own service ' + id);
      roots.append(order.item(index))
    end;
    index := index - 1
  end;
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.embed('order', roots.serialize());
  return responseDoc.serialize()
end

post '/recovery';
begin
  request.load(host.event_body());
  attempts := request.intValue('attempts');
  delaySeconds := 1;
  index := 0;
  while (index < attempts) and (delaySeconds < 60) do
  begin
    delaySeconds := delaySeconds * 2;
    index := index + 1
  end;
  if delaySeconds > 60 then delaySeconds := 60;
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.setText('action', 'start');
  if (attempts > 0) and ((request.intValue('now') - request.intValue('lastAttempt')) < delaySeconds) then
    responseDoc.setText('action', 'wait');
  responseDoc.setInteger('delaySeconds', delaySeconds);
  return responseDoc.serialize()
end
end.
