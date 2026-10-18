service 'pulse-data-librarian-http-schema-catalog';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    responseDoc: JSONDocument;
    physicalSchemas: JSONArray;
    subschemas: JSONArray;
    allSchemas: JSONArray;
    routePath: string;
    routeMethod: string;
    structureMode: string;
    position: integer;

function envelope(matched: boolean; status: integer; body: string): string;
begin
  responseDoc.load('{}');
  responseDoc.setBoolean('matched', matched);
  responseDoc.setInteger('status', status);
  responseDoc.embed('body', body);
  return responseDoc.serialize()
end;

post '/structure-mode';
begin
  request.load(host.event_body());
  structureMode := '';
  if host.json_has(request.serialize(), 'value') = 1 then
    if host.json_kind(request.value('value')) = 'string' then
      structureMode := host.string_lower(host.text_trim(request.text('value')));
  if (structureMode = '') or (structureMode = 'cached') or (structureMode = 'lazy') then
    structureMode := 'cached'
  else if (structureMode = 'full') or (structureMode = 'all') or (structureMode = 'true') then
    structureMode := 'full'
  else if (structureMode = 'none') or (structureMode = 'false') then
    structureMode := 'none'
  else
  begin
    host.http_status(400);
    return '{"error":"structure must be one of: cached, full, none"}'
  end;
  responseDoc.load('{}');
  responseDoc.setText('mode', structureMode);
  return responseDoc.serialize()
end

post '/dispatch';
begin
  request.load(host.event_body());
  routePath := request.text('path');
  routeMethod := host.string_upper(request.text('method'));
  if (routeMethod <> 'GET') or
     ((routePath <> '/api/librarian/schemas') and
      (routePath <> '/api/librarian/subschemas')) then
    return envelope(false, 200, 'null');

  subschemas.load(request.value('subschemas'));
  responseDoc.load('{}');
  if routePath = '/api/librarian/subschemas' then
  begin
    responseDoc.embed('subschemas', subschemas.serialize());
    return envelope(true, 200, responseDoc.serialize())
  end;

  physicalSchemas.load(request.value('physicalSchemas'));
  allSchemas.load('[]');
  position := 0;
  while position < physicalSchemas.count() do
  begin
    allSchemas.append(physicalSchemas.item(position));
    position := position + 1
  end;
  position := 0;
  while position < subschemas.count() do
  begin
    allSchemas.append(subschemas.item(position));
    position := position + 1
  end;
  responseDoc.embed('schemas', allSchemas.serialize());
  responseDoc.embed('subschemas', subschemas.serialize());
  return envelope(true, 200, responseDoc.serialize())
end
end.
