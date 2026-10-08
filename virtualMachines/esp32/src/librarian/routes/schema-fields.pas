service 'pulse-data-librarian-http-schema-fields';
use "JSON";
var request: JSONDocument;
    response: JSONDocument;
    routePath: string;
    routeMethod: string;
    schemaPath: string;
    availableFields: string;
    status: integer;
    body: string;
    found: boolean;
    structureAvailable: boolean;

function envelope(matched: boolean; status: integer; body: string): string;
begin
  response.load('{}');
  response.setBoolean('matched', matched);
  response.setInteger('status', status);
  response.embed('body', body);
  return response.serialize()
end;

post '/dispatch';
begin
  request.load(host.event_body());
  routePath := request.text('path');
  routeMethod := host.string_upper(request.text('method'));

  if (routeMethod <> 'GET') or (routePath <> '/api/librarian/schema-fields') then
    return envelope(false, 200, 'null');

  schemaPath := host.text_trim(request.text('schemaPath'));
  found := request.intValue('found') = 1;
  structureAvailable := request.intValue('structureAvailable') = 1;
  availableFields := request.value('availableFields');

  if schemaPath = '' then
  begin
    status := 400;
    body := '{"error":"path is required"}'
  end
  else if not found then
  begin
    status := 404;
    body := '{"error":"Schema not found"}'
  end
  else if not structureAvailable then
  begin
    status := 422;
    body := '{"error":"Schema structure is unavailable"}'
  end
  else
  begin
    response.load('{}');
    response.setText('path', schemaPath);
    response.embed('availableFields', availableFields);
    status := 200;
    body := response.serialize()
  end;

  return envelope(true, status, body)
end
end.
