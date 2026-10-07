service 'pulse-data-librarian-xsd-parser';
use "XML";
use "JSON";
use "JSONArrays";
var document: XMLDocument;
    simpleTypes: JSONDocument;
    schemaNamespace: string;
    root: JSONDocument;
    children: JSONArray;

function isSchemaNode(node: integer): boolean;
begin
  return document.namespaceURI(node) = 'http://www.w3.org/2001/XMLSchema'
end;

procedure collectSimpleTypes();
var node: integer;
    cursor: integer;
    ending: integer;
    name: string;
    values: JSONArray;
begin
  simpleTypes.load('{}');
  node := 0;
  while node < document.count() do
  begin
    if isSchemaNode(node) and (document.localName(node) = 'simpleType') then
    begin
      name := document.attribute(node, 'name');
      if name <> '' then
      begin
        values.load('[]');
        cursor := node + 1;
        ending := document.subtreeEnd(node);
        while cursor < ending do
        begin
          if isSchemaNode(cursor) and (document.localName(cursor) = 'enumeration') then
            values.append(host.json_set('{}', 'value', document.attribute(cursor, 'value')));
          cursor := cursor + 1
        end;
        simpleTypes.embed(name, values.serialize())
      end
    end;
    node := node + 1
  end
end;

function enumValues(name: string): string;
var values: JSONArray;
    result: JSONArray;
    item: JSONDocument;
    position: integer;
    total: integer;
begin
  result.load('[]');
  if host.json_has(simpleTypes.serialize(), name) = 1 then
  begin
    values.load(simpleTypes.value(name));
    position := 0;
    total := values.count();
    while position < total do
    begin
      item.load(values.item(position));
      result.append(item.value('value'));
      position := position + 1
    end
  end;
  return result.serialize()
end;

function buildChildren(parentNode: integer): string;
var cursor: integer;
    tag: string;
    name: string;
    typeName: string;
    values: JSONArray;
    children: JSONArray;
    nested: JSONArray;
    node: JSONDocument;
    position: integer;
    total: integer;
begin
  children.load('[]');
  cursor := document.firstChild(parentNode);
  while cursor >= 0 do
  begin
    tag := document.localName(cursor);
    if isSchemaNode(cursor) and ((tag = 'element') or (tag = 'complexType') or
       (tag = 'sequence') or (tag = 'choice') or (tag = 'all')) then
    begin
      name := document.attribute(cursor, 'name');
      typeName := document.attribute(cursor, 'type');
      node.load('{}');
      if tag = 'element' then
      begin
        if name = '' then name := 'element';
        node.setText('name', name);
        if typeName = '' then node.setText('valueType', 'complex')
        else node.setText('valueType', typeName);
        node.setBoolean('required', document.attributeInteger(cursor, 'minOccurs', 1) > 0);
        values.load('[]');
        if typeName <> '' then
        begin
          if document.qualifiedNamespace(cursor, typeName) = schemaNamespace then
            values.load(enumValues(document.qualifiedLocal(cursor, typeName)))
        end;
        if values.count() > 0 then
        begin
          node.setBoolean('isEnum', true);
          node.embed('enumValues', values.serialize())
        end;
        if typeName = '' then nested.load(buildChildren(cursor))
        else nested.load('[]');
        if nested.count() = 0 then node.setText('kind', 'leaf')
        else node.setText('kind', 'branch');
        node.embed('children', nested.serialize())
      end
      else
      begin
        if tag = 'complexType' then tag := 'complextype';
        if name = '' then name := tag;
        node.setText('name', name);
        node.setText('kind', 'branch');
        node.setText('valueType', tag);
        node.embed('children', buildChildren(cursor))
      end;
      children.append(node.serialize())
    end
    else if isSchemaNode(cursor) and ((tag = 'complexContent') or (tag = 'simpleContent') or
            (tag = 'extension') or (tag = 'restriction')) then
    begin
      nested.load(buildChildren(cursor));
      position := 0;
      total := nested.count();
      while position < total do
      begin
        children.append(nested.item(position));
        position := position + 1
      end
    end;
    cursor := document.nextSibling(cursor)
  end;
  return children.serialize()
end;

post '/parse';
begin
  document.load(host.event_body());
  if (not isSchemaNode(0)) or (document.localName(0) <> 'schema') then return 'null';
  schemaNamespace := document.attribute(0, 'targetNamespace');
  collectSimpleTypes();
  children.load(buildChildren(0));
  if children.count() = 0 then return 'null';
  root.load('{}');
  root.setText('name', 'root');
  root.setText('kind', 'branch');
  root.setText('valueType', 'xsd');
  root.embed('children', children.serialize());
  return root.serialize()
end
end.
