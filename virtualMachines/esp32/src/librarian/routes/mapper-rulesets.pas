service 'pulse-data-librarian-http-mapper-rulesets';
use "JSON";
var request: JSONDocument;
    responseDoc: JSONDocument;
    bodyDoc: JSONDocument;
    method: string;
    routePath: string;
    operation: string;
    id: string;
    status: integer;
    errorStatus: integer;
    body: string;
    errorMessage: string;
    phase: string;

function envelope(matched: boolean; status: integer; body: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('matched', matched);
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
  if (method = 'GET') and (routePath = '/api/librarian/mapper-rulesets') then operation := 'list'
  else if (method = 'POST') and (routePath = '/api/librarian/mapper-rulesets') then operation := 'create'
  else if (method = 'PUT') and (routePath = '/api/librarian/mapper-rulesets/:id') then operation := 'update'
  else if (method = 'DELETE') and (routePath = '/api/librarian/mapper-rulesets/:id') then operation := 'delete'
  else return envelope(false, 200, 'null');

  if phase = 'validate' then
  begin
    id := request.text('id');
    if ((operation = 'update') or (operation = 'delete')) and (id = '') then
      return envelope(true, 400, '{"error":"id is required"}');
    return envelope(true, 200, '{"valid":true}')
  end;

  if request.text('error') <> '' then
  begin
    errorMessage := request.text('error');
    errorStatus := request.intValue('errorStatus');
    if request.intValue('catalogDecision') = 1 then status := errorStatus
    else if operation = 'delete' then status := 500
    else status := 400;
    if (status < 400) or (status > 599) then
      if operation = 'delete' then status := 500 else status := 400;
    bodyDoc.load('{}');
    bodyDoc.setText('error', errorMessage);
    return envelope(true, status, bodyDoc.serialize())
  end;

  bodyDoc.load('{}');
  if operation = 'list' then
  begin
    bodyDoc.embed('rulesets', request.value('rulesets'));
    return envelope(true, 200, bodyDoc.serialize())
  end;
  if operation = 'create' then bodyDoc.setText('status', 'created')
  else if operation = 'update' then bodyDoc.setText('status', 'updated')
  else
  begin
    bodyDoc.setText('status', 'deleted');
    bodyDoc.setText('id', request.text('id'));
    return envelope(true, 200, bodyDoc.serialize())
  end;
  bodyDoc.embed('ruleset', request.value('ruleset'));
  body := bodyDoc.serialize();
  return envelope(true, 200, body)
end
end.
