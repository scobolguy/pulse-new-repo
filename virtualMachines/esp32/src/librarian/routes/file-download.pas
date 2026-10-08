service 'pulse-data-librarian-http-file-download';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    responseDoc: JSONDocument;
    candidates: JSONArray;
    status: integer;
    position: integer;
    selected: integer;
    routePath: string;
    filePath: string;
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
  if host.string_index(routePath, '/api/librarian/file') <> 0 then
    return envelope(false, 200, 'null');
  if (routePath <> '/api/librarian/file') and
     (host.string_index(routePath, '/api/librarian/file/') <> 0) then
    return envelope(false, 200, 'null');

  filePath := host.text_trim(request.text('filePath'));
  if filePath = '' then
    return envelope(true, 400, '{"error":"No file path specified"}');

  candidates.load(request.value('candidateExists'));
  selected := -1;
  position := 0;
  while (position < candidates.count()) and (selected < 0) do
  begin
    if host.json_to_text(candidates.item(position)) = 'true' then
      selected := position;
    position := position + 1
  end;
  if selected < 0 then
    return envelope(true, 404, '{"error":"File not found"}');

  responseDoc.load('{}');
  responseDoc.setInteger('selectedIndex', selected);
  body := responseDoc.serialize();
  return envelope(true, 200, body)
end
end.
