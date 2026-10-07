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
    catalog: string;
    snapshot: string;
    planned: string;
    document: JSONDocument;
    changes: JSONDocument;
    visibleEntries: JSONArray;
    writeNeeded: boolean;

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

function entryIdentity(value: string; uppercase: boolean): string;
var item: JSONDocument;
    raw: string;
begin
  if host.json_kind(value) <> 'object' then return '';
  item.load(value);
  if host.json_has(value, 'id') = 0 then return '';
  raw := item.value('id');
  if (raw = 'null') or (raw = 'false') or (raw = '0') then return '';
  raw := host.text_trim(host.json_to_text(raw));
  if uppercase then return host.string_upper(raw);
  return host.string_lower(raw)
end;

function findIdentity(values: string; identity: string; uppercase: boolean): integer;
var handle: integer;
    index: integer;
    count: integer;
begin
  handle := host.json_parse_value(values);
  index := 0;
  count := host.json_node_count(handle, 0);
  while index < count do
  begin
    if entryIdentity(host.json_node_value(handle, host.json_node_item(handle, 0, index)), uppercase) = identity then return index;
    index := index + 1
  end;
  return -1
end;

procedure mergePatchFields(fields: string);
var names: JSONArray;
    index: integer;
    key: string;
    raw: string;
begin
  names.load(fields);
  index := 0;
  while index < names.count() do
  begin
    key := host.json_to_text(names.item(index));
    if host.json_has(changes.serialize(), key) = 1 then
    begin
      raw := changes.value(key);
      if raw <> 'null' then definition.embed(key, raw)
    end;
    index := index + 1
  end
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

post '/catalogs/mutate';
begin
  request.load(host.event_body());
  catalog := request.text('catalog');
  operation := request.text('operation');
  if (request.intValue('commit') <> 0) and (request.intValue('commit') <> 1) then
    return subschemaConflict('Invalid catalog mutation phase', 400);
  if (catalog <> 'data-types') and (catalog <> 'mapper-rulesets') and
     (catalog <> 'schema-lifecycle') then return subschemaConflict('Unknown mutation catalog', 400);
  snapshot := '[]';
  if catalog = 'schema-lifecycle' then snapshot := '{}';
  if host.fs_exists('catalog', catalogPath(catalog)) = 1 then
    snapshot := host.fs_read_text('catalog', catalogPath(catalog));
  if host.json_format(snapshot, 0) <> host.json_format(request.value('expected'), 0) then
  begin
    host.http_status(409);
    return '{"error":"Catalog changed; retry the request","retry":true}'
  end;
  response.load('{}');
  writeNeeded := true;
  if catalog = 'schema-lifecycle' then
  begin
    document.load(snapshot);
    identity := request.text('id');
    if operation = 'set' then document.embed(identity, request.value('record'))
    else if operation = 'delete' then
    begin
      writeNeeded := host.json_has(document.serialize(), identity) = 1;
      document.load(host.json_remove(document.serialize(), identity))
    end
    else if operation = 'rename' then
    begin
      writeNeeded := host.json_has(document.serialize(), identity) = 1;
      if writeNeeded then
      begin
        document.embed(request.text('nextId'), document.value(identity));
        document.load(host.json_remove(document.serialize(), identity))
      end
    end
    else return subschemaConflict('Unknown lifecycle operation', 400);
    response.embed('entries', document.serialize());
    if operation = 'set' then response.embed('record', request.value('record'))
  end
  else
  begin
    current.load(snapshot);
    entries.load(request.value('entries'));
    if catalog = 'mapper-rulesets' then
      if current.formatted(0) <> entries.formatted(0) then
        return subschemaConflict('Invalid mapper ruleset snapshot', 400);
    if catalog = 'data-types' then
      if host.json_has(request.serialize(), 'expectedLegacy') = 1 then
      begin
        content := '[]';
        if host.fs_exists('legacy', 'data-types.json') = 1 then content := host.fs_read_text('legacy', 'data-types.json');
        if host.json_format(content, 0) <> host.json_format(request.value('expectedLegacy'), 0) then
        begin
          host.http_status(409);
          return '{"error":"Legacy catalog changed; retry the request","retry":true}'
        end
      end;
    if operation = 'replace' then
    begin
      if catalog <> 'data-types' then return subschemaConflict('Unknown ruleset operation', 400);
      writeNeeded := host.json_format(snapshot, 0) <> entries.formatted(0);
      if entries.count() = 0 then writeNeeded := false
    end
    else
    begin
      if (operation <> 'create') and (operation <> 'update') and
         (operation <> 'rename') and (operation <> 'delete') then
        return subschemaConflict('Unknown catalog operation', 400);
      identity := request.text('id');
      visibleEntries.load(entries.serialize());
      if catalog = 'mapper-rulesets' then visibleEntries.load(request.value('visible'));
      found := findIdentity(visibleEntries.serialize(), identity, catalog = 'mapper-rulesets');
      if operation = 'create' then
      begin
        if found >= 0 then
        begin
          if catalog = 'data-types' then return subschemaConflict('Type ' + identity + ' already exists', 409);
          return subschemaConflict('Ruleset ' + identity + ' already exists', 409)
        end;
        definition.load(request.value('record'));
        found := entries.count();
        entries.append(definition.serialize())
      end
      else
      begin
        if found < 0 then
        begin
          if catalog = 'data-types' then return subschemaConflict('Type not found', 404);
          return subschemaConflict('Ruleset not found', 404)
        end;
        if operation = 'delete' then
        begin
          total := entries.count();
          position := entries.count() - 1;
          while position >= 0 do
          begin
            if entryIdentity(entries.item(position), catalog = 'mapper-rulesets') = identity then entries.remove(position);
            position := position - 1
          end;
          if entries.count() = total then
          begin
            if catalog = 'data-types' then return subschemaConflict('Type not found', 404);
            return subschemaConflict('Ruleset not found', 404)
          end
        end
        else
        begin
          definition.load(visibleEntries.item(found));
          changes.load(request.value('patch'));
          if catalog = 'data-types' then
          begin
            if operation = 'rename' then
            begin
              if changes.text('label') <> '' then definition.setText('label', changes.text('label'))
            end
            else mergePatchFields('["label"]');
            if host.json_has(changes.serialize(), 'isIso') = 1 then
              if host.json_kind(changes.value('isIso')) = 'boolean' then definition.embed('isIso', changes.value('isIso'));
            if operation = 'rename' then
            begin
              definition.setText('id', request.text('nextId'))
            end
          end
          else
          begin
            mergePatchFields('["label","description","sourcePatterns","targetPatterns","recommended","priority"]');
            definition.setText('id', request.text('nextId'))
          end;
          if definition.text('id') <> identity then
          begin
            if (catalog = 'data-types') or (request.intValue('commit') = 1) then
            begin
              if findIdentity(visibleEntries.serialize(), definition.text('id'), catalog = 'mapper-rulesets') >= 0 then
              begin
                if catalog = 'data-types' then return subschemaConflict('Type already exists', 409);
                return subschemaConflict('Ruleset ' + definition.text('id') + ' already exists', 409)
              end
            end
          end;
          found := findIdentity(entries.serialize(), identity, catalog = 'mapper-rulesets');
          if found < 0 then
          begin
            found := entries.count();
            entries.append(definition.serialize())
          end
          else entries.replace(found, definition.serialize())
        end
      end;
      if operation <> 'delete' then
      begin
        response.embed('record', definition.serialize());
        response.setInteger('index', found)
      end
    end;
    response.embed('entries', entries.serialize())
  end;
  response.setBoolean('writeNeeded', writeNeeded);
  planned := response.serialize();
  if request.intValue('commit') = 0 then return planned;
  if host.json_format(request.value('plan'), 0) <> host.json_format(planned, 0) then
    return subschemaConflict('Catalog mutation plan changed', 400);
  content := request.text('content');
  if host.json_kind(content) <> host.json_kind(response.value('entries')) then
    return subschemaConflict('Invalid normalized catalog shape', 400);
  if catalog <> 'schema-lifecycle' then
    if host.json_array_count(content) <> host.json_array_count(response.value('entries')) then
      return subschemaConflict('Invalid normalized catalog count', 400);
  if catalog = 'schema-lifecycle' then
    if host.json_format(content, 0) <> host.json_format(response.value('entries'), 0) then
      return subschemaConflict('Invalid normalized lifecycle content', 400);
  if writeNeeded then host.fs_write_text('catalog', catalogPath(catalog), content);
  response.setBoolean('stored', true);
  return response.serialize()
end
end.
