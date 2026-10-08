service 'pulse-data-librarian-http-schema-operations';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    responseDoc: JSONDocument;
    bodyDoc: JSONDocument;
    dependentIds: JSONArray;
    position: integer;
    method: string;
    routePath: string;
    operation: string;
    schemaPath: string;
    nextPath: string;
    newName: string;
    errorMessage: string;
    status: integer;
    body: string;
    joinedIds: string;

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
  operation := '';
  if (method = 'DELETE') and (routePath = '/api/librarian/schemas') then operation := 'delete'
  else if (method = 'POST') and (routePath = '/api/librarian/schemas/rename') then operation := 'rename'
  else if (method = 'POST') and (routePath = '/api/librarian/schema-lifecycle') then operation := 'lifecycle'
  else return envelope(false, 200, 'null');

  schemaPath := request.text('schemaPath');
  if schemaPath = '' then
  begin
    if operation = 'rename' then
    begin
      if request.text('errorField') = 'newName' then
        return envelope(true, 400, '{"error":"newName is required"}');
      return envelope(true, 400, '{"error":"path is required"}')
    end;
    if operation = 'lifecycle' then
      return envelope(true, 400, '{"error":"path is required"}');
    return envelope(true, 400, '{"error":"path is required"}')
  end;

  newName := request.text('newName');
  if (operation = 'rename') and (newName = '') then
    return envelope(true, 400, '{"error":"newName is required"}');
  if (operation = 'delete') and (request.text('hasDependents') = 'true') then
  begin
    dependentIds.load(request.value('dependentIds'));
    joinedIds := '';
    position := 0;
    while position < dependentIds.count() do
    begin
      if position > 0 then joinedIds := joinedIds + ', ';
      joinedIds := joinedIds + host.json_to_text(dependentIds.item(position));
      position := position + 1
    end;
    bodyDoc.load('{}');
    bodyDoc.setText('error', 'Schema is used by subschemas: ' + joinedIds);
    return envelope(true, 409, bodyDoc.serialize())
  end;
  if request.text('safe') = 'false' then
    return envelope(true, 403, '{"error":"Access denied"}');
  if request.text('exists') = 'false' then
  begin
    if operation = 'lifecycle' then
    begin
      bodyDoc.load('{}');
      bodyDoc.setText('error', 'Schema not found: ' + schemaPath);
      return envelope(true, 404, bodyDoc.serialize())
    end;
    if operation = 'delete' then
      return envelope(true, 404, '{"error":"Schema not found"}')
    else if operation = 'rename' then
      return envelope(true, 404, '{"error":"Schema not found"}')
  end;

  if request.text('phase') = 'validate' then
    return envelope(true, 200, '{"valid":true}');

  if operation = 'delete' then
  begin
    if request.text('error') <> '' then
    begin
      if request.intValue('notFound') = 1 then return envelope(true, 404, '{"error":"Schema not found"}');
      bodyDoc.load('{}');
      bodyDoc.setText('error', request.text('error'));
      return envelope(true, 500, bodyDoc.serialize())
    end;
    bodyDoc.load('{}');
    bodyDoc.setText('status', 'deleted');
    bodyDoc.setText('path', schemaPath);
    return envelope(true, 200, bodyDoc.serialize())
  end;

  if operation = 'rename' then
  begin
    if request.text('error') <> '' then
    begin
      if request.intValue('notFound') = 1 then return envelope(true, 404, '{"error":"Schema not found"}');
      bodyDoc.load('{}');
      bodyDoc.setText('error', request.text('error'));
      return envelope(true, 500, bodyDoc.serialize())
    end;
    nextPath := request.text('nextPath');
    bodyDoc.load('{}');
    bodyDoc.setText('status', 'renamed');
    bodyDoc.setText('path', nextPath);
    return envelope(true, 200, bodyDoc.serialize())
  end;

  if request.text('error') <> '' then
  begin
    bodyDoc.load('{}');
    bodyDoc.setText('error', request.text('error'));
    if request.intValue('validation') = 1 then status := 400 else status := 500;
    return envelope(true, status, bodyDoc.serialize())
  end;
  bodyDoc.load('{}');
  bodyDoc.setText('status', 'updated');
  bodyDoc.setText('path', schemaPath);
  bodyDoc.embed('lifecycle', request.value('lifecycle'));
  body := bodyDoc.serialize();
  return envelope(true, 200, body)
end
end.
