service 'pulse-data-mapper-http-authoring';
use "JSON";
var request: JSONDocument;
    responseDoc: JSONDocument;
    bodyDoc: JSONDocument;
    method: string;
    routePath: string;
    phase: string;
    operation: string;
    prompt: string;
    nodeId: string;
    hasIntent: string;
    status: integer;

function envelope(matched: boolean; operation: string; status: integer; body: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('matched', matched);
  responseDoc.setText('operation', operation);
  responseDoc.setInteger('status', status);
  responseDoc.embed('body', body);
  return responseDoc.serialize()
end;

post '/dispatch';
begin
  request.load(host.event_body());
  method := host.string_upper(request.text('method'));
  routePath := request.text('path');
  phase := request.text('phase');
  operation := '';
  if (method = 'GET') and (routePath = '/api/mapper/authoring/inventory') then operation := 'inventory'
  else if (method = 'GET') and (routePath = '/api/mapper/authoring/deployments') then operation := 'deployments'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/ollama-intent-stream') then operation := 'ollamaIntentStream'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/test-last-stream') then operation := 'testLastStream'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/deterministic-generate') then operation := 'deterministicGenerate'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/ollama-intent') then operation := 'ollamaIntent'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/ollama-deploy') then operation := 'ollamaDeploy'
  else return envelope(false, '', 200, 'null');

  if phase = 'validate' then
  begin
    prompt := request.text('prompt');
    nodeId := request.text('nodeId');
    hasIntent := request.text('hasIntent');
    if ((operation = 'ollamaIntentStream') or (operation = 'ollamaIntent') or
        (operation = 'ollamaDeploy')) and (prompt = '') then
      return envelope(true, operation, 400, '{"error":"prompt is required"}');
    if (operation = 'deterministicGenerate') and (prompt = '') and (hasIntent <> 'true') then
      return envelope(true, operation, 400, '{"error":"prompt is required"}');
    if (operation = 'ollamaDeploy') and (nodeId = '') then
      return envelope(true, operation, 400, '{"error":"nodeId is required"}');
    return envelope(true, operation, 200, '{"valid":true}')
  end;

  if phase = 'response' then
  begin
    status := request.intValue('responseStatus');
    if (status < 100) or (status > 599) then status := 500;
    if request.text('error') <> '' then
    begin
      bodyDoc.load('{}');
      bodyDoc.setText('error', request.text('error'));
      return envelope(true, operation, status, bodyDoc.serialize())
    end;
    return envelope(true, operation, status, request.value('response'))
  end;

  return envelope(true, operation, 200, '{"valid":true}')
end
end.
