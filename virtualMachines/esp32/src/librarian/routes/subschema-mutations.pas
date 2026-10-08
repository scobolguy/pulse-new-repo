service 'pulse-data-librarian-http-subschema-mutations';
use "JSON";
var request: JSONDocument;
    responseDoc: JSONDocument;
    responseBody: JSONDocument;
    routePath: string;
    routeMethod: string;
    operation: string;
    identity: string;
    errorMessage: string;
    resultStatus: integer;
    status: integer;
    body: string;
    matched: boolean;

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
  routePath := request.text('path');
  routeMethod := host.string_upper(request.text('method'));
  operation := '';
  matched := false;
  if (routeMethod = 'POST') and (routePath = '/api/librarian/subschemas') then
  begin
    operation := 'create';
    matched := true
  end
  else if (routeMethod = 'PUT') and (routePath = '/api/librarian/subschemas/:id') then
  begin
    operation := 'update';
    matched := true
  end
  else if (routeMethod = 'DELETE') and (routePath = '/api/librarian/subschemas/:id') then
  begin
    operation := 'delete';
    matched := true
  end;
  if not matched then return envelope(false, 200, 'null');

  identity := request.text('id');
  errorMessage := request.text('error');
  resultStatus := request.intValue('resultStatus');
  if errorMessage <> '' then
  begin
    if (resultStatus < 400) or (resultStatus > 599) then
    begin
      if operation = 'delete' then resultStatus := 500
      else resultStatus := 400
    end;
    responseBody.load('{}');
    responseBody.setText('error', errorMessage);
    return envelope(true, resultStatus, responseBody.serialize())
  end;

  if operation = 'create' then status := 201
  else status := 200;
  responseBody.load('{}');
  if operation = 'delete' then
  begin
    responseBody.setText('status', 'deleted');
    responseBody.setText('id', identity)
  end
  else
  begin
    if host.json_has(request.serialize(), 'subschema') = 0 then
      return envelope(true, 500, '{"error":"Subschema response is missing"}');
    if operation = 'create' then responseBody.setText('status', 'created')
    else responseBody.setText('status', 'updated');
    responseBody.embed('subschema', request.value('subschema'))
  end;
  body := responseBody.serialize();
  return envelope(true, status, body)
end
end.
