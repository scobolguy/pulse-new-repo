service 'pulse-data-librarian-xsd-parser';
use "XML";
use "JSON";
use "JSONArrays";
var document: XMLDocument;
    simpleTypes: JSONDocument;
    complexTypes: JSONDocument;
    root: JSONDocument;
    children: JSONArray;
    expandedNodes: integer;
    globalElements: JSONDocument;
    contexts: JSONDocument;
    loadedNamespaces: JSONDocument;
    importedNamespaces: JSONDocument;
    dependencies: JSONArray;
    simpleCache: JSONDocument;
    simpleOperations: integer;

function contextKey(index: integer): string;
begin return host.json_set('{}', 'node', index) end;

function schemaOwner(index: integer): integer;
var ancestor: integer;
begin
  ancestor := document.parentNode(index);
  while ancestor >= 0 do
  begin
    index := ancestor;
    ancestor := document.parentNode(index)
  end;
  return index
end;

function contextNamespace(index: integer): string;
var context: JSONDocument;
begin
  context.load(contexts.value(contextKey(schemaOwner(index))));
  return context.text('namespace')
end;

function referenceNamespace(index: integer; value: string): string;
var result: string;
    context: JSONDocument;
begin
  result := document.qualifiedNamespace(index, value);
  context.load(contexts.value(contextKey(schemaOwner(index))));
  if (result = '') and (context.intValue('chameleon') = 1) then result := context.text('namespace');
  return result
end;

function symbolKey(namespace: string; name: string): string;
begin
  return host.text_hash(host.json_set(host.json_set('{}', 'namespace', namespace), 'name', name))
end;

function namespaceAvailable(index: integer; namespace: string): boolean;
begin
  if namespace = contextNamespace(index) then return true;
  return (host.json_has(importedNamespaces.serialize(), symbolKey(contextNamespace(index), namespace)) = 1)
    and (host.json_has(loadedNamespaces.serialize(), host.text_hash(namespace)) = 1)
end;

function isSchemaNode(node: integer): boolean;
begin
  return document.namespaceURI(node) = 'http://www.w3.org/2001/XMLSchema'
end;

procedure collectTypeDeclarations();
var node: integer;
    name: string;
    namespace: string;
    key: string;
begin
  simpleTypes.load('{}');
  complexTypes.load('{}');
  globalElements.load('{}');
  simpleCache.load('{}');
  simpleOperations := 0;
  node := 0;
  while node < document.count() do
  begin
    if isSchemaNode(node) and (document.parentNode(node) >= 0) and
       (document.parentNode(node) = schemaOwner(node)) then
    begin
      name := document.attribute(node, 'name');
      if name <> '' then
      begin
        namespace := contextNamespace(node);
        key := symbolKey(namespace, name);
        if document.localName(node) = 'complexType' then
        begin
          if host.json_has(complexTypes.serialize(), key) = 1 then
            host.raise_error('Duplicate XSD complex type: ' + name);
          complexTypes.setInteger(key, node)
        end
        else if document.localName(node) = 'element' then
        begin
          if host.json_has(globalElements.serialize(), key) = 1 then
            host.raise_error('Duplicate XSD global element: ' + name);
          globalElements.setInteger(key, node)
        end
      end
    end;
    node := node + 1
  end;
  node := 0;
  while node < document.count() do
  begin
    if isSchemaNode(node) and (document.localName(node) = 'simpleType') and
       (document.parentNode(node) = schemaOwner(node)) then
    begin
      name := document.attribute(node, 'name');
      if name <> '' then
      begin
        key := symbolKey(contextNamespace(node), name);
        if (host.json_has(simpleTypes.serialize(), key) = 1) or
           (host.json_has(complexTypes.serialize(), key) = 1) then
          host.raise_error('Duplicate XSD type: ' + name);
        simpleTypes.setInteger(key, node)
      end
    end;
    node := node + 1
  end
end;

function schemaChild(parentNode: integer; tag: string): integer;
var cursor: integer;
    found: integer;
begin
  found := -1;
  cursor := document.firstChild(parentNode);
  while cursor >= 0 do
  begin
    if isSchemaNode(cursor) and (document.localName(cursor) = tag) then
    begin
      if found >= 0 then host.raise_error('Duplicate XSD child: ' + tag);
      found := cursor
    end;
    cursor := document.nextSibling(cursor)
  end;
  return found
end;

function simpleMetadata(contextNode: integer; qualifiedName: string; definition: integer;
                        depth: integer; ancestors: string): string;
var result: JSONDocument;
    base: JSONDocument;
    reference: JSONDocument;
    active: JSONDocument;
    seen: JSONDocument;
    values: JSONArray;
    members: JSONArray;
    tokens: JSONArray;
    member: JSONDocument;
    item: JSONDocument;
    key: string;
    cacheKey: string;
    namespace: string;
    name: string;
    baseName: string;
    value: string;
    cursor: integer;
    inlineType: integer;
    restriction: integer;
    listNode: integer;
    unionNode: integer;
    position: integer;
    entry: integer;
    finite: boolean;
    complete: boolean;
begin
  result.load('{}');
  result.setText('variety', 'atomic');
  result.setBoolean('finite', false);
  result.embed('enumValues', '[]');
  if qualifiedName <> '' then
  begin
    namespace := referenceNamespace(contextNode, qualifiedName);
    name := document.qualifiedLocal(contextNode, qualifiedName);
    reference.load('{}');
    reference.setText('kind', 'simpleType');
    reference.setText('name', name);
    reference.setText('namespace', namespace);
    if namespace = 'http://www.w3.org/2001/XMLSchema' then
    begin
      result.embed('typeReference', reference.serialize());
      if (name = 'NMTOKENS') or (name = 'IDREFS') or (name = 'ENTITIES') then
      begin
        result.setText('variety', 'list');
        base.load('{}');
        base.setText('variety', 'atomic');
        base.setBoolean('finite', false);
        base.embed('enumValues', '[]');
        if name = 'NMTOKENS' then reference.setText('name', 'NMTOKEN');
        if name = 'IDREFS' then reference.setText('name', 'IDREF');
        if name = 'ENTITIES' then reference.setText('name', 'ENTITY');
        base.embed('typeReference', reference.serialize());
        result.embed('itemType', base.serialize())
      end;
      return result.serialize()
    end;
    if not namespaceAvailable(contextNode, namespace) then
    begin
      result.setBoolean('unresolved', true);
      result.embed('typeReference', reference.serialize());
      return result.serialize()
    end;
    key := symbolKey(namespace, name);
    if host.json_has(simpleTypes.serialize(), key) = 0 then
      host.raise_error('Unresolved local XSD simple type: ' + qualifiedName);
    definition := simpleTypes.intValue(key)
  end;
  if definition < 0 then host.raise_error('Missing XSD simple type definition');
  key := contextKey(definition);
  if host.json_has(ancestors, key) = 1 then
  begin
    result.setBoolean('recursive', true);
    return result.serialize()
  end;
  if depth >= 8 then
  begin
    result.setBoolean('truncated', true);
    result.setText('truncationReason', 'depth');
    return result.serialize()
  end;
  cacheKey := host.json_set(key, 'depth', depth);
  if host.json_has(simpleCache.serialize(), cacheKey) = 1 then return simpleCache.value(cacheKey);
  simpleOperations := simpleOperations + 1;
  if simpleOperations > 10000 then host.raise_error('XSD simple type resolution capacity exceeded');
  active.load(ancestors);
  active.setBoolean(key, true);
  restriction := schemaChild(definition, 'restriction');
  listNode := schemaChild(definition, 'list');
  unionNode := schemaChild(definition, 'union');
  entry := 0;
  if restriction >= 0 then entry := entry + 1;
  if listNode >= 0 then entry := entry + 1;
  if unionNode >= 0 then entry := entry + 1;
  if entry > 1 then host.raise_error('XSD simple type requires a single restriction, list or union');
  if entry = 0 then host.raise_error('XSD simple type requires restriction, list or union');
  if restriction >= 0 then
  begin
    baseName := document.attribute(restriction, 'base');
    inlineType := schemaChild(restriction, 'simpleType');
    if (baseName <> '') and (inlineType >= 0) then host.raise_error('XSD restriction cannot combine base and inline simpleType');
    if (baseName = '') and (inlineType < 0) then host.raise_error('XSD restriction requires a base or inline simpleType');
    base.load(simpleMetadata(restriction, baseName, inlineType, depth + 1, active.serialize()));
    result.merge(base.serialize());
    values.load('[]');
    seen.load('{}');
    cursor := document.firstChild(restriction);
    while cursor >= 0 do
    begin
      if isSchemaNode(cursor) and (document.localName(cursor) = 'enumeration') then
      begin
        if not document.hasAttribute(cursor, 'value') then host.raise_error('XSD enumeration requires value');
        value := document.attribute(cursor, 'value');
        key := host.text_hash(value);
        if host.json_has(seen.serialize(), key) = 0 then
        begin
          values.append(host.json_value(host.json_set('{}', 'value', value), 'value'));
          seen.setBoolean(key, true)
        end
      end;
      cursor := document.nextSibling(cursor)
    end;
    if values.count() > 0 then
    begin
      result.setBoolean('finite', true);
      result.embed('enumValues', values.serialize())
    end
  end
  else if listNode >= 0 then
  begin
    result.setText('variety', 'list');
    baseName := document.attribute(listNode, 'itemType');
    inlineType := schemaChild(listNode, 'simpleType');
    if (baseName <> '') and (inlineType >= 0) then host.raise_error('XSD list cannot combine itemType and inline simpleType');
    if (baseName = '') and (inlineType < 0) then host.raise_error('XSD list requires itemType or inline simpleType');
    base.load(simpleMetadata(listNode, baseName, inlineType, depth + 1, active.serialize()));
    if base.text('variety') = 'list' then host.raise_error('XSD list item cannot be a list type');
    if host.json_has(base.serialize(), 'containsList') = 1 then
      host.raise_error('XSD list item union cannot contain list types');
    result.embed('itemType', base.serialize())
  end
  else if unionNode >= 0 then
  begin
    result.setText('variety', 'union');
    members.load('[]');
    tokens.load(host.text_split_whitespace(document.attribute(unionNode, 'memberTypes')));
    position := 0;
    while position < tokens.count() do
    begin
      item.load(host.json_embed('{}', 'value', tokens.item(position)));
      members.append(simpleMetadata(unionNode, item.text('value'), -1, depth + 1, active.serialize()));
      position := position + 1
    end;
    cursor := document.firstChild(unionNode);
    while cursor >= 0 do
    begin
      if isSchemaNode(cursor) and (document.localName(cursor) = 'simpleType') then
        members.append(simpleMetadata(cursor, '', cursor, depth + 1, active.serialize()));
      cursor := document.nextSibling(cursor)
    end;
    if members.count() = 0 then host.raise_error('XSD union requires member types');
    result.embed('members', members.serialize());
    finite := true;
    complete := true;
    values.load('[]');
    seen.load('{}');
    position := 0;
    while position < members.count() do
    begin
      member.load(members.item(position));
      if (member.text('variety') = 'list') or (host.json_has(member.serialize(), 'containsList') = 1) then
        result.setBoolean('containsList', true);
      if member.value('finite') <> 'true' then finite := false;
      if host.json_has(member.serialize(), 'recursive') = 1 then
      begin result.setBoolean('recursive', true); complete := false end;
      if host.json_has(member.serialize(), 'unresolved') = 1 then
      begin result.setBoolean('unresolved', true); complete := false end;
      if host.json_has(member.serialize(), 'truncated') = 1 then
      begin
        result.setBoolean('truncated', true);
        result.setText('truncationReason', member.text('truncationReason'));
        complete := false
      end;
      tokens.load(member.value('enumValues'));
      entry := 0;
      while entry < tokens.count() do
      begin
        value := tokens.item(entry);
        key := host.text_hash(value);
        if host.json_has(seen.serialize(), key) = 0 then
        begin
          values.append(value);
          seen.setBoolean(key, true)
        end;
        entry := entry + 1
      end;
      position := position + 1
    end;
    if finite and complete then
    begin
      result.setBoolean('finite', true);
      result.embed('enumValues', values.serialize())
    end
  end;
  if listNode >= 0 then
  begin
    if host.json_has(base.serialize(), 'recursive') = 1 then result.setBoolean('recursive', true);
    if host.json_has(base.serialize(), 'unresolved') = 1 then result.setBoolean('unresolved', true);
    if host.json_has(base.serialize(), 'truncated') = 1 then
    begin
      result.setBoolean('truncated', true);
      result.setText('truncationReason', base.text('truncationReason'))
    end
  end;
  if (host.json_has(result.serialize(), 'recursive') = 0) and
     (host.json_has(result.serialize(), 'unresolved') = 0) and
     (host.json_has(result.serialize(), 'truncated') = 0) then
    simpleCache.embed(cacheKey, result.serialize());
  return result.serialize()
end;

function globalElement(contextNode: integer; qualifiedName: string): integer;
var key: string;
begin
  if not namespaceAvailable(contextNode, referenceNamespace(contextNode, qualifiedName)) then return -1;
  key := symbolKey(referenceNamespace(contextNode, qualifiedName), document.qualifiedLocal(contextNode, qualifiedName));
  if host.json_has(globalElements.serialize(), key) = 0 then
    host.raise_error('Unresolved local XSD element: ' + qualifiedName);
  return globalElements.intValue(key)
end;

function buildChildren(parentNode: integer; depth: integer; ancestors: string): string;
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
    declaration: integer;
    typeDeclaration: integer;
    referenceName: string;
    reference: JSONDocument;
    active: JSONDocument;
    key: string;
    recursive: boolean;
    blocked: boolean;
    simple: JSONDocument;
    simpleDeclaration: integer;
    simpleResolved: boolean;
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
      declaration := cursor;
      active.load(ancestors);
      recursive := false;
      blocked := (depth >= 8) or (expandedNodes >= 1000);
      expandedNodes := expandedNodes + 1;
      if tag = 'element' then
      begin
        if parentNode = schemaOwner(cursor) then
          active.setBoolean(host.json_set('{}', 'element', cursor), true);
        referenceName := document.attribute(cursor, 'ref');
        if referenceName <> '' then
        begin
          if (name <> '') or (typeName <> '') then
            host.raise_error('XSD element ref cannot also declare name or type');
          if (schemaChild(cursor, 'simpleType') >= 0) or (schemaChild(cursor, 'complexType') >= 0) then
            host.raise_error('XSD element ref cannot declare an inline type');
          reference.load('{}');
          reference.setText('kind', 'element');
          reference.setText('name', document.qualifiedLocal(cursor, referenceName));
          reference.setText('namespace', referenceNamespace(cursor, referenceName));
          node.embed('reference', reference.serialize());
          name := document.qualifiedLocal(cursor, referenceName);
          declaration := globalElement(cursor, referenceName);
          if declaration >= 0 then
          begin
            key := host.json_set('{}', 'element', declaration);
            recursive := host.json_has(ancestors, key) = 1;
            active.setBoolean(key, true);
            typeName := document.attribute(declaration, 'type')
          end
          else
          begin
            node.setBoolean('unresolved', true);
            typeName := referenceName
          end
        end;
        if name = '' then name := 'element';
        node.setText('name', name);
        if typeName = '' then node.setText('valueType', 'complex')
        else node.setText('valueType', typeName);
        node.setBoolean('required', document.attributeInteger(cursor, 'minOccurs', 1) > 0);
        values.load('[]');
        typeDeclaration := -1;
        simpleDeclaration := -1;
        simple.load('{}');
        if (typeName <> '') and (declaration >= 0) then
        begin
          if (schemaChild(declaration, 'simpleType') >= 0) or (schemaChild(declaration, 'complexType') >= 0) then
            host.raise_error('XSD element type cannot also declare an inline type')
        end;
        if (typeName <> '') and (declaration >= 0) then
        begin
          if namespaceAvailable(declaration, referenceNamespace(declaration, typeName)) then
          begin
            key := symbolKey(referenceNamespace(declaration, typeName), document.qualifiedLocal(declaration, typeName));
            if host.json_has(complexTypes.serialize(), key) = 1 then
            begin
              typeDeclaration := complexTypes.intValue(key);
              reference.load('{}');
              reference.setText('kind', 'complexType');
              reference.setText('name', document.qualifiedLocal(declaration, typeName));
              reference.setText('namespace', referenceNamespace(declaration, typeName));
              node.embed('typeReference', reference.serialize());
              key := host.json_set('{}', 'type', typeDeclaration);
              if host.json_has(active.serialize(), key) = 1 then recursive := true;
              active.setBoolean(key, true)
            end
            else if host.json_has(simpleTypes.serialize(), key) = 1 then
              simpleDeclaration := simpleTypes.intValue(key)
            else host.raise_error('Unresolved local XSD type: ' + typeName)
          end
          else if referenceNamespace(declaration, typeName) <> 'http://www.w3.org/2001/XMLSchema' then
          begin
            reference.load('{}');
            reference.setText('kind', 'type');
            reference.setText('name', document.qualifiedLocal(declaration, typeName));
            reference.setText('namespace', referenceNamespace(declaration, typeName));
            node.embed('typeReference', reference.serialize());
            node.setBoolean('unresolved', true)
          end
        end;
        if (typeName = '') and (declaration >= 0) then
        begin
          simpleDeclaration := schemaChild(declaration, 'simpleType');
          if simpleDeclaration >= 0 then
          begin
            if schemaChild(declaration, 'complexType') >= 0 then
              host.raise_error('XSD element cannot combine simpleType and complexType');
            node.setText('valueType', 'simple')
          end
        end;
        simpleResolved := false;
        if simpleDeclaration >= 0 then
        begin
          simple.load(simpleMetadata(declaration, '', simpleDeclaration, 0, '{}'));
          simpleResolved := true
        end
        else if (typeName <> '') and (declaration >= 0) then
        begin
          if referenceNamespace(declaration, typeName) = 'http://www.w3.org/2001/XMLSchema' then
          begin
            name := document.qualifiedLocal(declaration, typeName);
            if (name = 'NMTOKENS') or (name = 'IDREFS') or (name = 'ENTITIES') then
            begin
              simple.load(simpleMetadata(declaration, typeName, -1, 0, '{}'));
              simpleResolved := true
            end
          end
        end;
        if simpleResolved then
        begin
          values.load(simple.value('enumValues'));
          if simple.text('variety') <> 'atomic' then node.embed('simpleType', simple.serialize());
          if host.json_has(simple.serialize(), 'recursive') = 1 then node.setBoolean('recursive', true);
          if host.json_has(simple.serialize(), 'unresolved') = 1 then
          begin
            node.setBoolean('unresolved', true);
            if host.json_has(simple.serialize(), 'typeReference') = 1 then
              node.embed('typeReference', simple.value('typeReference'))
          end;
          if host.json_has(simple.serialize(), 'truncated') = 1 then
          begin
            node.setBoolean('truncated', true);
            node.setText('truncationReason', simple.text('truncationReason'))
          end;
          if (host.json_has(simple.serialize(), 'recursive') = 1) or
             (host.json_has(simple.serialize(), 'truncated') = 1) then
          begin
            reference.load('{}');
            reference.setText('kind', 'simpleType');
            if typeName = '' then reference.setText('name', 'anonymous')
            else reference.setText('name', document.qualifiedLocal(declaration, typeName));
            reference.setText('namespace', contextNamespace(simpleDeclaration));
            node.embed('typeReference', reference.serialize())
          end
        end;
        if values.count() > 0 then
        begin
          node.setBoolean('isEnum', true);
          node.embed('enumValues', values.serialize())
        end;
        nested.load('[]');
        if recursive then node.setBoolean('recursive', true)
        else if blocked then
        begin
          if (typeDeclaration >= 0) or ((typeName = '') and (declaration >= 0) and (simpleDeclaration < 0)) then
          begin
            node.setBoolean('truncated', true);
            if depth >= 8 then node.setText('truncationReason', 'depth')
            else node.setText('truncationReason', 'nodes')
          end
        end
        else if typeDeclaration >= 0 then
          nested.load(buildChildren(typeDeclaration, depth + 1, active.serialize()))
        else if (typeName = '') and (declaration >= 0) and (simpleDeclaration < 0) then
          nested.load(buildChildren(declaration, depth + 1, active.serialize()));
        if (nested.count() = 0) and (not recursive) and
           (host.json_has(node.serialize(), 'recursive') = 0) and
           (host.json_has(node.serialize(), 'truncated') = 0) and
           (host.json_has(node.serialize(), 'unresolved') = 0) then node.setText('kind', 'leaf')
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
        if (tag = 'complextype') and (document.attribute(cursor, 'name') <> '') then
          active.setBoolean(host.json_set('{}', 'type', cursor), true);
        if blocked then
        begin
          node.embed('children', '[]');
          node.setBoolean('truncated', true);
          if depth >= 8 then node.setText('truncationReason', 'depth')
          else node.setText('truncationReason', 'nodes')
        end
        else node.embed('children', buildChildren(cursor, depth + 1, active.serialize()))
      end;
      children.append(node.serialize())
    end
    else if isSchemaNode(cursor) and ((tag = 'complexContent') or (tag = 'simpleContent') or
            (tag = 'extension') or (tag = 'restriction')) then
    begin
      if tag = 'extension' then
      begin
        typeName := document.attribute(cursor, 'base');
        typeDeclaration := -1;
        active.load(ancestors);
        if typeName <> '' then
        begin
          if namespaceAvailable(cursor, referenceNamespace(cursor, typeName)) then
          begin
            name := document.qualifiedLocal(cursor, typeName);
            key := symbolKey(referenceNamespace(cursor, typeName), name);
            if host.json_has(complexTypes.serialize(), key) = 1 then
              typeDeclaration := complexTypes.intValue(key)
            else if host.json_has(simpleTypes.serialize(), key) = 0 then
              host.raise_error('Unresolved local XSD base type: ' + typeName)
          end
        end;
        if typeDeclaration >= 0 then
        begin
          key := host.json_set('{}', 'type', typeDeclaration);
          recursive := host.json_has(ancestors, key) = 1;
          blocked := (depth >= 8) or (expandedNodes >= 1000);
          if recursive or blocked then
          begin
            node.load('{}');
            node.setText('name', 'extension');
            node.setText('kind', 'branch');
            node.setText('valueType', 'complextype');
            reference.load('{}');
            reference.setText('kind', 'complexType');
            reference.setText('name', document.qualifiedLocal(cursor, typeName));
            reference.setText('namespace', referenceNamespace(cursor, typeName));
            node.embed('typeReference', reference.serialize());
            if recursive then node.setBoolean('recursive', true)
            else
            begin
              node.setBoolean('truncated', true);
              if depth >= 8 then node.setText('truncationReason', 'depth')
              else node.setText('truncationReason', 'nodes')
            end;
            node.embed('children', '[]');
            children.append(node.serialize())
          end
          else
          begin
            active.setBoolean(key, true);
            nested.load(buildChildren(typeDeclaration, depth + 1, active.serialize()));
            position := 0;
            total := nested.count();
            while position < total do
            begin
              children.append(nested.item(position));
              position := position + 1
            end
          end
        end
        else if (typeName <> '') and
                (not namespaceAvailable(cursor, referenceNamespace(cursor, typeName))) and
                (referenceNamespace(cursor, typeName) <> 'http://www.w3.org/2001/XMLSchema') then
        begin
          node.load('{}');
          node.setText('name', 'extension');
          node.setText('kind', 'branch');
          node.setText('valueType', 'complextype');
          reference.load('{}');
          reference.setText('kind', 'type');
          reference.setText('name', document.qualifiedLocal(cursor, typeName));
          reference.setText('namespace', referenceNamespace(cursor, typeName));
          node.embed('typeReference', reference.serialize());
          node.setBoolean('unresolved', true);
          node.embed('children', '[]');
          children.append(node.serialize())
        end
      end;
      if depth >= 8 then
      begin
        node.load('{}');
        node.setText('name', tag);
        node.setText('kind', 'branch');
        node.setText('valueType', 'complextype');
        node.setBoolean('truncated', true);
        node.setText('truncationReason', 'depth');
        node.embed('children', '[]');
        children.append(node.serialize());
        nested.load('[]')
      end
      else nested.load(buildChildren(cursor, depth + 1, ancestors));
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

procedure initializeDocument(content: string; filePath: string);
var context: JSONDocument;
begin
  document.load(content);
  contexts.load('{}');
  loadedNamespaces.load('{}');
  importedNamespaces.load('{}');
  dependencies.load('[]');
  context.load('{}');
  context.setText('namespace', document.attribute(0, 'targetNamespace'));
  context.setInteger('chameleon', 0);
  context.setText('path', filePath);
  contexts.embed(contextKey(0), context.serialize());
  loadedNamespaces.setBoolean(host.text_hash(context.text('namespace')), true);
  if filePath <> '' then
  begin
    context.load('{}');
    context.setText('path', filePath);
    context.setText('hash', host.text_hash(content));
    dependencies.append(context.serialize())
  end
end;

procedure loadLinkedSchemas();
var schema: integer;
    cursor: integer;
    tag: string;
    location: string;
    resolved: string;
    namespace: string;
    expectedNamespace: string;
    content: string;
    context: JSONDocument;
    nextContext: JSONDocument;
    seen: JSONDocument;
    donor: XMLDocument;
    newRoot: integer;
    key: string;
    count: integer;
    actualNamespace: string;
begin
  seen.load('{}');
  context.load(contexts.value(contextKey(0)));
  seen.setText(symbolKey(context.text('namespace'), context.text('path')), document.attribute(0, 'targetNamespace'));
  count := 1;
  schema := 0;
  while schema >= 0 do
  begin
    context.load(contexts.value(contextKey(schema)));
    namespace := context.text('namespace');
    if document.attribute(schema, 'xml:base') <> '' then host.raise_error('XSD xml:base is not supported');
    cursor := document.firstChild(schema);
    while cursor >= 0 do
    begin
      tag := document.localName(cursor);
      if isSchemaNode(cursor) and ((tag = 'redefine') or (tag = 'override')) then
        host.raise_error('XSD redefine and override are not supported');
      if isSchemaNode(cursor) and ((tag = 'include') or (tag = 'import')) then
      begin
        if document.attribute(cursor, 'xml:base') <> '' then host.raise_error('XSD xml:base is not supported');
        expectedNamespace := namespace;
        if tag = 'import' then
        begin
          expectedNamespace := document.attribute(cursor, 'namespace');
          if expectedNamespace = namespace then host.raise_error('XSD import must use a different namespace');
          importedNamespaces.setBoolean(symbolKey(namespace, expectedNamespace), true)
        end;
        location := document.attribute(cursor, 'schemaLocation');
        if (tag = 'include') and (location = '') then host.raise_error('XSD include requires schemaLocation');
        if location <> '' then
        begin
          resolved := host.fs_resolve_relative('schemas', context.text('path'), location);
          key := symbolKey(expectedNamespace, resolved);
          if host.json_has(seen.serialize(), key) = 1 then
          begin
            actualNamespace := seen.text(key);
            if (tag = 'include') and (actualNamespace <> '') and (actualNamespace <> namespace) then
              host.raise_error('XSD include namespace mismatch: ' + resolved);
            if (tag = 'import') and (actualNamespace <> expectedNamespace) then
              host.raise_error('XSD import namespace mismatch: ' + resolved)
          end;
          if host.json_has(seen.serialize(), key) = 0 then
          begin
            if count >= 16 then host.raise_error('XSD linked document capacity exceeded');
            content := host.fs_read_text_auto('schemas', resolved);
            donor.load(content);
            if (donor.namespaceURI(0) <> 'http://www.w3.org/2001/XMLSchema') or
               (donor.localName(0) <> 'schema') then host.raise_error('Linked XSD document is not a schema: ' + resolved);
            if tag = 'include' then
            begin
              if (donor.attribute(0, 'targetNamespace') <> '') and
                 (donor.attribute(0, 'targetNamespace') <> namespace) then
                host.raise_error('XSD include namespace mismatch: ' + resolved)
            end
            else if donor.attribute(0, 'targetNamespace') <> expectedNamespace then
              host.raise_error('XSD import namespace mismatch: ' + resolved);
            nextContext.load('{}');
            nextContext.setText('path', resolved);
            nextContext.setText('namespace', expectedNamespace);
            nextContext.setInteger('chameleon', 0);
            if (tag = 'include') and (donor.attribute(0, 'targetNamespace') = '') and
               (expectedNamespace <> '') then nextContext.setInteger('chameleon', 1);
            actualNamespace := donor.attribute(0, 'targetNamespace');
            newRoot := document.appendDocument(donor.handle);
            contexts.embed(contextKey(newRoot), nextContext.serialize());
            loadedNamespaces.setBoolean(host.text_hash(expectedNamespace), true);
            nextContext.load('{}');
            nextContext.setText('path', resolved);
            nextContext.setText('hash', host.text_hash(content));
            dependencies.append(nextContext.serialize());
            seen.setText(key, actualNamespace);
            count := count + 1
          end
        end
      end;
      cursor := document.nextSibling(cursor)
    end;
    schema := document.nextSibling(schema)
  end
end;

function buildTree(): string;
var schema: integer;
    included: JSONArray;
    position: integer;
begin
  if (not isSchemaNode(0)) or (document.localName(0) <> 'schema') then return 'null';
  collectTypeDeclarations();
  expandedNodes := 0;
  children.load(buildChildren(0, 0, '{}'));
  schema := document.nextSibling(0);
  while schema >= 0 do
  begin
    if contextNamespace(schema) = contextNamespace(0) then
    begin
      included.load(buildChildren(schema, 0, '{}'));
      position := 0;
      while position < included.count() do
      begin
        children.append(included.item(position));
        position := position + 1
      end
    end;
    schema := document.nextSibling(schema)
  end;
  if children.count() = 0 then return 'null';
  root.load('{}');
  root.setText('name', 'root');
  root.setText('kind', 'branch');
  root.setText('valueType', 'xsd');
  root.embed('children', children.serialize());
  return root.serialize()
end;

post '/parse';
begin
  initializeDocument(host.event_body(), '');
  return buildTree()
end;

post '/parse-file';
begin
  initializeDocument(host.fs_read_text_auto('schemas', host.event_body()), host.event_body());
  if isSchemaNode(0) and (document.localName(0) = 'schema') then loadLinkedSchemas();
  root.load(host.json_embed('{}', 'tree', buildTree()));
  root.embed('dependencies', dependencies.serialize());
  return root.serialize()
end
end.
