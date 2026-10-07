service 'pulse-data-librarian-catalog-store';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    response: JSONDocument;
    content: string;
    entries: JSONArray;
    current: JSONArray;
    entry: JSONDocument;
    definition: JSONDocument;
    operation: string;
    identity: string;
    found: integer;
    position: integer;
    total: integer;

function subschemaConflict(message: string; status: integer): string;
begin
  host.http_status(status);
  response.load('{}');
  response.setText('error', message);
  return response.serialize()
end;

function findSubschema(identity: string): integer;
var position: integer;
    entry: JSONDocument;
    total: integer;
begin
  position := 0;
  total := entries.count();
  while position < total do
  begin
    entry.load(entries.item(position));
    if entry.text('id') = identity then return position;
    position := position + 1
  end;
  return -1
end;

function catalogPath(name: string): string;
begin
  if name = 'subschemas' then return 'subschemas.json';
  if name = 'schema-lifecycle' then return 'schema-lifecycle.json';
  if name = 'data-types' then return 'data-types.json';
  if name = 'mapper-rulesets' then return 'mapper-rulesets.json';
  host.raise_error('Unknown Librarian catalog');
  return ''
end;

post '/read';
begin
  request.load(host.event_body());
  content := host.fs_read_text('catalog', catalogPath(request.text('catalog')));
  response.load('{}');
  response.embed('value', content);
  return response.serialize()
end

post '/read-legacy-data-types';
begin
  content := host.fs_read_text('legacy', 'data-types.json');
  response.load('{}');
  response.embed('value', content);
  return response.serialize()
end

post '/write';
begin
  request.load(host.event_body());
  content := request.text('content');
  response.load('{}');
  response.embed('value', content);
  host.fs_write_text('catalog', catalogPath(request.text('catalog')), content);
  return '{"stored":true}'
end

post '/subschemas/mutate';
begin
  request.load(host.event_body());
  operation := request.text('operation');
  if (operation <> 'create') and (operation <> 'update') and
     (operation <> 'delete') and (operation <> 'rename-parent') then
    return subschemaConflict('Unknown subschema operation', 400);
  current.load('[]');
  if host.fs_exists('catalog', 'subschemas.json') = 1 then
    current.load(host.fs_read_text('catalog', 'subschemas.json'));
  if current.formatted(0) <> host.json_format(request.value('expected'), 0) then
  begin
    host.http_status(409);
    return '{"error":"Subschema catalog changed; retry the request","retry":true}'
  end;
  entries.load(request.value('entries'));
  if entries.count() <> current.count() then
    return subschemaConflict('Invalid normalized subschema snapshot', 400);
  if operation = 'rename-parent' then
  begin
    position := 0;
    total := entries.count();
    found := 0;
    while position < total do
    begin
      entry.load(entries.item(position));
      if entry.text('parentSchemaPath') = request.text('previousPath') then
      begin
        entry.setText('parentSchemaPath', request.text('nextPath'));
        entries.replace(position, entry.serialize());
        found := 1
      end;
      position := position + 1
    end;
    if found = 1 then
      host.fs_write_text('catalog', 'subschemas.json', entries.formatted(2));
    return '{"stored":true}'
  end;
  identity := request.text('id');
  found := findSubschema(identity);
  if operation = 'create' then
  begin
    definition.load(request.value('definition'));
    identity := definition.text('id');
    if findSubschema(identity) >= 0 then
      return subschemaConflict('Subschema ' + identity + ' already exists', 409);
    entries.append(definition.serialize())
  end
  else
  begin
    if found < 0 then return subschemaConflict('Subschema not found', 404);
    if operation = 'update' then
    begin
      definition.load(request.value('definition'));
      identity := definition.text('id');
      position := 0;
      total := entries.count();
      while position < total do
      begin
        entry.load(entries.item(position));
        if (position <> found) and (entry.text('id') = identity) then
          return subschemaConflict('Subschema ' + identity + ' already exists', 409);
        position := position + 1
      end;
      entries.replace(found, definition.serialize())
    end
    else
    begin
      position := entries.count() - 1;
      while position >= 0 do
      begin
        entry.load(entries.item(position));
        if entry.text('id') = identity then entries.remove(position);
        position := position - 1
      end
    end
  end;
  host.fs_write_text('catalog', 'subschemas.json', entries.formatted(2));
  response.load('{}');
  response.setBoolean('stored', true);
  if operation <> 'delete' then response.embed('definition', definition.serialize());
  return response.serialize()
end
end.
