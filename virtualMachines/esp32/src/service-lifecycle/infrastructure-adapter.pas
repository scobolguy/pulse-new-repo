service 'pulse-external-infrastructure-adapter';
use "JSON";
var observation: JSONDocument;
var evidence: JSONDocument;
var resultDoc: JSONDocument;

get '/health';
begin
  return '{"status":"ok","management":"external","adapter":true}'
end

get '/api/runtime/infrastructure/ready';
begin
  observation.load(host.infrastructure_probe());
  evidence.load(observation.value('body'));
  if (observation.intValue('status') >= 200) and
     (observation.intValue('status') < 300) and (evidence.value('ready') = 'true') then
    return '{"ready":true}';
  host.http_status(503);
  resultDoc.load('{"ready":false}');
  resultDoc.setText('reason', evidence.text('reason'));
  return resultDoc.serialize()
end
end.
