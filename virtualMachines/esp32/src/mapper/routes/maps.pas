service 'pulse-data-mapper-http-maps';
use "JSON";
var request: JSONDocument;
    responseDoc: JSONDocument;
    bodyDoc: JSONDocument;
    method: string;
    routePath: string;
    phase: string;
    operation: string;
    errorMessage: string;
    id: string;
    newId: string;
    name: string;
    prompt: string;
    nodeId: string;
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

function pathOperation(value: string; pattern: string): boolean;
begin
  return host.string_replace(value, pattern, '', '') <> value
end;

post '/dispatch';
begin
  request.load(host.event_body());
  method := host.string_upper(request.text('method'));
  routePath := request.text('path');
  phase := request.text('phase');
  operation := '';

  if (method = 'POST') and (routePath = '/api/mapper/authoring/deterministic-generate') then operation := 'deterministicGenerate'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/ollama-intent') then operation := 'ollamaIntent'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/ollama-deploy') then operation := 'ollamaDeploy'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/ollama-intent-stream') then operation := 'ollamaIntentStream'
  else if (method = 'POST') and (routePath = '/api/mapper/authoring/test-last-stream') then operation := 'testLastStream'
  else if (method = 'GET') and (routePath = '/api/mapper/authoring/inventory') then operation := 'inventory'
  else if (method = 'GET') and (routePath = '/api/mapper/authoring/deployments') then operation := 'deployments'
  else if (method = 'GET') and (routePath = '/api/mapper/maps/names') then operation := 'mapNames'
  else if (method = 'GET') and (routePath = '/api/mapper/maps') then operation := 'listMaps'
  else if (method = 'POST') and (routePath = '/api/mapper/maps') then operation := 'createMap'
  else if (method = 'GET') and (routePath = '/api/mapper/test-cases') then operation := 'testCases'
  else if (method = 'GET') and pathOperation(routePath, '^/api/mapper/maps/[^/]+$') then operation := 'getMap'
  else if (method = 'PUT') and pathOperation(routePath, '^/api/mapper/maps/[^/]+$') then operation := 'updateMap'
  else if (method = 'DELETE') and pathOperation(routePath, '^/api/mapper/maps/[^/]+$') then operation := 'deleteMap'
  else if (method = 'POST') and pathOperation(routePath, '^/api/mapper/maps/[^/]+/rename$') then operation := 'renameMap'
  else if (method = 'POST') and pathOperation(routePath, '^/api/mapper/maps/[^/]+/import-csv$') then operation := 'importCsv'
  else if (method = 'GET') and pathOperation(routePath, '^/api/mapper/maps/[^/]+/export-csv$') then operation := 'exportCsv'
  else if (method = 'GET') and pathOperation(routePath, '^/api/mapper/maps/[^/]+/export-excel$') then operation := 'exportExcel'
  else if (method = 'POST') and pathOperation(routePath, '^/api/mapper/maps/[^/]+/auto-shape-map$') then operation := 'autoShapeMap'
  else if (method = 'POST') and pathOperation(routePath, '^/api/mapper/maps/[^/]+/run$') then operation := 'runMap'
  else if (method = 'GET') and (routePath = '/health') then operation := 'health'
  else return envelope(false, '', 200, 'null');

  if phase = 'validate' then
  begin
    id := request.text('id');
    newId := request.text('newId');
    name := request.text('name');
    prompt := request.text('prompt');
    nodeId := request.text('nodeId');
    if (operation = 'createMap') and ((id = '') or (name = '')) then
      return envelope(true, operation, 400, '{"error":"id and name are required"}');
    if (operation = 'createMap') and
       ((request.text('serviceLocal') = 'true') or (request.text('scope') = 'local')) then
    begin
      bodyDoc.load('{}');
      bodyDoc.setText('error', request.text('localMapError'));
      return envelope(true, operation, 400, bodyDoc.serialize())
    end;
    if (operation = 'renameMap') and (newId = '') then
      return envelope(true, operation, 400, '{"error":"newId is required"}');
    if (operation = 'importCsv') and (request.text('csvContent') = '') then
      return envelope(true, operation, 400, '{"error":"csvContent is required"}');
    if (operation = 'autoShapeMap') and
       ((request.text('sourcePath') = '') or (request.text('targetPath') = '')) then
      return envelope(true, operation, 400, '{"error":"sourcePath and targetPath are required"}');
    if ((operation = 'deterministicGenerate') or (operation = 'ollamaIntent') or
        (operation = 'ollamaDeploy') or (operation = 'ollamaIntentStream')) and (prompt = '') then
      return envelope(true, operation, 400, '{"error":"prompt is required"}');
    if (operation = 'ollamaDeploy') and (nodeId = '') then
      return envelope(true, operation, 400, '{"error":"nodeId is required"}');
    if (operation = 'runMap') and
       ((request.text('payloadKind') <> 'object') and (request.text('testCaseId') = '')) then
      return envelope(true, operation, 400, '{"error":"payload object or testCaseId is required"}');
    return envelope(true, operation, 200, '{"valid":true}')
  end;

  if phase = 'response' then
  begin
    status := request.intValue('responseStatus');
    if (status < 100) or (status > 599) then status := 500;
    if operation = 'health' then
      return envelope(true, operation, 200, '{"status":"ok","service":"data-mapper"}');
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
