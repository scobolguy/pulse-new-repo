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
    position: integer;

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
