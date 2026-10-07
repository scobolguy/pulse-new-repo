service 'pulse-data-librarian-subschema-policy';
use "JSON";
var request: JSONDocument;

function sameField(field: string; candidate: string): integer;
begin
  if field = candidate then return 1;
  return 0
end;

post '/validate-field';
begin
  request.raw := host.event_body();
  if JSON_ContainsEncodedToken(
    request.value('availableFields'),
    request.text('fieldToken')
  ) then return '{"valid":true}';
  return '{"valid":false}'
end

post '/compare-field';
begin
  request.raw := host.event_body();
  if sameField(
    request.text('field'),
    request.text('candidate')
  ) = 1 then return '{"valid":true}';
  return '{"valid":false}'
end
end.
