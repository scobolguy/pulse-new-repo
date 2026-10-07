service 'pulse-data-librarian-schema-tree';
use "JSON";
use "JSONArrays";
use "SchemaPaths";
var request: JSONDocument;
    frames: JSONArray;
    fields: JSONArray;
    fieldSet: JSONDocument;
    allowed: JSONArray;
    allowedSet: JSONDocument;
    frame: JSONDocument;
    node: JSONDocument;
    childNodes: JSONArray;
    projected: JSONArray;
    result: JSONDocument;
    outputTree: string;
    raw: string;
    parentPath: string;
    currentPath: string;
    name: string;
    valueType: string;
    position: integer;
    top: integer;
    treeHandle: integer;
    nodeIndex: integer;
    childIndex: integer;
    memberIndex: integer;
    childCount: integer;
    project: boolean;
    contributes: boolean;
    visible: boolean;

function fieldText(value: string): string;
begin
  if (value = 'null') or (value = 'false') or (value = '0') then return '';
  return host.json_to_text(value)
end;

function pathVisible(value: string): boolean;
var index: integer;
    field: string;
begin
  if value = '' then return true;
  index := 0;
  while index < allowed.count() do
  begin
    field := host.json_to_text(allowed.item(index));
    if (field = value) or (host.string_index(field, value + '.') = 0) or
       (host.string_index(value, field + '.') = 0) then return true;
    index := index + 1
  end;
  return false
end;

function makeFrame(value: integer; previousPath: string): string;
var entry: JSONDocument;
begin
  entry.load('{}');
  entry.setInteger('node', value);
  entry.setText('parent', previousPath);
  entry.setInteger('index', -1);
  entry.embed('projected', '[]');
  return entry.serialize()
end;

post '/walk';
begin
  request.load(host.event_body());
  project := request.intValue('project') = 1;
  allowed.load('[]');
  allowedSet.load('{}');
  if project then
  begin
    childNodes.load(request.value('accessibleFields'));
    position := 0;
    while position < childNodes.count() do
    begin
      name := SchemaPath_Normalize(fieldText(childNodes.item(position)));
      if name <> '' then
      begin
        raw := host.text_hash(name);
        if host.json_has(allowedSet.serialize(), raw) = 0 then
        begin
          allowed.append(host.json_value(host.json_set('{}', 'value', name), 'value'));
          allowedSet.setBoolean(raw, true)
        end
      end;
      position := position + 1
    end
  end;
  fields.load('[]');
  fieldSet.load('{}');
  frames.load('[]');
  outputTree := 'null';
  raw := request.value('structure');
  treeHandle := host.json_parse_value(raw);
  if (host.json_node_kind(treeHandle, 0) = 'object') or (host.json_node_kind(treeHandle, 0) = 'array') then frames.append(makeFrame(0, ''));
  while frames.count() > 0 do
  begin
    top := frames.count() - 1;
    frame.load(frames.item(top));
    nodeIndex := frame.intValue('node');
    position := frame.intValue('index');
    if position < 0 then
    begin
      name := '';
      valueType := '';
      memberIndex := host.json_node_member(treeHandle, nodeIndex, 'name');
      if memberIndex >= 0 then name := host.text_trim(fieldText(host.json_node_value(treeHandle, memberIndex)));
      memberIndex := host.json_node_member(treeHandle, nodeIndex, 'valueType');
      if memberIndex >= 0 then valueType := host.string_lower(fieldText(host.json_node_value(treeHandle, memberIndex)));
      contributes := (name <> '') and (name <> 'root') and
        (valueType <> 'sequence') and (valueType <> 'choice') and
        (valueType <> 'all') and (valueType <> 'complextype');
      parentPath := frame.text('parent');
      currentPath := parentPath;
      if contributes then
      begin
        if parentPath = '' then currentPath := name
        else currentPath := parentPath + '.' + name;
        raw := host.text_hash(currentPath);
        if host.json_has(fieldSet.serialize(), raw) = 0 then
        begin
          fields.append(host.json_value(host.json_set('{}', 'value', currentPath), 'value'));
          fieldSet.setBoolean(raw, true)
        end
      end;
      visible := (not project) or pathVisible(currentPath);
      frame.setText('path', currentPath);
      frame.setInteger('visible', 0);
      if visible then frame.setInteger('visible', 1);
      frame.setInteger('index', 0);
      frames.replace(top, frame.serialize());
      position := 0
    end;
    childCount := 0;
    childIndex := host.json_node_member(treeHandle, nodeIndex, 'children');
    if childIndex >= 0 then
      if host.json_node_kind(treeHandle, childIndex) = 'array' then
        childCount := host.json_node_count(treeHandle, childIndex);
    if position < childCount then
    begin
      childIndex := host.json_node_item(treeHandle, childIndex, position);
      frame.setInteger('index', position + 1);
      frames.replace(top, frame.serialize());
      if (host.json_node_kind(treeHandle, childIndex) = 'object') or
         (host.json_node_kind(treeHandle, childIndex) = 'array') then
        frames.append(makeFrame(childIndex, frame.text('path')))
    end
    else
    begin
      raw := 'null';
      if project and (frame.intValue('visible') = 1) then
      begin
        node.load(host.json_object(host.json_node_value(treeHandle, nodeIndex)));
        node.embed('children', frame.value('projected'));
        raw := node.serialize()
      end;
      frames.remove(top);
      if frames.count() = 0 then outputTree := raw
      else if project and (raw <> 'null') then
      begin
        top := frames.count() - 1;
        frame.load(frames.item(top));
        projected.load(frame.value('projected'));
        projected.append(raw);
        frame.embed('projected', projected.serialize());
        frames.replace(top, frame.serialize())
      end
    end
  end;
  result.load('{}');
  result.embed('availableFields', fields.serialize());
  if project then result.embed('structure', outputTree);
  return result.serialize()
end
end.
