service 'pulse-data-librarian-http-upload';
use "JSON";
var request: JSONDocument;
    responseDoc: JSONDocument;
    bodyDoc: JSONDocument;
    method: string;
    routePath: string;
    destination: string;
    filename: string;
    errorMessage: string;
    status: integer;

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
  if method <> 'POST' then return envelope(false, 200, 'null');
  if routePath <> '/api/librarian/upload/:dest' then return envelope(false, 200, 'null');

  destination := request.text('dest');
  filename := request.text('filename');
  if (destination <> 'schemas') and (destination <> 'data') then
  begin
    bodyDoc.load('{}');
    bodyDoc.setText('error', 'dest must be "schemas" or "data"');
    return envelope(true, 400, bodyDoc.serialize())
  end;
  if filename = '' then
    return envelope(true, 400, '{"error":"x-filename header is required"}');
  if (host.string_index(filename, '/') >= 0) or
     (host.string_index(filename, '\\') >= 0) or
     (host.string_index(filename, '..') >= 0) then
    return envelope(true, 400, '{"error":"Invalid filename"}');
  if request.intValue('safe') = 0 then
    return envelope(true, 403, '{"error":"Access denied"}');

  if request.text('error') <> '' then
  begin
    bodyDoc.load('{}');
    bodyDoc.setText('error', request.text('error'));
    return envelope(true, 500, bodyDoc.serialize())
  end;

  bodyDoc.load('{}');
  bodyDoc.setText('status', 'ok');
  bodyDoc.setText('filename', filename);
  bodyDoc.setText('dest', destination);
  bodyDoc.setInteger('size', request.intValue('size'));
  return envelope(true, 200, bodyDoc.serialize())
end
end.
