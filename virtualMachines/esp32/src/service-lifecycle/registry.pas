service 'pulse-service-instance-registry-policy';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    candidate: JSONDocument;
    previousDoc: JSONDocument;
    responseDoc: JSONDocument;
    instance: JSONDocument;
    expiredReadiness: JSONDocument;
    retired: JSONArray;
    position: integer;
    accepted: boolean;

function failure(message: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', false);
  responseDoc.setText('error', message);
  return responseDoc.serialize()
end;

post '/accept';
begin
  request.load(host.event_body());
  candidate.load(request.value('candidate'));
  previousDoc.load(request.value('previous'));
  retired.load(request.value('retiredBoots'));
  if request.value('exists') = 'true' then
  begin
    if (previousDoc.text('serviceId') <> candidate.text('serviceId')) or
       (previousDoc.text('nodeId') <> candidate.text('nodeId')) or
       (previousDoc.text('ownerAggregatorId') <> candidate.text('ownerAggregatorId')) then
      return failure('Instance identity or owner conflict');
    if (previousDoc.text('bootId') = candidate.text('bootId')) and
       (candidate.intValue('sequence') <= previousDoc.intValue('sequence')) then
      return failure('Stale instance report');
    position := 0;
    while position < retired.count() do
    begin
      if host.json_to_text(retired.item(position)) = candidate.text('bootId') then
        return failure('Retired boot incarnation');
      position := position + 1
    end;
    if previousDoc.text('bootId') <> candidate.text('bootId') then
    begin
      if retired.count() >= 32 then return failure('Boot history capacity exceeded');
      retired.append(host.json_value(host.json_set('{}', 'id', previousDoc.text('bootId')), 'id'))
    end
  end
  else if request.intValue('count') >= 1024 then
    return failure('Instance registry capacity exceeded');
  instance.load(candidate.serialize());
  instance.setText('lastReportAt', request.text('observedAt'));
  instance.setInteger('expiresTick', request.intValue('timestamp') + 30);
  instance.setText('reporting', 'fresh');
  if host.json_value(candidate.value('readiness'), 'ready') = 'true' then
    instance.setText('status', 'up')
  else instance.setText('status', 'blocked');
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.embed('instance', instance.serialize());
  responseDoc.embed('retiredBoots', retired.serialize());
  return responseDoc.serialize()
end

post '/expire';
begin
  request.load(host.event_body());
  instance.load(request.value('instance'));
  if request.intValue('timestamp') >= instance.intValue('expiresTick') then
  begin
    instance.setText('reporting', 'stale');
    instance.setText('status', 'down');
    expiredReadiness.load('{"ready":false,"blockedBy":[],"reason":"Instance report expired"}');
    instance.embed('readiness', expiredReadiness.serialize())
  end;
  responseDoc.load('{}');
  responseDoc.setBoolean('ok', true);
  responseDoc.embed('instance', instance.serialize());
  return responseDoc.serialize()
end
end.
