service 'pulse-data-librarian-http-search';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    responseDoc: JSONDocument;
    files: JSONArray;
    matches: JSONArray;
    fileDoc: JSONDocument;
    position: integer;
    routePath: string;
    routeMethod: string;
    query: string;
    extension: string;
    name: string;
    fileExtension: string;
    includeFile: boolean;

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

  if (routeMethod <> 'GET') or (routePath <> '/api/librarian/search') then
    return envelope(false, 200, 'null');

  query := host.string_lower(request.text('q'));
  extension := request.text('ext');
  if host.string_index(extension, '.') = 0 then
    extension := host.string_replace(extension, '^[.]', '', '');

  files.load(request.value('files'));
  matches.load('[]');
  position := 0;
  while position < files.count() do
  begin
    fileDoc.load(files.item(position));
    name := host.string_lower(fileDoc.text('name'));
    fileExtension := fileDoc.text('ext');
    includeFile := true;
    if (query <> '') and (host.string_index(name, query) < 0) then
      includeFile := false;
    if (extension <> '') and (fileExtension <> extension) then
      includeFile := false;
    if includeFile then
      matches.append(files.item(position));
    position := position + 1
  end;

  responseDoc.load('{}');
  responseDoc.embed('files', matches.serialize());
  return envelope(true, 200, responseDoc.serialize())
end
end.
