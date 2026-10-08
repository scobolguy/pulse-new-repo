service 'pulse-data-librarian-http-data-types';
use "JSON";
var request: JSONDocument;
    responseDoc: JSONDocument;
    bodyDoc: JSONDocument;
    method: string;
    routePath: string;
    operation: string;
    status: integer;
    errorStatus: integer;
    body: string;
    errorMessage: string;
    id: string;
    label: string;
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
  if (method = 'GET') and (routePath = '/api/librarian/data-types') then operation := 'list'
  else if (method = 'POST') and (routePath = '/api/librarian/data-types') then operation := 'create'
  else if (method = 'DELETE') and (routePath = '/api/librarian/data-types/:id') then operation := 'delete'
  else if (method = 'POST') and (routePath = '/api/librarian/data-types/:id/rename') then operation := 'rename'
  else if (method = 'PATCH') and (routePath = '/api/librarian/data-types/:id') then operation := 'update'
  else return envelope(false, 200, 'null');

  if phase = 'validate' then
  begin
    id := request.text('id');
    label := request.text('label');
    if operation = 'create' then
      if (id = '') or (label = '') then return envelope(true, 400, '{"error":"id and label are required"}');
    if (operation = 'delete') or (operation = 'rename') or (operation = 'update') then
    begin
      if id = '' then return envelope(true, 400, '{"error":"id is required"}');
      if (operation = 'rename') and (request.text('newId') = '') then
        return envelope(true, 400, '{"error":"newId is required"}')
    end;
    return envelope(true, 200, '{"valid":true}')
  end;

  if request.text('error') <> '' then
  begin
    errorMessage := request.text('error');
    errorStatus := request.intValue('errorStatus');
    if request.intValue('catalogDecision') = 1 then status := errorStatus
    else if operation = 'create' then status := 500
    else if operation = 'update' then status := 500
    else if operation = 'delete' then status := 500
    else if operation = 'rename' then status := 500
    else status := 500;
    if (status < 400) or (status > 599) then status := 500;
    bodyDoc.load('{}');
    bodyDoc.setText('error', errorMessage);
    return envelope(true, status, bodyDoc.serialize())
  end;

  bodyDoc.load('{}');
  if operation = 'list' then
  begin
    bodyDoc.embed('types', request.value('types'));
    return envelope(true, 200, bodyDoc.serialize())
  end;
  if operation = 'create' then
  begin
    bodyDoc.setText('status', 'created');
    bodyDoc.embed('type', request.value('type'))
  end
  else if operation = 'delete' then
  begin
    bodyDoc.setText('status', 'deleted');
    bodyDoc.setText('id', request.text('id'))
  end
  else if operation = 'rename' then
  begin
    bodyDoc.setText('status', 'renamed');
    bodyDoc.embed('type', request.value('type'))
  end
  else
  begin
    bodyDoc.setText('status', 'updated');
    bodyDoc.embed('type', request.value('type'))
  end;
  body := bodyDoc.serialize();
  return envelope(true, 200, body)
end
end.
