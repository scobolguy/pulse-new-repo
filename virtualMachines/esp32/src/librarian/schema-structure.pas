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
    swiftDefaults: JSONDocument;

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

function normalizedEnumValue(kind: string; value: string): string;
var
    encoded: JSONDocument;
begin
  if (kind = 'object') or (kind = 'array') then
  begin
    encoded.load('{}');
    encoded.setText('value', value);
    return encoded.value('value')
  end;
  return value
end;

function buildValue(index: integer; name: string): string;
var kind: string;
    position: integer;
    memberIndex: integer;
    itemIndex: integer;
    itemCount: integer;
    childCount: integer;
    enumValues: JSONArray;
    currentNode: JSONDocument;
    currentChildren: JSONArray;
    onlyScalarItems: integer;
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
    enumValues.load('[]');
    onlyScalarItems := 1;
    position := 0;
    while (position < itemCount) and (onlyScalarItems = 1) do
    begin
      itemIndex := host.json_node_item(inputHandle, index, position);
      kind := host.json_node_kind(inputHandle, itemIndex);
      if (kind = 'object') or (kind = 'array') then onlyScalarItems := 0
      else enumValues.append(host.json_node_value(inputHandle, itemIndex));
      position := position + 1
    end;
    if onlyScalarItems = 1 then currentNode.embed('enumValues', enumValues.serialize())
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
    enumItemIndex: integer;
    enumKind: string;
    enumValue: string;
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
    if host.json_node_kind(inputHandle, enumIndex) = 'array' then
    begin
      itemCount := host.json_node_count(inputHandle, enumIndex);
      if itemCount > 0 then
      begin
        currentChildren.load('[]');
        position := 0;
        while position < itemCount do
        begin
          enumItemIndex := host.json_node_item(inputHandle, enumIndex, position);
          enumKind := host.json_node_kind(inputHandle, enumItemIndex);
          enumValue := host.json_node_value(inputHandle, enumItemIndex);
          currentChildren.append(normalizedEnumValue(enumKind, enumValue));
          position := position + 1
        end;
        currentNode.embed('enumValues', currentChildren.serialize())
      end
    end
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

function schemaFilenameMetadata(filename: string): string;
var captures: JSONArray;
    metadata: JSONDocument;
    extracted: string;
    area: string;
    name: string;
    version: string;
    rawType: string;
begin
  metadata.load('{"matched":false}');
  extracted := host.string_replace(filename,
    '^([a-z]{3,4})[.]([0-9]{3})[.]([0-9]{3})[.]([0-9]{2,3})[.]xsd$',
    'i', '$1|$2|$3|$4');
  if extracted <> filename then
  begin
    captures.load(host.text_split(extracted, '|'));
    area := host.string_lower(host.json_to_text(captures.item(0)));
    metadata.load('{"matched":true}');
    metadata.setText('name', area + '.' +
      host.json_to_text(captures.item(1)) + '.' +
      host.json_to_text(captures.item(2)) + '.' +
      host.json_to_text(captures.item(3)));
    metadata.embed('version', host.number_parse_integer(host.json_to_text(captures.item(3))));
    metadata.setText('type', 'xsd');
    metadata.setText('area', area);
    metadata.setText('typeId', area);
    return metadata.serialize()
  end;

  extracted := host.string_replace(filename,
    '^([\w-]+)([.]v([0-9]+))?[.](xsd|avro|json-schema|copybook|cpy|cbl|sql|proto|csv|xml|json)$',
    'i', '$1|$3|$4');
  if extracted = filename then return metadata.serialize();
  captures.load(host.text_split(extracted, '|'));
  name := host.json_to_text(captures.item(0));
  version := host.json_to_text(captures.item(1));
  rawType := host.string_lower(host.json_to_text(captures.item(2)));
  if (rawType = 'copybook') or (rawType = 'cpy') or (rawType = 'cbl') then
    rawType := 'copybook';
  metadata.load('{"matched":true}');
  metadata.setText('name', name);
  if version <> '' then metadata.embed('version', host.number_parse_integer(version))
  else metadata.embed('version', 'null');
  metadata.setText('type', rawType);
  metadata.setText('typeId', host.string_lower(host.text_trim(name)));
  return metadata.serialize()
end;

function swiftFieldTruthy(handle: integer; index: integer): integer;
var kind: string;
    value: string;
begin
  kind := host.json_node_kind(handle, index);
  if kind = 'null' then return 0;
  value := host.json_node_value(handle, index);
  if kind = 'boolean' then
  begin
    if value = 'true' then return 1;
    return 0
  end;
  if kind = 'number' then
  begin
    if host.number_compare(value, '0') = 0 then return 0;
    return 1
  end;
  if kind = 'string' then
  begin
    if host.json_to_text(value) = '' then return 0;
    return 1
  end;
  return 1
end;

function hasSwiftMetadata(index: integer): integer;
var kind: string;
    position: integer;
    count: integer;
    memberIndex: integer;
    messageIndex: integer;
    fieldsIndex: integer;
    childName: string;
    messageType: string;
    messageMatch: string;
begin
  kind := host.json_node_kind(inputHandle, index);
  if kind = 'object' then
  begin
    messageIndex := host.json_node_member(inputHandle, index, 'messageType');
    if messageIndex >= 0 then
    begin
      messageType := host.string_upper(host.json_to_text(
        host.json_node_value(inputHandle, messageIndex)));
      messageMatch := host.string_replace(messageType,
        '^MT[0-9]{3}.*$', 'i', '__swift__');
      if messageMatch = '__swift__' then
      begin
        fieldsIndex := host.json_node_member(inputHandle, index, 'fields');
        if fieldsIndex >= 0 then
        begin
          if host.json_node_kind(inputHandle, fieldsIndex) = 'object' then return 1
        end
      end
    end;
    count := host.json_node_object_count(inputHandle, index);
    position := 0;
    while position < count do
    begin
      childName := host.json_node_key(inputHandle, index, position);
      memberIndex := host.json_node_member(inputHandle, index, childName);
      if hasSwiftMetadata(memberIndex) = 1 then return 1;
      position := position + 1
    end
  end
  else if kind = 'array' then
  begin
    count := host.json_node_count(inputHandle, index);
    position := 0;
    while position < count do
    begin
      memberIndex := host.json_node_item(inputHandle, index, position);
      if hasSwiftMetadata(memberIndex) = 1 then return 1;
      position := position + 1
    end
  end;
  return 0
end;

function enrichSwiftValue(index: integer): string;
var kind: string;
    position: integer;
    count: integer;
    memberIndex: integer;
    messageIndex: integer;
    fieldsIndex: integer;
    fieldIndex: integer;
    fieldName: string;
    messageType: string;
    messageMatch: string;
    isSwiftMessage: integer;
    currentNode: JSONDocument;
    currentArray: JSONArray;
begin
  kind := host.json_node_kind(inputHandle, index);
  if kind = 'object' then
  begin
    messageIndex := host.json_node_member(inputHandle, index, 'messageType');
    isSwiftMessage := 0;
    if messageIndex >= 0 then
    begin
      messageType := host.string_upper(host.json_to_text(
        host.json_node_value(inputHandle, messageIndex)));
      messageMatch := host.string_replace(messageType,
        '^MT[0-9]{3}.*$', 'i', '__swift__');
      if messageMatch = '__swift__' then isSwiftMessage := 1
    end;
    currentNode.load('{}');
    count := host.json_node_object_count(inputHandle, index);
    position := 0;
    while position < count do
    begin
      fieldName := host.json_node_key(inputHandle, index, position);
      fieldIndex := host.json_node_member(inputHandle, index, fieldName);
      if (isSwiftMessage = 1) and (fieldName = 'fields') and
         (host.json_node_kind(inputHandle, fieldIndex) = 'object') then
      begin
        fieldsIndex := fieldIndex;
        currentNode.embed(fieldName, enrichSwiftFields(fieldsIndex))
      end
      else currentNode.embed(fieldName, enrichSwiftValue(fieldIndex));
      position := position + 1
    end;
    return currentNode.serialize()
  end;
  if kind = 'array' then
  begin
    currentArray.load('[]');
    count := host.json_node_count(inputHandle, index);
    position := 0;
    while position < count do
    begin
      memberIndex := host.json_node_item(inputHandle, index, position);
      currentArray.append(enrichSwiftValue(memberIndex));
      position := position + 1
    end;
    return currentArray.serialize()
  end;
  return host.json_node_value(inputHandle, index)
end;

function enrichSwiftField(index: integer; tag: string): string;
var position: integer;
    count: integer;
    memberIndex: integer;
    typeIndex: integer;
    formatIndex: integer;
    lengthIndex: integer;
    fieldName: string;
    defaultsRaw: string;
    defaultType: string;
    defaultFormat: string;
    result: JSONDocument;
    defaults: JSONDocument;
begin
  result.load('{}');
  count := host.json_node_object_count(inputHandle, index);
  position := 0;
  while position < count do
  begin
    fieldName := host.json_node_key(inputHandle, index, position);
    memberIndex := host.json_node_member(inputHandle, index, fieldName);
    result.embed(fieldName, enrichSwiftValue(memberIndex));
    position := position + 1
  end;
  if host.json_has(swiftDefaults.serialize(), host.string_upper(tag)) = 1 then
    defaultsRaw := swiftDefaults.value(host.string_upper(tag))
  else defaultsRaw := '{"type":"string","format":"variable"}';
  defaults.load(defaultsRaw);
  defaultType := defaults.text('type');
  defaultFormat := defaults.text('format');
  typeIndex := host.json_node_member(inputHandle, index, 'type');
  if typeIndex < 0 then result.setText('type', defaultType)
  else if swiftFieldTruthy(inputHandle, typeIndex) = 0 then
    result.setText('type', defaultType);
  formatIndex := host.json_node_member(inputHandle, index, 'format');
  if formatIndex < 0 then result.setText('format', defaultFormat)
  else if swiftFieldTruthy(inputHandle, formatIndex) = 0 then
    result.setText('format', defaultFormat);
  lengthIndex := host.json_node_member(inputHandle, index, 'length');
  if lengthIndex < 0 then
  begin
    if formatIndex >= 0 then
    begin
      if swiftFieldTruthy(inputHandle, formatIndex) = 1 then
        result.embed('length', host.json_node_value(inputHandle, formatIndex))
      else result.setText('length', defaultFormat)
    end
    else result.setText('length', defaultFormat)
  end
  else if swiftFieldTruthy(inputHandle, lengthIndex) = 0 then
  begin
    if formatIndex >= 0 then
    begin
      if swiftFieldTruthy(inputHandle, formatIndex) = 1 then
        result.embed('length', host.json_node_value(inputHandle, formatIndex))
      else result.setText('length', defaultFormat)
    end
    else result.setText('length', defaultFormat)
  end;
  return result.serialize()
end;

function enrichSwiftFields(index: integer): string;
var position: integer;
    count: integer;
    memberIndex: integer;
    fieldName: string;
    currentNode: JSONDocument;
begin
  currentNode.load('{}');
  count := host.json_node_object_count(inputHandle, index);
  position := 0;
  while position < count do
  begin
    fieldName := host.json_node_key(inputHandle, index, position);
    memberIndex := host.json_node_member(inputHandle, index, fieldName);
    if host.json_node_kind(inputHandle, memberIndex) = 'object' then
      currentNode.embed(fieldName, enrichSwiftField(memberIndex, fieldName))
    else currentNode.embed(fieldName, enrichSwiftValue(memberIndex));
    position := position + 1
  end;
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

procedure loadSwiftDefaults();
begin
  swiftDefaults.load(
    '{"16R":{"type":"marker","format":"3!c"},"16S":{"type":"marker","format":"3!c"},' +
    '"20":{"type":"string","format":"16x"},"21":{"type":"string","format":"16x"},' +
    '"21R":{"type":"string","format":"16x"},"22A":{"type":"code","format":"4!c"},' +
    '"22B":{"type":"code","format":"4!c"},"22F":{"type":"code","format":"4!c[/30x]"},' +
    '"23":{"type":"code","format":"4!c"},"23B":{"type":"code","format":"4!c"},' +
    '"26E":{"type":"number","format":"3n"},"30":{"type":"date","format":"6!n (YYMMDD)"},' +
    '"31C":{"type":"date","format":"6!n (YYMMDD)"},"31D":{"type":"composite","format":"6!n29x"},' +
    '"32A":{"type":"composite","format":"6!n3!a15d"},"32B":{"type":"amount","format":"3!a15d"},' +
    '"33B":{"type":"amount","format":"3!a15d"},"35B":{"type":"instrument","format":"4*35x"},' +
    '"36":{"type":"number","format":"15d"},"40A":{"type":"code","format":"24x"},' +
    '"41A":{"type":"bic+code","format":"4!a2!a2!c[3!c]/1!a"},' +
    '"50":{"type":"party","format":"4*35x"},"50A":{"type":"bic","format":"4!a2!a2!c[3!c]"},' +
    '"50F":{"type":"party","format":"4*35x"},"50H":{"type":"party","format":"4*35x"},' +
    '"50K":{"type":"party","format":"/34x and 4*35x"},' +
    '"52A":{"type":"bic","format":"4!a2!a2!c[3!c]"},"53A":{"type":"bic","format":"4!a2!a2!c[3!c]"},' +
    '"54A":{"type":"bic","format":"4!a2!a2!c[3!c]"},"56A":{"type":"bic","format":"4!a2!a2!c[3!c]"},' +
    '"57A":{"type":"bic","format":"4!a2!a2!c[3!c]"},"58A":{"type":"bic","format":"4!a2!a2!c[3!c]"},' +
    '"59":{"type":"party","format":"/34x and 4*35x"},"59A":{"type":"bic","format":"4!a2!a2!c[3!c]"},' +
    '"70":{"type":"text","format":"4*35x"},"70E":{"type":"text","format":"10*35x"},' +
    '"71A":{"type":"code","format":"3!a"},"71B":{"type":"text","format":"6*35x"},' +
    '"71D":{"type":"text","format":"6*35x"},"72":{"type":"text","format":"6*35x"},' +
    '"73":{"type":"text","format":"6*35x"},"75":{"type":"text","format":"35*50x"},' +
    '"76":{"type":"text","format":"35*50x"},"77B":{"type":"text","format":"3*35x"},' +
    '"77C":{"type":"text","format":"35*50x"},"77J":{"type":"text","format":"20*35x"},' +
    '"79":{"type":"text","format":"35*50x"},"97A":{"type":"account","format":"35x"},' +
    '"98A":{"type":"date","format":"8!n"}}'
  )
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
  if hasSwiftMetadata(0) = 1 then
  begin
    loadSwiftDefaults();
    raw := enrichSwiftValue(0);
    inputHandle := host.json_parse_value(raw)
  end;
  return buildValue(0, 'root')
end;

post '/json-schema';
begin
  request.load(host.event_body());
  inputHandle := host.json_parse_value(request.text('content'));
  if hasSwiftMetadata(0) = 1 then
  begin
    loadSwiftDefaults();
    raw := enrichSwiftValue(0);
    inputHandle := host.json_parse_value(raw)
  end;
  return buildSchema(0, 'root')
end;

post '/schema-filename';
begin
  request.load(host.event_body());
  return schemaFilenameMetadata(request.text('filename'))
end

post '/enrich-swift';
begin
  request.load(host.event_body());
  inputHandle := host.json_parse_value(request.text('content'));
  loadSwiftDefaults();
  result.load('{}');
  if hasSwiftMetadata(0) = 1 then
  begin
    result.setBoolean('changed', true);
    result.setText('content', enrichSwiftValue(0))
  end
  else
  begin
    result.setBoolean('changed', false);
    result.setText('content', request.text('content'))
  end;
  return result.serialize()
end
end.
