service 'pulse-data-mapper-execution';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    resultDoc: JSONDocument;
    rule: JSONDocument;
    step: JSONDocument;
    notice: JSONDocument;
    rules: JSONArray;
    steps: JSONArray;
    diagnostics: JSONArray;
    sourceNodes: JSONArray;
    targetNodes: JSONArray;
    pendingPairs: JSONArray;
    mappings: JSONArray;
    outputDoc: JSONDocument;
    nodeDoc: JSONDocument;
    pairDoc: JSONDocument;
    sourceNodeDoc: JSONDocument;
    targetNodeDoc: JSONDocument;
    treeFrames: JSONArray;
    flattenedNodes: JSONArray;
    treeFrame: JSONDocument;
    flatNode: JSONDocument;
    inputHandle: integer;
    index: integer;
    valueIndex: integer;
    sourcePath: string;
    targetPath: string;
    conversion: string;
    sourceTypes: JSONDocument;
    targetTypes: JSONDocument;
    sourceType: string;
    targetType: string;
    selectedSourcePath: string;
    selectedTargetPath: string;
    currentSourcePath: string;
    currentTargetPath: string;
    candidatePath: string;
    candidateName: string;
    targetChildPath: string;
    sourceChildCount: integer;
    targetChildCount: integer;
    pairIndex: integer;
    nodeIndex: integer;
    sourceFound: integer;
    targetFound: integer;
    shapeValid: integer;
    treeHandle: integer;
    treeNodeIndex: integer;
    treeChildIndex: integer;
    treeChildCount: integer;
    treeFrameIndex: integer;
    treeRoot: integer;
    treeName: string;
    treePath: string;
    treeParent: string;
    treeKind: string;
    treeValueType: string;
    treeRaw: string;
    treeRequired: integer;

function makeTreeFrame(value: integer; parentPath: string; isRoot: integer): string;
var entry: JSONDocument;
begin
  entry.load('{}');
  entry.setInteger('node', value);
  entry.setText('parent', parentPath);
  entry.setInteger('index', 0);
  entry.setInteger('root', isRoot);
  entry.setInteger('skip', 0);
  return entry.serialize()
end;

function pathParent(value: string): string;
var parts: JSONArray;
    index: integer;
    result: string;
begin
  parts.load(host.text_split(value, '.'));
  result := '';
  index := 0;
  while index < parts.count() - 1 do
  begin
    if result <> '' then result := result + '.';
    result := result + host.text_trim(host.json_to_text(parts.item(index)));
    index := index + 1
  end;
  return result
end;

function pathName(value: string): string;
var parts: JSONArray;
begin
  parts.load(host.text_split(value, '.'));
  if parts.count() = 0 then return '';
  return host.text_trim(host.json_to_text(parts.item(parts.count() - 1)))
end;

function isDescendant(value: string; parentPath: string): integer;
var valueParts: JSONArray;
    parentParts: JSONArray;
    index: integer;
begin
  valueParts.load(host.text_split(value, '.'));
  parentParts.load(host.text_split(parentPath, '.'));
  if valueParts.count() <= parentParts.count() then return 0;
  index := 0;
  while index < parentParts.count() do
  begin
    if host.text_trim(host.json_to_text(valueParts.item(index))) <>
       host.text_trim(host.json_to_text(parentParts.item(index))) then return 0;
    index := index + 1
  end;
  return 1
end;

function relativePath(value: string; parentPath: string): string;
var valueParts: JSONArray;
    parentParts: JSONArray;
    index: integer;
    result: string;
begin
  valueParts.load(host.text_split(value, '.'));
  parentParts.load(host.text_split(parentPath, '.'));
  result := '';
  index := parentParts.count();
  while index < valueParts.count() do
  begin
    if result <> '' then result := result + '.';
    result := result + host.text_trim(host.json_to_text(valueParts.item(index)));
    index := index + 1
  end;
  return result
end;

function findNode(nodes: JSONArray; value: string): string;
var index: integer;
    candidate: JSONDocument;
begin
  index := 0;
  while index < nodes.count() do
  begin
    candidate.load(nodes.item(index));
    if candidate.text('path') = value then return candidate.serialize();
    index := index + 1
  end;
  return '{}'
end;

function childCount(nodes: JSONArray; parentPath: string): integer;
var index: integer;
    candidate: JSONDocument;
    candidatePath: string;
begin
  index := 0;
  childCount := 0;
  while index < nodes.count() do
  begin
    candidate.load(nodes.item(index));
    candidatePath := candidate.text('path');
    if (candidatePath <> '') and (pathParent(candidatePath) = parentPath) then
      childCount := childCount + 1;
    index := index + 1
  end;
  return childCount
end;

function findChild(nodes: JSONArray; parentPath: string; childName: string): string;
var index: integer;
    candidate: JSONDocument;
    candidatePath: string;
begin
  index := 0;
  while index < nodes.count() do
  begin
    candidate.load(nodes.item(index));
    candidatePath := candidate.text('path');
    if (candidatePath <> '') and (pathParent(candidatePath) = parentPath) and
       (pathName(candidatePath) = childName) then return candidatePath;
    index := index + 1
  end;
  return ''
end;

function pathParts(value: string): string;
var parts: JSONArray;
    normalized: JSONArray;
    index: integer;
    part: string;
begin
  parts.load(host.text_split(value, '.'));
  normalized.load('[]');
  index := 0;
  while index < parts.count() do
  begin
    part := host.text_trim(host.json_to_text(parts.item(index)));
    if part <> '' then
    begin
      if (part = '__proto__') or (part = 'prototype') or (part = 'constructor') then
        host.raise_error('Unsafe mapper path segment: ' + part);
      normalized.append(host.json_value(host.json_set('{}', 'value', part), 'value'))
    end;
    index := index + 1
  end;
  return normalized.serialize()
end;

function readPath(value: string): integer;
var parts: JSONArray;
    index: integer;
    current: integer;
    kind: string;
begin
  parts.load(pathParts(value));
  current := 0;
  index := 0;
  while index < parts.count() do
  begin
    kind := host.json_node_kind(inputHandle, current);
    if (kind <> 'object') and (kind <> 'array') then return -1;
    current := host.json_node_member(inputHandle, current, host.json_to_text(parts.item(index)));
    if current < 0 then return -1;
    index := index + 1
  end;
  return current
end;

function writePath(previous: string; value: string; mappedValue: string): string;
var parts: JSONArray;
    parents: JSONArray;
    current: JSONDocument;
    index: integer;
    key: string;
    childJson: string;
    result: string;
begin
  parts.load(pathParts(value));
  if parts.count() = 0 then return previous;
  parents.load('[]');
  current.load(previous);
  index := 0;
  while index < parts.count() - 1 do
  begin
    key := host.json_to_text(parts.item(index));
    parents.append(current.serialize());
    childJson := '{}';
    if host.json_has(current.serialize(), key) = 1 then
      if host.json_kind(current.value(key)) = 'object' then childJson := current.value(key);
    current.load(childJson);
    index := index + 1
  end;
  current.embed(host.json_to_text(parts.item(index)), mappedValue);
  result := current.serialize();
  index := index - 1;
  while index >= 0 do
  begin
    current.load(parents.item(index));
    current.embed(host.json_to_text(parts.item(index)), result);
    result := current.serialize();
    index := index - 1
  end;
  return result
end;

procedure addDiagnostic(level: string; message: string);
begin
  notice.load('{}');
  notice.setText('level', level);
  notice.setText('rule', sourcePath + ' -> ' + targetPath);
  notice.setText('message', message);
  diagnostics.append(notice.serialize())
end;

post '/plan';
begin
  request.load(host.event_body());
  inputHandle := host.json_parse_value(request.value('payload'));
  if host.json_node_kind(inputHandle, 0) <> 'object' then
    host.raise_error('payload object is required');
  rules.load(request.value('rules'));
  sourceTypes.load(request.value('sourceTypes'));
  targetTypes.load(request.value('targetTypes'));
  steps.load('[]');
  diagnostics.load('[]');
  index := 0;
  while index < rules.count() do
  begin
    rule.load(rules.item(index));
    sourcePath := rule.text('sourcePath');
    targetPath := rule.text('targetPath');
    if (sourcePath <> '') and (targetPath <> '') then
    begin
      valueIndex := readPath(sourcePath);
      if valueIndex < 0 then addDiagnostic('warning', 'Source field not present in payload')
      else
      begin
        conversion := rule.text('conversionRule');
        if conversion = '' then
        begin
          if (host.json_has(sourceTypes.serialize(), sourcePath) = 1) and
             (host.json_has(targetTypes.serialize(), targetPath) = 1) then
          begin
            sourceType := host.text_lower(sourceTypes.text(sourcePath));
            targetType := host.text_lower(targetTypes.text(targetPath));
            if (sourceType <> targetType) and (sourceType <> 'unknown') and (targetType <> 'unknown') then
            begin
              host.http_status(409);
              resultDoc.load('{}');
              resultDoc.setText('error', 'Non-standard move ' + sourcePath + ' -> ' + targetPath + ' requires a Pascalish routine.');
              return resultDoc.serialize()
            end
          end
        end
        else addDiagnostic('info', 'Pascalish routine applied');
        step.load('{}');
        step.setText('targetPath', targetPath);
        step.setText('conversionRule', conversion);
        step.embed('value', host.json_node_value(inputHandle, valueIndex));
        steps.append(step.serialize())
      end
    end;
    index := index + 1
  end;
  resultDoc.load('{}');
  resultDoc.embed('steps', steps.serialize());
  resultDoc.embed('diagnostics', diagnostics.serialize());
  return resultDoc.serialize()
end

post '/shape';
begin
  request.load(host.event_body());
  sourceNodes.load(request.value('sourceNodes'));
  targetNodes.load(request.value('targetNodes'));
  selectedSourcePath := request.text('sourcePath');
  selectedTargetPath := request.text('targetPath');
  sourceFound := 0;
  targetFound := 0;
  if findNode(sourceNodes, selectedSourcePath) <> '{}' then sourceFound := 1;
  if findNode(targetNodes, selectedTargetPath) <> '{}' then targetFound := 1;
  if (sourceFound = 0) or (targetFound = 0) then
  begin
    host.http_status(400);
    resultDoc.load('{}');
    resultDoc.setText('error', 'Selected source/target paths were not found in schema snapshots.');
    return resultDoc.serialize()
  end;

  pendingPairs.load('[]');
  mappings.load('[]');
  pairDoc.load('{}');
  pairDoc.setText('sourcePath', selectedSourcePath);
  pairDoc.setText('targetPath', selectedTargetPath);
  pendingPairs.append(pairDoc.serialize());
  pairIndex := 0;
  shapeValid := 1;
  while (pairIndex < pendingPairs.count()) and (shapeValid = 1) do
  begin
    pairDoc.load(pendingPairs.item(pairIndex));
    currentSourcePath := pairDoc.text('sourcePath');
    currentTargetPath := pairDoc.text('targetPath');
    sourceChildCount := childCount(sourceNodes, currentSourcePath);
    targetChildCount := childCount(targetNodes, currentTargetPath);
    if sourceChildCount <> targetChildCount then shapeValid := 0
    else if sourceChildCount = 0 then
    begin
      sourceNodeDoc.load(findNode(sourceNodes, currentSourcePath));
      targetNodeDoc.load(findNode(targetNodes, currentTargetPath));
      sourceType := host.text_lower(sourceNodeDoc.text('valueType'));
      targetType := host.text_lower(targetNodeDoc.text('valueType'));
      if sourceType = '' then sourceType := 'unknown';
      if targetType = '' then targetType := 'unknown';
      if (sourceType <> targetType) and (sourceType <> 'unknown') and (targetType <> 'unknown') then
        shapeValid := 0
    end
    else
    begin
      nodeIndex := 0;
      while (nodeIndex < sourceNodes.count()) and (shapeValid = 1) do
      begin
        nodeDoc.load(sourceNodes.item(nodeIndex));
        candidatePath := nodeDoc.text('path');
        if (candidatePath <> '') and (pathParent(candidatePath) = currentSourcePath) then
        begin
          candidateName := pathName(candidatePath);
          targetChildPath := findChild(targetNodes, currentTargetPath, candidateName);
          if targetChildPath = '' then shapeValid := 0
          else
          begin
            pairDoc.load('{}');
            pairDoc.setText('sourcePath', candidatePath);
            pairDoc.setText('targetPath', targetChildPath);
            pendingPairs.append(pairDoc.serialize())
          end
        end;
        nodeIndex := nodeIndex + 1
      end
    end;
    pairIndex := pairIndex + 1
  end;

  if shapeValid = 0 then
  begin
    host.http_status(409);
    resultDoc.load('{}');
    resultDoc.setText('error', 'Selected branches are not structurally equivalent.');
    return resultDoc.serialize()
  end;
  if childCount(sourceNodes, selectedSourcePath) = 0 then
  begin
    pairDoc.load('{}');
    pairDoc.setText('sourcePath', selectedSourcePath);
    pairDoc.setText('targetPath', selectedTargetPath);
    mappings.append(pairDoc.serialize())
  end
  else
  begin
    nodeIndex := 0;
    while nodeIndex < sourceNodes.count() do
    begin
      nodeDoc.load(sourceNodes.item(nodeIndex));
      candidatePath := nodeDoc.text('path');
      if (candidatePath <> '') and (isDescendant(candidatePath, selectedSourcePath) = 1) and
         (childCount(sourceNodes, candidatePath) = 0) then
      begin
        targetChildPath := selectedTargetPath + '.' + relativePath(candidatePath, selectedSourcePath);
        pairDoc.load('{}');
        pairDoc.setText('sourcePath', candidatePath);
        pairDoc.setText('targetPath', targetChildPath);
        mappings.append(pairDoc.serialize())
      end;
      nodeIndex := nodeIndex + 1
    end
  end;
  resultDoc.load('{}');
  resultDoc.embed('mappings', mappings.serialize());
  return resultDoc.serialize()
end;

post '/flatten';
begin
  request.load(host.event_body());
  treeHandle := host.json_parse_value(request.value('structure'));
  treeFrames.load('[]');
  flattenedNodes.load('[]');
  if (host.json_node_kind(treeHandle, 0) = 'object') or
     (host.json_node_kind(treeHandle, 0) = 'array') then
    treeFrames.append(makeTreeFrame(0, '', 1));
  while treeFrames.count() > 0 do
  begin
    treeFrameIndex := treeFrames.count() - 1;
    treeFrame.load(treeFrames.item(treeFrameIndex));
    treeNodeIndex := treeFrame.intValue('node');
    treeParent := treeFrame.text('parent');
    if treeFrame.intValue('index') = 0 then
    begin
      treeFrame.setInteger('index', 1);
      treeFrames.replace(treeFrameIndex, treeFrame.serialize());
      treePath := treeParent;
      if treeFrame.intValue('root') = 0 then
      begin
        nodeDoc.load('{}');
        treeChildIndex := host.json_node_member(treeHandle, treeNodeIndex, 'name');
        treeName := '';
        if treeChildIndex >= 0 then
        begin
          treeRaw := host.json_node_value(treeHandle, treeChildIndex);
          if (treeRaw <> 'null') and (treeRaw <> 'false') and (treeRaw <> '0') then
            treeName := host.text_trim(host.json_to_text(treeRaw))
        end;
        if treeName = '' then treeFrame.setInteger('skip', 1)
        else
        begin
          if treePath = '' then treePath := treeName
          else treePath := treePath + '.' + treeName;
          treeKind := 'leaf';
          treeChildIndex := host.json_node_member(treeHandle, treeNodeIndex, 'kind');
          if treeChildIndex >= 0 then
            if host.text_lower(host.json_to_text(host.json_node_value(treeHandle, treeChildIndex))) = 'branch' then
              treeKind := 'branch';
          treeValueType := 'unknown';
          treeChildIndex := host.json_node_member(treeHandle, treeNodeIndex, 'valueType');
          if treeChildIndex >= 0 then
          begin
            treeRaw := host.json_node_value(treeHandle, treeChildIndex);
            if (treeRaw <> 'null') and (treeRaw <> 'false') and (treeRaw <> '0') then
              treeValueType := host.text_lower(host.json_to_text(treeRaw));
            if treeValueType = '' then treeValueType := 'unknown'
          end;
          treeRequired := 0;
          treeChildIndex := host.json_node_member(treeHandle, treeNodeIndex, 'required');
          if treeChildIndex >= 0 then
            if host.json_node_value(treeHandle, treeChildIndex) = 'true' then treeRequired := 1;
          flatNode.load('{}');
          flatNode.setText('path', treePath);
          flatNode.setText('kind', treeKind);
          flatNode.setText('valueType', treeValueType);
          if treeRequired = 1 then flatNode.setBoolean('required', true)
          else flatNode.setBoolean('required', false);
          flattenedNodes.append(flatNode.serialize())
        end;
        treeFrame.setText('path', treePath);
        if treeFrame.intValue('skip') = 1 then treeFrame.setInteger('index', -1);
        treeFrames.replace(treeFrameIndex, treeFrame.serialize())
      end
      else
      begin
        treeFrame.setText('path', '');
        treeFrames.replace(treeFrameIndex, treeFrame.serialize())
      end
    end;
    treeFrame.load(treeFrames.item(treeFrameIndex));
    if treeFrame.intValue('index') >= 0 then
    begin
      treeChildIndex := host.json_node_member(treeHandle, treeNodeIndex, 'children');
      treeChildCount := 0;
      if treeChildIndex >= 0 then
        if host.json_node_kind(treeHandle, treeChildIndex) = 'array' then
          treeChildCount := host.json_node_count(treeHandle, treeChildIndex);
      treeFrameIndex := treeFrame.intValue('index') - 1;
      if treeFrameIndex < treeChildCount then
      begin
        treeFrame.setInteger('index', treeFrameIndex + 2);
        treeFrames.replace(treeFrames.count() - 1, treeFrame.serialize());
        treeChildIndex := host.json_node_item(treeHandle, treeChildIndex, treeFrameIndex);
        if (host.json_node_kind(treeHandle, treeChildIndex) = 'object') or
           (host.json_node_kind(treeHandle, treeChildIndex) = 'array') then
          treeFrames.append(makeTreeFrame(treeChildIndex, treeFrame.text('path'), 0))
      end
      else treeFrames.remove(treeFrames.count() - 1)
    end
    else treeFrames.remove(treeFrames.count() - 1)
  end;
  resultDoc.load('{}');
  resultDoc.embed('nodes', flattenedNodes.serialize());
  return resultDoc.serialize()
end;

post '/finish';
begin
  request.load(host.event_body());
  steps.load(request.value('steps'));
  outputDoc.load('{}');
  index := 0;
  while index < steps.count() do
  begin
    step.load(steps.item(index));
    outputDoc.load(writePath(outputDoc.serialize(), step.text('targetPath'), step.value('value')));
    index := index + 1
  end;
  resultDoc.load('{}');
  resultDoc.embed('output', outputDoc.serialize());
  return resultDoc.serialize()
end
end.
