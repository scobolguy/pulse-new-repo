program "SchemaPaths";

function SchemaPath_Normalize(value: string): string;
var parts: string;
    normalized: string;
    part: string;
    index: integer;
    count: integer;
begin
  value := host.text_trim(value);
  if host.string_index(host.string_lower(value), 'root') = 0 then
  begin
    value := host.string_slice(value, 4, 1000000);
    if host.string_index(value, '.') = 0 then value := host.string_slice(value, 1, 1000000)
  end;
  parts := host.text_split(value, '.');
  count := host.json_array_count(parts);
  normalized := '';
  index := 0;
  while index < count do
  begin
    part := host.text_trim(host.json_to_text(host.json_array_get(parts, index)));
    if part <> '' then
    begin
      if normalized <> '' then normalized := normalized + '.';
      normalized := normalized + part
    end;
    index := index + 1
  end;
  return normalized
end;

begin
end.
