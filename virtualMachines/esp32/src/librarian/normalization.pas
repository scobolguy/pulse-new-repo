service 'pulse-data-librarian-normalization';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    response: JSONDocument;
    records: JSONArray;
    normalized: JSONArray;
    warnings: JSONArray;
    currentRecord: JSONDocument;
    other: JSONDocument;
    counts: JSONDocument;
    byIdentity: JSONDocument;
    position: integer;
    nextPosition: integer;
    total: integer;
    catalogHandle: integer;
    raw: string;
    identity: string;
    key: string;
    operation: string;

function truthy(value: string): boolean;
begin
  return (value <> 'null') and (value <> 'false') and (value <> '0') and (value <> '""')
end;

function fieldRaw(value: string; key: string): string;
var item: JSONDocument;
begin
  item.load(value);
  if host.json_has(value, key) = 1 then return item.value(key);
  return 'null'
end;

function fieldText(value: string; key: string): string;
var raw: string;
begin
  raw := fieldRaw(value, key);
  if not truthy(raw) then return '';
  return host.json_to_text(raw)
end;

function slug(value: string): string;
begin
  value := host.string_replace(host.text_trim(value), '[^a-zA-Z0-9]+', 'g', '-');
  return host.string_lower(host.string_replace(value, '^-+|-+$', 'g', ''))
end;

function isoType(value: string): boolean;
var prefixes: JSONArray;
    index: integer;
    prefix: string;
begin
  prefixes.load('["pacs","camt","pain","head","remt","acmt","admi","auth","caaa","caam","cain","catm","catp","reda","secl","seev","semt","tsin"]');
  index := 0;
  while index < prefixes.count() do
  begin
    prefix := host.json_to_text(prefixes.item(index));
    if (value = prefix) or (host.string_index(value, prefix + '.') = 0) or
       (host.string_index(value, prefix + '-') = 0) then return true;
    index := index + 1
  end;
  return false
end;

function uniqueTexts(values: string): string;
var items: JSONArray;
    result: JSONArray;
    seen: JSONDocument;
    raw: string;
    value: string;
    index: integer;
    key: string;
begin
  items.load(values);
  result.load('[]');
  seen.load('{}');
  index := 0;
  while index < items.count() do
  begin
    raw := items.item(index);
    value := '';
    if truthy(raw) then value := host.text_trim(host.json_to_text(raw));
    if value <> '' then
    begin
      key := host.text_hash(value);
      if host.json_has(seen.serialize(), key) = 0 then
      begin
        result.append(host.json_value(host.json_set('{}', 'value', value), 'value'));
        seen.setBoolean(key, true)
      end
    end;
    index := index + 1
  end;
  return result.serialize()
end;

function aliases(previous: string; added: string): string;
var result: JSONArray;
    existing: JSONArray;
    index: integer;
begin
  result.load(added);
  if host.json_kind(previous) = 'array' then
  begin
    existing.load(previous);
    index := 0;
    while index < existing.count() do
    begin
      result.append(existing.item(index));
      index := index + 1
    end
  end;
  return uniqueTexts(result.serialize())
end;

function normalizeType(value: string): string;
var item: JSONDocument;
    added: JSONArray;
    id: string;
    logical: string;
    canonical: string;
    originalCanonical: string;
    label: string;
    name: string;
    raw: string;
begin
  if (host.json_kind(value) <> 'object') and (host.json_kind(value) <> 'array') then return 'null';
  item.load(host.json_object(value));
  logical := fieldText(item.serialize(), 'logicalId');
  if logical = '' then logical := fieldText(item.serialize(), 'id');
  logical := host.string_lower(host.text_trim(logical));
  id := fieldText(item.serialize(), 'id');
  if id = '' then id := logical;
  id := host.string_lower(host.text_trim(id));
  if id = '' then return 'null';
  if logical = '' then logical := id;
  originalCanonical := host.string_lower(host.text_trim(fieldText(item.serialize(), 'canonicalId')));
  canonical := originalCanonical;
  name := slug(logical);
  if name = '' then name := 'unnamed';
  if host.string_index(canonical, 'type:') <> 0 then canonical := 'type:' + name;
  item.setText('id', id);
  item.setText('logicalId', logical);
  item.setText('canonicalId', canonical);
  added.load('[]');
  added.append(host.json_value(host.json_set('{}', 'value', logical), 'value'));
  added.append(host.json_value(host.json_set('{}', 'value', id), 'value'));
  added.append(host.json_value(host.json_set('{}', 'value', canonical), 'value'));
  added.append(host.json_value(host.json_set('{}', 'value', slug(logical)), 'value'));
  if originalCanonical = '' then originalCanonical := canonical;
  added.append(host.json_value(host.json_set('{}', 'value', originalCanonical), 'value'));
  item.embed('aliases', aliases(fieldRaw(item.serialize(), 'aliases'), added.serialize()));
  added.load('[]');
  added.append(host.json_value(host.json_set('{}', 'value', logical), 'value'));
  added.append(host.json_value(host.json_set('{}', 'value', id), 'value'));
  added.append(host.json_value(host.json_set('{}', 'value', canonical), 'value'));
  item.embed('aliases', aliases(item.value('aliases'), added.serialize()));
  label := host.text_trim(fieldText(item.serialize(), 'label'));
  if label = '' then label := logical;
  item.setText('label', label);
  item.setBoolean('builtin', fieldRaw(item.serialize(), 'builtin') = 'true');
  raw := fieldRaw(item.serialize(), 'isIso');
  if host.json_kind(raw) = 'boolean' then item.embed('isIso', raw)
  else item.setBoolean('isIso', isoType(id));
  return item.serialize()
end;

function patterns(value: string): string;
var items: JSONArray;
    result: JSONArray;
    index: integer;
    raw: string;
    text: string;
begin
  if host.json_kind(value) = 'array' then items.load(value)
  else
  begin
    text := '';
    if truthy(value) then text := host.json_to_text(value);
    items.load(host.text_split(text, ','))
  end;
  result.load('[]');
  index := 0;
  while index < items.count() do
  begin
    raw := items.item(index);
    text := '';
    if truthy(raw) then text := host.string_lower(host.text_trim(host.json_to_text(raw)));
    text := host.string_replace(text, '\s+', 'g', '');
    result.append(host.json_value(host.json_set('{}', 'value', text), 'value'));
    index := index + 1
  end;
  return uniqueTexts(result.serialize())
end;

function rulesetId(value: string): string;
begin
  value := host.string_replace(host.string_upper(host.text_trim(value)), '[^A-Z0-9_]', 'g', '_');
  value := host.string_replace(value, '_{2,}', 'g', '_');
  return host.string_replace(value, '^_+|_+$', 'g', '')
end;

function sortRulesets(value: string): string;
var handle: integer;
    count: integer;
    width: integer;
    runStart: integer;
    left: integer;
    right: integer;
    middle: integer;
    limit: integer;
    index: integer;
    leftNode: integer;
    rightNode: integer;
    comparison: integer;
    order: JSONArray;
    merged: JSONArray;
    result: JSONArray;
begin
  handle := host.json_parse_value(value);
  count := host.json_node_count(handle, 0);
  order.load('[]');
  index := 0;
  while index < count do
  begin
    order.append(host.json_value(host.json_set('{}', 'value', index), 'value'));
    index := index + 1
  end;
  width := 1;
  while width < count do
  begin
    merged.load('[]');
    runStart := 0;
    while runStart < count do
    begin
      middle := runStart + width;
      if middle > count then middle := count;
      limit := middle + width;
      if limit > count then limit := count;
      left := runStart;
      right := middle;
      while (left < middle) or (right < limit) do
      begin
        comparison := 1;
        if left >= middle then comparison := -1
        else if right < limit then
        begin
          leftNode := host.json_node_item(handle, 0, host.json_integer('{"value":' + order.item(left) + '}', 'value'));
          rightNode := host.json_node_item(handle, 0, host.json_integer('{"value":' + order.item(right) + '}', 'value'));
          comparison := host.number_compare(
            host.json_node_value(handle, host.json_node_member(handle, leftNode, 'priority')),
            host.json_node_value(handle, host.json_node_member(handle, rightNode, 'priority')));
          if comparison = 0 then comparison := 0 - host.string_compare(
            host.json_to_text(host.json_node_value(handle, host.json_node_member(handle, leftNode, 'id'))),
            host.json_to_text(host.json_node_value(handle, host.json_node_member(handle, rightNode, 'id'))))
        end;
        if comparison >= 0 then
        begin
          merged.append(order.item(left));
          left := left + 1
        end
        else
        begin
          merged.append(order.item(right));
          right := right + 1
        end
      end;
      runStart := limit
    end;
    order.load(merged.serialize());
    width := width * 2
  end;
  result.load('[]');
  index := 0;
  while index < count do
  begin
    result.append(host.json_node_value(handle, host.json_node_item(
      handle, 0, host.json_integer('{"value":' + order.item(index) + '}', 'value'))));
    index := index + 1
  end;
  return result.serialize()
end;

function normalizeRuleset(value: string): string;
var item: JSONDocument;
    result: JSONDocument;
    sourcePatterns: JSONArray;
    targetPatterns: JSONArray;
    id: string;
    label: string;
    priority: string;
begin
  item.load('{}');
  if (host.json_kind(value) = 'object') or (host.json_kind(value) = 'array') then item.load(host.json_object(value));
  id := rulesetId(fieldText(item.serialize(), 'id'));
  label := host.text_trim(fieldText(item.serialize(), 'label'));
  sourcePatterns.load(patterns(fieldRaw(item.serialize(), 'sourcePatterns')));
  targetPatterns.load(patterns(fieldRaw(item.serialize(), 'targetPatterns')));
  if id = '' then return '{"error":"id is required"}';
  if label = '' then return '{"error":"label is required"}';
  if sourcePatterns.count() = 0 then return '{"error":"sourcePatterns must include at least one pattern"}';
  if targetPatterns.count() = 0 then return '{"error":"targetPatterns must include at least one pattern"}';
  priority := fieldRaw(item.serialize(), 'priority');
  if priority = 'null' then priority := '"0"';
  result.load('{}');
  result.setText('id', id);
  result.setText('label', label);
  result.setText('description', host.text_trim(fieldText(item.serialize(), 'description')));
  result.embed('sourcePatterns', sourcePatterns.serialize());
  result.embed('targetPatterns', targetPatterns.serialize());
  result.setBoolean('recommended', fieldRaw(item.serialize(), 'recommended') = 'true');
  result.embed('priority', host.number_parse_integer(host.json_to_text(priority)));
  return result.serialize()
end;

post '/normalize';
begin
  request.load(host.event_body());
  operation := request.text('operation');
  response.load('{}');
  raw := request.value('value');
  if operation = 'type-record' then response.embed('value', normalizeType(raw))
  else if operation = 'ruleset-id' then response.setText('value', rulesetId(host.json_to_text(raw)))
  else if operation = 'create-type' then
  begin
    currentRecord.load(raw);
    identity := host.string_replace(host.string_lower(fieldText(raw, 'id')), '[^a-z0-9-]', 'g', '-');
    other.load('{}');
    other.setText('id', identity);
    other.setText('label', fieldText(raw, 'label'));
    other.setBoolean('builtin', false);
    raw := fieldRaw(currentRecord.serialize(), 'isIso');
    if host.json_kind(raw) = 'boolean' then other.embed('isIso', raw)
    else other.setBoolean('isIso', isoType(identity));
    currentRecord.load('{}');
    currentRecord.setText('id', identity);
    currentRecord.embed('record', normalizeType(other.serialize()));
    response.embed('value', currentRecord.serialize())
  end
  else if operation = 'ruleset' then
  begin
    currentRecord.load(normalizeRuleset(raw));
    if host.json_has(currentRecord.serialize(), 'error') = 1 then
    begin
      host.http_status(400);
      return currentRecord.serialize()
    end;
    response.embed('value', currentRecord.serialize())
  end
  else if operation = 'type-catalog' then
  begin
    if host.json_kind(raw) <> 'array' then host.raise_error('Data type catalog must be a JSON array');
    catalogHandle := host.json_parse_value(raw);
    normalized.load('[]');
    counts.load('{}');
    position := 0;
    total := host.json_node_count(catalogHandle, 0);
    while position < total do
    begin
      raw := normalizeType(host.json_node_value(catalogHandle, host.json_node_item(catalogHandle, 0, position)));
      if raw <> 'null' then
      begin
        currentRecord.load(raw);
        key := host.text_hash(currentRecord.text('canonicalId'));
        nextPosition := 0;
        if host.json_has(counts.serialize(), key) = 1 then nextPosition := counts.intValue(key);
        counts.setInteger(key, nextPosition + 1);
        normalized.append(raw)
      end;
      position := position + 1
    end;
    position := 0;
    total := normalized.count();
    catalogHandle := host.json_parse_value(normalized.serialize());
    while position < total do
    begin
      currentRecord.load(host.json_node_value(catalogHandle, host.json_node_item(catalogHandle, 0, position)));
      identity := currentRecord.text('canonicalId');
      key := host.text_hash(identity);
      if counts.intValue(key) > 1 then
      begin
        raw := host.text_hash_utf8(currentRecord.text('logicalId'));
        raw := identity + '-' + host.string_slice(raw, 0, 10);
        currentRecord.setText('canonicalId', raw);
        records.load('[]');
        records.append(host.json_value(host.json_set('{}', 'value', identity), 'value'));
        records.append(host.json_value(host.json_set('{}', 'value', raw), 'value'));
        currentRecord.embed('aliases', aliases(currentRecord.value('aliases'), records.serialize()));
        normalized.replace(position, currentRecord.serialize())
      end;
      position := position + 1
    end;
    response.embed('value', normalized.serialize())
  end
  else if operation = 'ruleset-catalog' then
  begin
    if host.json_kind(raw) <> 'array' then host.raise_error('Mapper ruleset catalog must be a JSON array');
    catalogHandle := host.json_parse_value(raw);
    normalized.load('[]');
    warnings.load('[]');
    byIdentity.load('{}');
    position := 0;
    total := host.json_node_count(catalogHandle, 0);
    while position < total do
    begin
      raw := normalizeRuleset(host.json_node_value(catalogHandle, host.json_node_item(catalogHandle, 0, position)));
      currentRecord.load(raw);
      if host.json_has(raw, 'error') = 1 then
        warnings.append(host.json_value(host.json_set('{}', 'value', currentRecord.text('error')), 'value'))
      else
      begin
        key := host.text_hash(currentRecord.text('id'));
        if host.json_has(byIdentity.serialize(), key) = 1 then normalized.replace(byIdentity.intValue(key), raw)
        else
        begin
          byIdentity.setInteger(key, normalized.count());
          normalized.append(raw)
        end
      end;
      position := position + 1
    end;
    response.embed('value', sortRulesets(normalized.serialize()));
    response.embed('warnings', warnings.serialize())
  end
  else host.raise_error('Unknown Librarian normalization operation');
  return response.serialize()
end
end.
