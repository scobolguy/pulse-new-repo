service 'pulse-data-librarian-http-schema-lookup';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    responseDoc: JSONDocument;
    schemas: JSONArray;
    schemaDoc: JSONDocument;
    position: integer;
    selected: integer;
    selectedVersion: integer;
    version: integer;
    routePath: string;
    routeMethod: string;
    schemaType: string;
    schemaName: string;
    candidateType: string;
    candidateName: string;
    versionFilter: integer;
    hasVersionFilter: boolean;
    status: integer;
    body: string;

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

  if (routeMethod <> 'GET') or (routePath <> '/api/librarian/schema/:type/:name') then
    return envelope(false, 200, 'null');

  schemaType := host.string_lower(request.text('type'));
  schemaName := request.text('name');
  versionFilter := request.intValue('version');
  hasVersionFilter := request.intValue('hasVersionFilter') = 1;
  schemas.load(request.value('schemas'));
  selected := -1;
  selectedVersion := -2147483647;
  position := 0;
  while position < schemas.count() do
  begin
    schemaDoc.load(schemas.item(position));
    candidateType := schemaDoc.text('type');
    candidateName := schemaDoc.text('name');
    version := schemaDoc.intValue('version');
    if (candidateType = schemaType) and (candidateName = schemaName) and
       ((not hasVersionFilter) or (version = versionFilter)) then
    begin
      if (selected < 0) or (version > selectedVersion) then
      begin
        selected := position;
        selectedVersion := version
      end
    end;
    position := position + 1
  end;

  if selected < 0 then
  begin
    status := 404;
    body := '{"error":"Schema not found"}'
  end
  else
  begin
    responseDoc.load('{}');
    responseDoc.setInteger('selectedIndex', selected);
    status := 200;
    body := responseDoc.serialize()
  end;
  return envelope(true, status, body)
end
end.
