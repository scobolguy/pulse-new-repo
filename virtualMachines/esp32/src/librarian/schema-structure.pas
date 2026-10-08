service 'pulse-data-librarian-schema-structure';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    result: JSONDocument;
    node: JSONDocument;
    children: JSONArray;
    inputHandle: integer;
    index: integer;
    childIndex: integer;
    childCount: integer;
    childName: string;
    valueType: string;
    raw: string;
    lines: JSONArray;
    frames: JSONArray;
    frame: JSONDocument;
    parentNode: JSONDocument;
    lineParts: JSONArray;
    currentNode: JSONDocument;
    currentChildren: JSONArray;
    level: string;
    upperLine: string;
    rest: string;
    picPosition: integer;
    hasPic: integer;
    isBranch: integer;
    done: integer;
    partIndex: integer;
    foundPicType: integer;
    foldIndex: integer;
    childNode: JSONDocument;
    topNode: JSONDocument;

function textField(handle: integer; index: integer; name: string): string;
var memberIndex: integer;
begin
  memberIndex := host.json_node_member(handle, index, name);
  if memberIndex < 0 then return '';
  raw := host.json_node_value(handle, memberIndex);
  if host.json_kind(raw) = 'string' then return host.json_to_text(raw);
  return raw
end;

function scalarType(kind: string): string;
begin
  if kind = 'number' then return 'number';
  if kind = 'boolean' then return 'boolean';
  if kind = 'null' then return 'null';
  if kind = 'string' then return 'string';
  return 'unknown'
end;

function schemaType(handle: integer; index: integer): string;
var rawType: string;
    typeHandle: integer;
    memberIndex: integer;
begin
  memberIndex := host.json_node_member(handle, index, 'type');
  if memberIndex >= 0 then
  begin
    rawType := host.json_node_value(handle, memberIndex);
    if host.json_kind(rawType) = 'array' then
    begin
      typeHandle := host.json_parse_value(rawType);
      if host.json_node_count(typeHandle, 0) > 0 then
        return host.string_lower(host.json_to_text(host.json_node_value(typeHandle,
          host.json_node_item(typeHandle, 0, 0))));
    end
    else return host.string_lower(host.json_to_text(rawType))
  end;
  if host.json_node_member(handle, index, 'enum') >= 0 then return 'enum';
  if host.json_node_member(handle, index, 'properties') >= 0 then return 'object';
  if host.json_node_member(handle, index, 'items') >= 0 then return 'array';
  return 'unknown'
end;

function buildValue(index: integer; name: string): string;
var kind: string;
    position: integer;
    memberIndex: integer;
    itemIndex: integer;
    itemCount: integer;
    enumValues: JSONArray;
    currentNode: JSONDocument;
    currentChildren: JSONArray;
begin
  kind := host.json_node_kind(inputHandle, index);
  currentNode.load('{}');
  currentNode.setText('name', name);
  if kind = 'object' then
  begin
    currentNode.setText('kind', 'branch');
    currentNode.setText('valueType', 'object');
    currentChildren.load('[]');
    childCount := host.json_node_object_count(inputHandle, index);
    position := 0;
    while position < childCount do
    begin
      childName := host.json_node_key(inputHandle, index, position);
      memberIndex := host.json_node_member(inputHandle, index, childName);
      currentChildren.append(buildValue(memberIndex, childName));
      position := position + 1
    end;
    currentNode.embed('children', currentChildren.serialize())
  end
  else if kind = 'array' then
  begin
    currentNode.setText('kind', 'branch');
    currentNode.setText('valueType', 'array');
    itemCount := host.json_node_count(inputHandle, index);
    if itemCount > 0 then
    begin
      itemIndex := host.json_node_item(inputHandle, index, 0);
      currentChildren.load('[]');
      currentChildren.append(buildValue(itemIndex, '[0]'));
      currentNode.embed('children', currentChildren.serialize())
    end
    else currentNode.embed('children', '[]');
    if itemCount > 0 then
    begin
      enumValues.load('[]');
      position := 0;
      while position < itemCount do
      begin
        itemIndex := host.json_node_item(inputHandle, index, position);
        kind := host.json_node_kind(inputHandle, itemIndex);
        if (kind = 'object') or (kind = 'array') then position := itemCount
        else
        begin
          enumValues.append(host.json_node_value(inputHandle, itemIndex));
          position := position + 1
        end
      end;
      if position = itemCount then currentNode.embed('enumValues', enumValues.serialize())
    end
  end
  else
  begin
    currentNode.setText('kind', 'leaf');
    currentNode.setText('valueType', scalarType(kind))
  end;
  return currentNode.serialize()
end;

function buildSchema(index: integer; name: string): string;
var kind: string;
    position: integer;
    memberIndex: integer;
    propertiesIndex: integer;
    itemsIndex: integer;
    enumIndex: integer;
    itemCount: integer;
    itemIndex: integer;
    propertyCount: integer;
    currentNode: JSONDocument;
    currentChildren: JSONArray;
begin
  valueType := schemaType(inputHandle, index);
  currentNode.load('{}');
  currentNode.setText('name', name);
  if (valueType = 'object') or (valueType = 'array') then currentNode.setText('kind', 'branch')
  else currentNode.setText('kind', 'leaf');
  currentNode.setText('valueType', valueType);
  enumIndex := host.json_node_member(inputHandle, index, 'enum');
  if enumIndex >= 0 then
  begin
    currentNode.embed('enumValues', host.json_node_value(inputHandle, enumIndex))
  end;
  propertiesIndex := host.json_node_member(inputHandle, index, 'properties');
  if (valueType = 'object') and (propertiesIndex >= 0) then
  begin
    currentChildren.load('[]');
    propertyCount := host.json_node_object_count(inputHandle, propertiesIndex);
    position := 0;
    while position < propertyCount do
    begin
      childName := host.json_node_key(inputHandle, propertiesIndex, position);
      memberIndex := host.json_node_member(inputHandle, propertiesIndex, childName);
      currentChildren.append(buildSchema(memberIndex, childName));
      position := position + 1
    end;
    currentNode.embed('children', currentChildren.serialize())
  end
  else if valueType = 'array' then
  begin
    itemsIndex := host.json_node_member(inputHandle, index, 'items');
    currentChildren.load('[]');
    if itemsIndex >= 0 then
    begin
      kind := host.json_node_kind(inputHandle, itemsIndex);
      if kind = 'array' then
      begin
        itemCount := host.json_node_count(inputHandle, itemsIndex);
        position := 0;
        while position < itemCount do
        begin
          itemIndex := host.json_node_item(inputHandle, itemsIndex, position);
          currentChildren.append(buildSchema(itemIndex, '[' + host.number_parse_integer(
            host.json_to_text(host.json_set('{}', 'value', position))) + ']'));
          position := position + 1
        end
      end
      else currentChildren.append(buildSchema(itemsIndex, '[*]'))
    end;
    currentNode.embed('children', currentChildren.serialize())
  end
  else currentNode.embed('children', '[]');
  return currentNode.serialize()
end;

function makeCopybookFrame(levelValue: string; nodeValue: string): string;
var entry: JSONDocument;
begin
  entry.load('{}');
  entry.setText('level', levelValue);
  entry.embed('node', nodeValue);
  return entry.serialize()
end;

procedure closeCopybookFrame();
begin
  frame.load(frames.item(frames.count() - 1));
  topNode.load(frame.value('node'));
  frames.remove(frames.count() - 1);
  frame.load(frames.item(frames.count() - 1));
  parentNode.load(frame.value('node'));
  currentChildren.load(parentNode.value('children'));
  foldIndex := 0;
  while foldIndex < currentChildren.count() do
  begin
    childNode.load(currentChildren.item(foldIndex));
    if childNode.text('name') = topNode.text('name') then
      currentChildren.replace(foldIndex, topNode.serialize());
    foldIndex := foldIndex + 1
  end;
  parentNode.embed('children', currentChildren.serialize());
  frame.embed('node', parentNode.serialize());
  frames.replace(frames.count() - 1, frame.serialize())
end;

post '/copybook';
begin
  request.load(host.event_body());
  lines.load(host.text_split_lines(request.text('content')));
  frames.load('[]');
  currentNode.load('{}');
  currentNode.setText('name', 'root');
  currentNode.setText('kind', 'branch');
  currentNode.setText('valueType', 'copybook');
  currentNode.embed('children', '[]');
  frames.append(makeCopybookFrame('00', currentNode.serialize()));
  index := 0;
  while index < lines.count() do
  begin
    raw := host.text_trim(host.json_to_text(lines.item(index)));
    upperLine := host.string_upper(raw);
    raw := host.string_replace(raw, '\*.*$', 'g', '');
    lineParts.load(host.text_split_whitespace(host.text_trim(raw)));
    if lineParts.count() >= 2 then
    begin
      level := host.number_parse_integer(host.json_to_text(lineParts.item(0)));
      childName := host.string_lower(host.string_replace(
        host.json_to_text(lineParts.item(1)), '[.]$', 'g', ''));
      upperLine := host.string_upper(raw);
      picPosition := host.string_index(upperLine, ' PIC ');
      hasPic := 0;
      if picPosition >= 0 then hasPic := 1;
      isBranch := 1;
      if hasPic = 1 then isBranch := 0;
      if host.string_index(upperLine, ' OCCURS ') >= 0 then isBranch := 1;
      if host.string_index(upperLine, ' REDEFINES ') >= 0 then isBranch := 1;
      if host.string_index(upperLine, ' DEPENDING ') >= 0 then isBranch := 1;
      if host.string_index(upperLine, ' GROUP ') >= 0 then isBranch := 1;
      currentNode.load('{}');
      currentNode.setText('name', childName);
      if isBranch = 1 then currentNode.setText('kind', 'branch')
      else currentNode.setText('kind', 'leaf');
      if hasPic = 1 then
      begin
        foundPicType := 0;
        partIndex := 2;
        while (partIndex < lineParts.count()) and (foundPicType = 0) do
        begin
          if host.string_upper(host.json_to_text(lineParts.item(partIndex))) = 'PIC' then
          begin
            if partIndex + 1 < lineParts.count() then
              currentNode.setText('valueType', host.string_replace(
                host.string_upper(host.json_to_text(lineParts.item(partIndex + 1))),
                '[.]$', 'g', ''))
            else currentNode.setText('valueType', 'field');
            foundPicType := 1
          end;
          partIndex := partIndex + 1
        end;
        if foundPicType = 0 then currentNode.setText('valueType', 'field')
      end
      else if isBranch = 1 then currentNode.setText('valueType', 'group')
      else currentNode.setText('valueType', 'field');
      currentNode.embed('children', '[]');
      done := 0;
      while (frames.count() > 1) and (done = 0) do
      begin
        frame.load(frames.item(frames.count() - 1));
        if host.number_compare(frame.text('level'), level) < 0 then done := 1
        else closeCopybookFrame()
      end;
      frame.load(frames.item(frames.count() - 1));
      parentNode.load(frame.value('node'));
      currentChildren.load(parentNode.value('children'));
      currentChildren.append(currentNode.serialize());
      parentNode.embed('children', currentChildren.serialize());
      frame.embed('node', parentNode.serialize());
      frames.replace(frames.count() - 1, frame.serialize());
      if isBranch = 1 then frames.append(makeCopybookFrame(level, currentNode.serialize()))
    end;
    index := index + 1
  end;
  while frames.count() > 1 do
    closeCopybookFrame();
  frame.load(frames.item(0));
  return frame.value('node')
end

post '/json-value';
begin
  request.load(host.event_body());
  inputHandle := host.json_parse_value(request.text('content'));
  return buildValue(0, 'root')
end;

post '/json-schema';
begin
  request.load(host.event_body());
  inputHandle := host.json_parse_value(request.text('content'));
  return buildSchema(0, 'root')
end
end.
