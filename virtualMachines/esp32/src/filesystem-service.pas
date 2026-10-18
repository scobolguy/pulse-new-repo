service 'pulse-filesystem';
use "JSON";
var request: JSONDocument;
    response: JSONDocument;
    item: JSONDocument;
    root: string;
    relativePath: string;
    content: string;
    items: string;
    entryKey: string;
    entryValue: string;
    catalog: string;
    cursor: string;
    kind: string;
    exists: integer;
    handle: integer;
    nodeIndex: integer;
    offset: integer;
    limit: integer;
    total: integer;
    count: integer;
    index: integer;
    schemaKey: string;
    revision: string;
    nodeId: string;
    manifest: JSONDocument;
    fingerprints: integer;
    fingerprint: JSONDocument;
    fileInfo: JSONDocument;

function safePageToken(value: string; alphabet: string; maximum: integer): boolean;
var position: integer;
    character: string;
begin
  if value = '' then return false;
  position := 0;
  character := host.text_slice(value, position, 1);
  while (character <> '') and (position < maximum) do
  begin
    if host.text_index(alphabet, character) < 0 then return false;
    position := position + 1;
    character := host.text_slice(value, position, 1)
  end;
  return character = ''
end;

function validReadRoot(root: string): integer;
begin
  if (root = 'catalog') or (root = 'schemas') or (root = 'isam') then return 1;
  return 0
end;

function validCatalogPath(relativePath: string): integer;
begin
  if (relativePath = 'subschemas.json') or
     (relativePath = 'schema-lifecycle.json') or
     (relativePath = 'data-types.json') or
     (relativePath = 'mapper-rulesets.json') then return 1;
  return 0
end;

function catalogFile(catalog: string): string;
begin
  if catalog = 'subschemas' then return 'subschemas.json';
  if catalog = 'schema-lifecycle' then return 'schema-lifecycle.json';
  if catalog = 'data-types' then return 'data-types.json';
  if catalog = 'mapper-rulesets' then return 'mapper-rulesets.json';
  return ''
end;

get '/health';
begin
  return '{"status":"ok","service":"filesystem"}'
end

post '/health';
begin
  return '{"status":"ok","service":"filesystem"}'
end

post '/catalogs';
begin
  return '{"catalogs":["data-types","subschemas","schema-lifecycle","mapper-rulesets"]}'
end

post '/catalog/page';
begin
  request.load(host.event_body());
  catalog := request.text('catalog');
  relativePath := catalogFile(catalog);
  offset := request.intValue('offset');
  limit := request.intValue('limit');
  if (relativePath = '') or (offset < 0) or (offset > 10000) or (limit < 1) or (limit > 4) then
  begin
    host.http_status(400);
    return '{"error":"Invalid catalog page request"}'
  end;
  if host.fs_exists('catalog', relativePath) = 0 then
  begin
    host.http_status(404);
    return '{"error":"Catalog file not found"}'
  end;
  content := host.fs_read_text('catalog', relativePath);
  handle := host.json_parse_value(content);
  kind := host.json_node_kind(handle, 0);
  if kind = 'array' then total := host.json_node_count(handle, 0)
  else if kind = 'object' then total := host.json_node_object_count(handle, 0)
  else
  begin
    host.http_status(422);
    return '{"error":"Catalog must contain an array or object"}'
  end;
  if offset > total then
  begin
    host.http_status(400);
    return '{"error":"Catalog page offset exceeds entry count"}'
  end;
  count := limit;
  if offset + count > total then count := total - offset;
  items := '[';
  index := 0;
  while index < count do
  begin
    if index > 0 then items := items + ',';
    if kind = 'array' then
    begin
      nodeIndex := host.json_node_item(handle, 0, offset + index);
      items := items + host.json_node_value(handle, nodeIndex)
    end
    else
    begin
      entryKey := host.json_node_key(handle, 0, offset + index);
      nodeIndex := host.json_node_member(handle, 0, entryKey);
      entryValue := host.json_node_value(handle, nodeIndex);
      item.load('{}');
      item.setText('key', entryKey);
      item.embed('value', entryValue);
      items := items + item.serialize()
    end;
    index := index + 1
  end;
  items := items + ']';
  response.load('{}');
  response.setText('catalog', catalog);
  response.setInteger('offset', offset);
  response.setInteger('limit', limit);
  response.setInteger('total', total);
  response.setBoolean('hasMore', offset + count < total);
  response.embed('items', items);
  return response.serialize()
end

post '/schemas/page';
begin
  request.load(host.event_body());
  relativePath := request.text('path');
  cursor := request.text('cursor');
  limit := request.intValue('limit');
  if (limit < 1) or (limit > 8) then
  begin
    host.http_status(400);
    return '{"error":"Invalid schema page limit"}'
  end;
  return host.fs_list('schemas', relativePath, cursor, limit)
end

post '/schema-tree/page';
begin
  request.load(host.event_body());
  schemaKey := request.text('schemaKey');
  revision := '';
  nodeId := 'n0';
  cursor := '0';
  if host.json_has(request.serialize(), 'revision') = 1 then revision := request.text('revision');
  if host.json_has(request.serialize(), 'nodeId') = 1 then nodeId := request.text('nodeId');
  if host.json_has(request.serialize(), 'cursor') = 1 then cursor := request.text('cursor');
  if nodeId = '' then nodeId := 'n0';
  if cursor = '' then cursor := '0';
  if not safePageToken(schemaKey, '0123456789abcdef', 64) or
     (host.text_slice(schemaKey, 63, 1) = '') or
     not safePageToken(nodeId, 'n0123456789abcdefghijklmnopqrstuvwxyz.', 512) or
     (host.text_slice(nodeId, 0, 2) <> 'n0') or
     (host.text_index(nodeId, '..') >= 0) or
     not safePageToken(cursor, '0123456789', 8) then
  begin
    host.http_status(400);
    return '{"error":"Invalid schema tree page request"}'
  end;
  relativePath := schemaKey + '/current.json';
  if host.fs_exists('schema-pages', relativePath) = 0 then
  begin
    host.http_status(404);
    return '{"error":"Schema tree pages are not published"}'
  end;
  manifest.load(host.fs_read_text('schema-pages', relativePath));
  if (manifest.text('format') <> 'pulse-schema-pages') or
     (manifest.intValue('version') <> 1) or (manifest.text('schemaKey') <> schemaKey) then
  begin
    host.http_status(422);
    return '{"error":"Invalid schema tree manifest"}'
  end;
  if (revision <> '') and (revision <> manifest.text('revision')) then
  begin
    host.http_status(409);
    return '{"error":"Schema tree revision changed; reload the root"}'
  end;
  revision := manifest.text('revision');
  if not safePageToken(revision, '0123456789abcdef', 64) or
     (host.text_slice(revision, 63, 1) = '') then
  begin
    host.http_status(422);
    return '{"error":"Invalid schema tree revision"}'
  end;
  fingerprints := host.json_parse_value(manifest.value('files'));
  total := host.json_node_count(fingerprints, 0);
  index := 0;
  while index < total do
  begin
    nodeIndex := host.json_node_item(fingerprints, 0, index);
    fingerprint.load(host.json_node_value(fingerprints, nodeIndex));
    root := fingerprint.text('root');
    if (root <> 'schemas') and (root <> 'catalog') then
    begin
      host.http_status(422);
      return '{"error":"Invalid schema tree dependency root"}'
    end;
    relativePath := fingerprint.text('path');
    if host.fs_exists(root, relativePath) = 0 then
    begin
      host.http_status(409);
      return '{"error":"Schema tree source is no longer available"}'
    end;
    fileInfo.load(host.fs_stat(root, relativePath));
    if (fileInfo.value('size') <> fingerprint.value('size')) or
       (fileInfo.text('modifiedAt') <> fingerprint.text('modifiedAt')) then
    begin
      host.http_status(409);
      return '{"error":"Schema tree source changed; republish pages"}'
    end;
    index := index + 1
  end;
  relativePath := schemaKey + '/' + revision + '/' + nodeId + '-' + cursor + '.json';
  if host.fs_exists('schema-pages', relativePath) = 0 then
  begin
    host.http_status(404);
    return '{"error":"Schema tree node or cursor not found"}'
  end;
  content := host.fs_read_text('schema-pages', relativePath);
  if host.bytes_length(host.bytes_from_text(content)) > 1500 then
  begin
    host.http_status(413);
    return '{"error":"Schema tree page capacity exceeded"}'
  end;
  return content
end

post '/read';
begin
  request.load(host.event_body());
  root := request.text('root');
  relativePath := request.text('path');
  if validReadRoot(root) = 0 then
  begin
    host.http_status(403);
    return '{"error":"Storage root is not readable"}'
  end;
  if host.fs_exists(root, relativePath) = 0 then
  begin
    host.http_status(404);
    return '{"error":"Storage file not found"}'
  end;
  content := host.fs_read_text(root, relativePath);
  response.load('{}');
  response.setText('value', content);
  return response.serialize()
end

post '/read-auto';
begin
  request.load(host.event_body());
  root := request.text('root');
  relativePath := request.text('path');
  if root <> 'schemas' then
  begin
    host.http_status(403);
    return '{"error":"Automatic text decoding is restricted to schemas"}'
  end;
  if host.fs_exists(root, relativePath) = 0 then
  begin
    host.http_status(404);
    return '{"error":"Storage file not found"}'
  end;
  content := host.fs_read_text_auto(root, relativePath);
  response.load('{}');
  response.setText('value', content);
  return response.serialize()
end

post '/read-legacy-data-types';
begin
  if host.fs_exists('legacy', 'data-types.json') = 0 then
  begin
    host.http_status(404);
    return '{"error":"Storage file not found"}'
  end;
  content := host.fs_read_text('legacy', 'data-types.json');
  response.load('{}');
  response.setText('value', content);
  return response.serialize()
end

post '/exists-legacy-data-types';
begin
  exists := host.fs_exists('legacy', 'data-types.json');
  response.load('{}');
  response.setBoolean('exists', exists = 1);
  return response.serialize()
end

post '/exists';
begin
  request.load(host.event_body());
  root := request.text('root');
  relativePath := request.text('path');
  if validReadRoot(root) = 0 then
  begin
    host.http_status(403);
    return '{"error":"Storage root is not readable"}'
  end;
  exists := host.fs_exists(root, relativePath);
  response.load('{}');
  response.setBoolean('exists', exists = 1);
  return response.serialize()
end

post '/write';
begin
  request.load(host.event_body());
  if (request.text('root') <> 'catalog') and (request.text('root') <> 'isam') then
  begin
    host.http_status(403);
    return '{"error":"Writes are restricted to catalog and ISAM roots"}'
  end;
  root := request.text('root');
  relativePath := request.text('path');
  if (root = 'catalog') and (validCatalogPath(relativePath) = 0) then
  begin
    host.http_status(403);
    return '{"error":"Catalog writes are restricted to managed catalog files"}'
  end;
  content := request.text('content');
  host.fs_write_text(root, relativePath, content);
  return '{"stored":true}'
end

post '/resolve-relative';
begin
  request.load(host.event_body());
  root := request.text('root');
  if root <> 'schemas' then
  begin
    host.http_status(403);
    return '{"error":"Relative schema resolution is restricted to schemas"}'
  end;
  relativePath := host.fs_resolve_relative(root, request.text('base'), request.text('reference'));
  response.load('{}');
  response.setText('path', relativePath);
  return response.serialize()
end

end.
