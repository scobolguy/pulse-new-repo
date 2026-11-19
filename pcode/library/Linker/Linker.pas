program "Linker";
uses PortableCodecs;

var LK_Catalog: string;
    LK_State: string;
    LK_Order: string;
    LK_Blocks: string;
    LK_Procedures: string;
    LK_Included: string;
    LK_Seen: string;
    LK_RootProcedures: string;
    LK_Id: string;

procedure LK_Fail(message: string);
begin
  host.raise_error('[PCODE-LINK] ' + message)
end;

function LK_Trim(value: string): string;
var first: integer;
    last: integer;
begin
  first := 0;
  last := host.string_length(value);
  while (first < last) and (host.string_slice(value, first, first + 1) <= ' ') do first := first + 1;
  while last > first do
  begin
    if host.string_slice(value, last - 1, last) > ' ' then return host.string_slice(value, first, last);
    last := last - 1
  end;
  return host.string_slice(value, first, last)
end;

function LK_Obj(value: string): string;
begin
  if value = '' then return '{}';
  return value
end;

function LK_Array(value: string): string;
begin
  if value = '' then return '[]';
  return value
end;

function LK_Text(value: string; key: string): string;
var raw: string;
begin
  raw := PCJSON_Member(value, key);
  if (raw = '') or (raw = 'null') then return '';
  return PCJSON_Text(raw)
end;

function LK_Number(value: integer): string;
begin
  return host.integer_text(value)
end;

function LK_Integer(text: string): integer;
var i: integer;
    digit: integer;
    resultValue: integer;
begin
  if text = '' then return -1;
  i := 0;
  resultValue := 0;
  while i < host.string_length(text) do
  begin
    digit := host.string_index('0123456789', host.string_slice(text, i, i + 1));
    if (digit < 0) or (resultValue > 900719925474098) then return -1;
    resultValue := resultValue * 10 + digit;
    i := i + 1
  end;
  return resultValue
end;

function LK_Has(values: string; value: string): boolean;
var i: integer;
    count: integer;
begin
  count := PCJSON_Count(values);
  i := 0;
  while i < count do
  begin
    if PCJSON_Text(PCJSON_Item(values, i)) = value then return true;
    i := i + 1
  end;
  return false
end;

function LK_Add(values: string; value: string): string;
begin
  if LK_Has(values, value) then return values;
  return PCJSON_Append(values, PCJSON_Quote(value))
end;

function LK_Normal(value: string): string;
var i: integer;
    cp: integer;
    resultValue: string;
begin
  value := host.string_upper(LK_Trim(value));
  resultValue := '';
  i := 0;
  while i < host.string_length(value) do
  begin
    cp := host.string_codepoint_at(value, i);
    if ((cp >= 65) and (cp <= 90)) or ((cp >= 48) and (cp <= 57)) or (cp = 95) then
      resultValue := resultValue + host.string_slice(value, i, i + 1)
    else resultValue := resultValue + '_';
    i := i + host.string_codepoint_width(value, i)
  end;
  return resultValue
end;

function LK_Label(value: string): boolean;
var i: integer;
    cp: integer;
begin
  if value = '' then return false;
  i := 0;
  while i < host.string_length(value) do
  begin
    cp := host.string_codepoint_at(value, i);
    if not (((cp >= 65) and (cp <= 90)) or ((cp >= 97) and (cp <= 122)) or
        (cp = 95) or ((i > 0) and (cp >= 48) and (cp <= 57))) then return false;
    i := i + 1
  end;
  return true
end;

function LK_LineEnd(text: string; start: integer): integer;
var pos: integer;
begin
  pos := start;
  while pos < host.string_length(text) do
  begin
    if host.string_codepoint_at(text, pos) = 10 then return pos;
    pos := pos + 1
  end;
  return pos
end;

function LK_IsLabel(line: string): boolean;
begin
  if line = '' then return false;
  return host.string_slice(line, host.string_length(line) - 1, host.string_length(line)) = ':'
end;

function LK_Executable(line: string): boolean;
begin
  line := LK_Trim(line);
  return (line <> '') and (host.string_slice(line, 0, 1) <> '#') and not LK_IsLabel(line)
end;

function LK_Count(text: string): integer;
var pos: integer;
    last: integer;
    count: integer;
begin
  pos := 0;
  count := 0;
  while pos < host.string_length(text) do
  begin
    last := LK_LineEnd(text, pos);
    if LK_Executable(host.string_slice(text, pos, last)) then count := count + 1;
    pos := last + 1
  end;
  return count
end;

function LK_Token(line: string; wanted: integer): string;
var pos: integer;
    start: integer;
    index: integer;
    size: integer;
begin
  pos := 0;
  index := 0;
  size := host.string_length(line);
  while pos < size do
  begin
    while (pos < size) and (host.string_slice(line, pos, pos + 1) <= ' ') do pos := pos + 1;
    start := pos;
    while (pos < size) and (host.string_slice(line, pos, pos + 1) > ' ') do pos := pos + 1;
    if index = wanted then return host.string_slice(line, start, pos);
    index := index + 1
  end;
  return ''
end;

function LK_ResolveProcedure(procedures: string; reference: string; id: string): string;
var keys: string;
    labelValue: string;
    resultValue: string;
    i: integer;
    matches: integer;
begin
  if PCJSON_Member(procedures, reference) <> '' then return reference;
  keys := PCJSON_Keys(procedures);
  i := 0;
  matches := 0;
  resultValue := '';
  while i < PCJSON_Count(keys) do
  begin
    labelValue := PCJSON_Text(PCJSON_Item(keys, i));
    if host.string_lower(LK_Text(PCJSON_Member(procedures, labelValue), 'name')) = host.string_lower(reference) then
    begin
      resultValue := labelValue;
      matches := matches + 1
    end;
    i := i + 1
  end;
  if matches <> 1 then LK_Fail('Library ' + id + ' must resolve ' + reference + ' to exactly one procedure');
  return resultValue
end;

procedure LK_Dependency(reference: string);
var id: string;
    libraryValue: string;
    candidate: string;
    dependencies: string;
    version: string;
    hash: string;
    i: integer;
    count: integer;
begin
  if host.string_slice(LK_Trim(reference), 0, 1) = '"' then id := PCJSON_Text(reference)
  else id := LK_Text(reference, 'id');
  id := LK_Trim(id);
  if id = '' then LK_Fail('Each library requires an id');
  i := 0;
  count := 0;
  libraryValue := '';
  while i < PCJSON_Count(LK_Catalog) do
  begin
    candidate := PCJSON_Item(LK_Catalog, i);
    if LK_Trim(LK_Text(candidate, 'id')) = id then
    begin
      libraryValue := candidate;
      count := count + 1
    end;
    i := i + 1
  end;
  if count = 0 then LK_Fail('Missing library ' + id);
  if count > 1 then LK_Fail('Ambiguous library ' + id);
  if host.string_slice(LK_Trim(reference), 0, 1) = '{' then
  begin
    version := LK_Text(reference, 'version');
    hash := LK_Text(reference, 'hash');
    if (version <> '') and (version <> LK_Text(libraryValue, 'version')) then LK_Fail('Library ' + id + ' wrong version');
    if (hash <> '') and (host.string_lower(hash) <> host.string_lower(host.text_hash_utf8(LK_Text(libraryValue, 'pcodeText')))) then
      LK_Fail('Library ' + id + ' conflicting pinned hash')
  end;
  hash := LK_Text(libraryValue, 'hash');
  if (hash <> '') and (host.string_lower(hash) <> host.string_lower(host.text_hash_utf8(LK_Text(libraryValue, 'pcodeText')))) then
    LK_Fail('Library ' + id + ' hash mismatch');
  if PCJSON_Member(LK_State, id) = '"visiting"' then LK_Fail('Dependency cycle at ' + id);
  if PCJSON_Member(LK_State, id) = '"done"' then exit;
  LK_State := PCJSON_Put(LK_State, id, '"visiting"');
  dependencies := LK_Array(PCJSON_Member(libraryValue, 'dependencies'));
  i := 0;
  while i < PCJSON_Count(dependencies) do
  begin
    LK_Dependency(PCJSON_Item(dependencies, i));
    i := i + 1
  end;
  LK_State := PCJSON_Put(LK_State, id, '"done"');
  LK_Order := PCJSON_Append(LK_Order, libraryValue)
end;

procedure LK_Visit(labelValue: string);
var block: string;
    line: string;
    called: string;
    pos: integer;
    last: integer;
begin
  if PCJSON_Member(LK_Seen, labelValue) <> '' then exit;
  block := PCJSON_Member(LK_Blocks, labelValue);
  if block = '' then LK_Fail('Library ' + LK_Id + ' has no P-code body for ' + labelValue);
  block := PCJSON_Text(block);
  LK_Seen := PCJSON_Put(LK_Seen, labelValue, 'true');
  LK_Included := PCJSON_Append(LK_Included, PCJSON_Quote(labelValue));
  pos := 0;
  while pos < host.string_length(block) do
  begin
    last := LK_LineEnd(block, pos);
    line := LK_Trim(host.string_slice(block, pos, last));
    if LK_Token(line, 0) = 'CALL' then
    begin
      called := LK_Token(line, 1);
      if PCJSON_Member(LK_Procedures, called) <> '' then LK_Visit(called)
      else if PCJSON_Member(LK_RootProcedures, called) = '' then
        LK_Fail('Library ' + LK_Id + ' calls unresolved procedure ' + called)
    end;
    pos := last + 1
  end
end;

function LK_Rewrite(line: string; labels: string; globals: string; locals: string): string;
var op: string;
    operand: string;
    mapped: string;
    third: string;
begin
  op := LK_Token(line, 0);
  operand := LK_Token(line, 1);
  third := LK_Token(line, 2);
  if (op = 'JMP') or (op = 'JZ') or (op = 'CALL') then
  begin
    mapped := LK_Text(labels, operand);
    if mapped = '' then mapped := operand;
    if (op = 'CALL') and (third <> '') then return op + ' ' + mapped + ' ' + third;
    return op + ' ' + mapped
  end;
  if (op = 'LOAD') or (op = 'STORE') or (op = 'LOAD_NAME') or (op = 'STORE_NAME') or
      (op = 'ARR_GET') or (op = 'ARR_SET') then
  begin
    mapped := LK_Text(globals, operand);
    if (mapped <> '') and not LK_Has(locals, operand) then
    begin
      if (op = 'ARR_GET') or (op = 'ARR_SET') then return op + ' ' + mapped + ' ' + third;
      return op + ' ' + mapped
    end
  end;
  return line
end;

function LK_MergeVersion(rootMap: string; libraryMap: string; key: string; id: string): string;
var value: string;
    old: string;
begin
  value := PCJSON_Member(libraryMap, key);
  old := PCJSON_Member(rootMap, key);
  if value = '' then return rootMap;
  if (old <> '') and (old <> value) then LK_Fail(id + ' ' + key + ' conflicts with root');
  return PCJSON_Put(rootMap, key, value + ' ')
end;

function LK_Sort(values: string): string;
var sorted: string;
    next: string;
    value: string;
    i: integer;
    j: integer;
    inserted: boolean;
begin
  sorted := '[]';
  i := 0;
  while i < PCJSON_Count(values) do
  begin
    value := PCJSON_Text(PCJSON_Item(values, i));
    next := '[]';
    inserted := false;
    j := 0;
    while j < PCJSON_Count(sorted) do
    begin
      if not inserted and (value < PCJSON_Text(PCJSON_Item(sorted, j))) then
      begin
        next := PCJSON_Append(next, PCJSON_Quote(value));
        inserted := true
      end;
      next := PCJSON_Append(next, PCJSON_Item(sorted, j));
      j := j + 1
    end;
    if not inserted then next := PCJSON_Append(next, PCJSON_Quote(value));
    sorted := next;
    i := i + 1
  end;
  return sorted
end;

function LK_LinkOrdered(request: string; libraries: string): string;
var programValue: string;
    rootMap: string;
    text: string;
    rootLabels: string;
    rootGlobals: string;
    sourceMap: string;
    rootSources: string;
    initCalls: string;
    capabilities: string;
    targets: string;
    haveTargets: boolean;
    bindingCapabilities: string;
    libraryValue: string;
    libraryMap: string;
    libraryText: string;
    prefix: string;
    exports: string;
    exportKeys: string;
    resolved: string;
    globals: string;
    globalNames: string;
    starts: string;
    labels: string;
    snippets: string;
    block: string;
    current: string;
    line: string;
    labelValue: string;
    newLabel: string;
    externalName: string;
    procedureValue: string;
    params: string;
    locals: string;
    keys: string;
    value: string;
    location: string;
    exportedNames: string;
    identity: string;
    initLabel: string;
    libraryCapabilities: string;
    nextTargets: string;
    rootMain: integer;
    shift: integer;
    address: integer;
    sourceAddress: integer;
    base: integer;
    pos: integer;
    last: integer;
    i: integer;
    j: integer;
    k: integer;
    n: integer;
    numeric: integer;
    foundMain: boolean;
begin
  programValue := PCJSON_Member(request, 'program');
  if programValue = '' then LK_Fail('Root program requires pcodeText and programMap');
  if (PCJSON_Member(programValue, 'pcodeText') = '') or (PCJSON_Member(programValue, 'programMap') = '') then
    LK_Fail('Root program requires pcodeText and programMap');
  if PCJSON_Count(libraries) = 0 then return programValue;
  rootMap := PCJSON_Member(programValue, 'programMap');
  text := LK_Text(programValue, 'pcodeText');
  rootLabels := '{}';
  rootGlobals := LK_Array(PCJSON_Member(rootMap, 'globals'));
  rootSources := LK_Obj(PCJSON_Member(rootMap, 'sourceMap'));
  sourceMap := '{}';
  initCalls := '';
  capabilities := LK_Array(PCJSON_Member(rootMap, 'requiredHostCapabilities'));
  targets := PCJSON_Member(rootMap, 'targets');
  haveTargets := targets <> '';
  if targets = '' then targets := '["js","esp32"]';
  bindingCapabilities := LK_Obj(PCJSON_Member(request, 'bindingCapabilities'));
  rootMain := -1;
  address := 0;
  pos := 0;
  while pos < host.string_length(text) do
  begin
    last := LK_LineEnd(text, pos);
    line := LK_Trim(host.string_slice(text, pos, last));
    if line = 'MAIN:' then rootMain := address;
    if LK_IsLabel(line) then
    begin
      labelValue := host.string_slice(line, 0, host.string_length(line) - 1);
      if PCJSON_Member(rootLabels, labelValue) <> '' then LK_Fail('Duplicate root label ' + labelValue);
      rootLabels := PCJSON_Put(rootLabels, labelValue, 'true')
    end;
    if LK_Executable(line) then address := address + 1;
    pos := last + 1
  end;
  if rootMain < 0 then LK_Fail('Root program has no MAIN label');
  shift := 0;
  i := 0;
  while i < PCJSON_Count(libraries) do
  begin
    if LK_Text(PCJSON_Item(libraries, i), 'initialize') <> '' then shift := shift + 1;
    i := i + 1
  end;
  keys := PCJSON_Keys(rootSources);
  i := 0;
  while i < PCJSON_Count(keys) do
  begin
    value := PCJSON_Text(PCJSON_Item(keys, i));
    numeric := LK_Integer(value);
    location := PCJSON_Member(rootSources, value);
    if numeric >= rootMain then value := LK_Number(numeric + shift);
    sourceMap := PCJSON_Put(sourceMap, value, location);
    i := i + 1
  end;
  i := 0;
  while i < PCJSON_Count(libraries) do
  begin
    libraryValue := PCJSON_Item(libraries, i);
    LK_Id := LK_Trim(LK_Text(libraryValue, 'id'));
    libraryMap := PCJSON_Member(libraryValue, 'programMap');
    if (libraryMap = '') or (PCJSON_Member(libraryValue, 'pcodeText') = '') then
      LK_Fail('Library ' + LK_Id + ' requires pcodeText and programMap');
    libraryText := LK_Text(libraryValue, 'pcodeText');
    prefix := 'LIB_' + LK_Normal(LK_Id) + '_';
    LK_Procedures := LK_Obj(PCJSON_Member(libraryMap, 'procedures'));
    LK_RootProcedures := LK_Obj(PCJSON_Member(rootMap, 'procedures'));
    LK_Blocks := '{}';
    starts := '{}';
    labels := '{}';
    current := '';
    block := '';
    pos := 0;
    sourceAddress := 0;
    foundMain := false;
    while pos < host.string_length(libraryText) do
    begin
      last := LK_LineEnd(libraryText, pos);
      line := LK_Trim(host.string_slice(libraryText, pos, last));
      if LK_IsLabel(line) then
      begin
        labelValue := host.string_slice(line, 0, host.string_length(line) - 1);
        if PCJSON_Member(labels, labelValue) <> '' then LK_Fail('Duplicate library label ' + labelValue);
        labels := PCJSON_Put(labels, labelValue, 'true');
        if (PCJSON_Member(LK_Procedures, labelValue) <> '') or (line = 'MAIN:') then
        begin
          if current <> '' then LK_Blocks := PCJSON_Put(LK_Blocks, current, PCJSON_Quote(block));
          current := '';
          block := '';
          if line = 'MAIN:' then foundMain := true
          else if not foundMain then
          begin
            current := labelValue;
            starts := PCJSON_Put(starts, current, LK_Number(sourceAddress) + ' ')
          end
        end
      end;
      if current <> '' then block := block + host.string_slice(libraryText, pos, last) + host.string_from_codepoint(10);
      if LK_Executable(line) then sourceAddress := sourceAddress + 1;
      pos := last + 1
    end;
    if not foundMain then LK_Fail('Library ' + LK_Id + ' has no MAIN label');
    exports := LK_Obj(PCJSON_Member(libraryValue, 'exports'));
    exportKeys := PCJSON_Keys(exports);
    resolved := '{}';
    LK_Included := '[]';
    LK_Seen := '{}';
    j := 0;
    while j < PCJSON_Count(exportKeys) do
    begin
      externalName := PCJSON_Text(PCJSON_Item(exportKeys, j));
      labelValue := LK_ResolveProcedure(LK_Procedures, LK_Text(exports, externalName), LK_Id);
      resolved := PCJSON_Put(resolved, externalName, PCJSON_Quote(labelValue));
      LK_Visit(labelValue);
      j := j + 1
    end;
    initLabel := LK_Text(libraryValue, 'initialize');
    globalNames := LK_Array(PCJSON_Member(libraryMap, 'globals'));
    if (PCJSON_Count(globalNames) > 0) and (initLabel = '') then
      LK_Fail('Library ' + LK_Id + ' has globals and requires an initializer');
    if initLabel <> '' then
    begin
      initLabel := LK_ResolveProcedure(LK_Procedures, initLabel, LK_Id);
      LK_Visit(initLabel)
    end;
    globals := '{}';
    j := 0;
    while j < PCJSON_Count(globalNames) do
    begin
      value := PCJSON_Text(PCJSON_Item(globalNames, j));
      newLabel := prefix + 'GLOBAL_' + LK_Normal(value);
      if LK_Has(rootGlobals, newLabel) then LK_Fail('Namespaced global collision: ' + newLabel);
      rootGlobals := PCJSON_Append(rootGlobals, PCJSON_Quote(newLabel));
      globals := PCJSON_Put(globals, value, PCJSON_Quote(newLabel));
      j := j + 1
    end;
    labels := '{}';
    j := 0;
    while j < PCJSON_Count(LK_Included) do
    begin
      block := LK_Text(LK_Blocks, PCJSON_Text(PCJSON_Item(LK_Included, j)));
      pos := 0;
      while pos < host.string_length(block) do
      begin
        last := LK_LineEnd(block, pos);
        line := LK_Trim(host.string_slice(block, pos, last));
        if LK_IsLabel(line) then
        begin
          labelValue := host.string_slice(line, 0, host.string_length(line) - 1);
          newLabel := prefix + LK_Normal(labelValue);
          if PCJSON_Member(rootLabels, newLabel) <> '' then LK_Fail('Library ' + LK_Id + ' label ' + newLabel + ' collides with the root program');
          rootLabels := PCJSON_Put(rootLabels, newLabel, 'true');
          labels := PCJSON_Put(labels, labelValue, PCJSON_Quote(newLabel))
        end;
        pos := last + 1
      end;
      j := j + 1
    end;
    j := 0;
    while j < PCJSON_Count(exportKeys) do
    begin
      externalName := PCJSON_Text(PCJSON_Item(exportKeys, j));
      if not LK_Label(externalName) then LK_Fail('Library ' + LK_Id + ' export ' + externalName + ' is not a valid P-code label');
      if PCJSON_Member(rootLabels, externalName) <> '' then LK_Fail('Library ' + LK_Id + ' export ' + externalName + ' collides with another label');
      rootLabels := PCJSON_Put(rootLabels, externalName, 'true');
      j := j + 1
    end;
    snippets := '';
    base := address;
    j := 0;
    while j < PCJSON_Count(LK_Included) do
    begin
      labelValue := PCJSON_Text(PCJSON_Item(LK_Included, j));
      block := LK_Text(LK_Blocks, labelValue);
      procedureValue := PCJSON_Member(LK_Procedures, labelValue);
      params := LK_Array(PCJSON_Member(procedureValue, 'params'));
      locals := LK_Array(PCJSON_Member(procedureValue, 'locals'));
      k := 0;
      while k < PCJSON_Count(params) do
      begin
        locals := PCJSON_Append(locals, PCJSON_Item(params, k));
        k := k + 1
      end;
      if LK_Text(procedureValue, 'name') = '' then procedureValue := PCJSON_Put(procedureValue, 'name', PCJSON_Quote(labelValue));
      LK_RootProcedures := PCJSON_Put(LK_RootProcedures, LK_Text(labels, labelValue), procedureValue);
      sourceAddress := LK_Integer(PCJSON_Member(starts, labelValue));
      pos := 0;
      while pos < host.string_length(block) do
      begin
        last := LK_LineEnd(block, pos);
        line := host.string_slice(block, pos, last);
        if LK_Executable(line) then
        begin
          location := PCJSON_Member(LK_Obj(PCJSON_Member(libraryMap, 'sourceMap')), LK_Number(sourceAddress));
          if location <> '' then sourceMap := PCJSON_Put(sourceMap, LK_Number(address + shift), location);
          sourceAddress := sourceAddress + 1;
          address := address + 1
        end;
        if LK_IsLabel(LK_Trim(line)) then
          line := LK_Text(labels, host.string_slice(LK_Trim(line), 0, host.string_length(LK_Trim(line)) - 1)) + ':'
        else line := LK_Rewrite(line, labels, globals, locals);
        snippets := snippets + line + host.string_from_codepoint(10);
        pos := last + 1
      end;
      j := j + 1
    end;
    exportedNames := '{}';
    j := 0;
    while j < PCJSON_Count(exportKeys) do
    begin
      externalName := PCJSON_Text(PCJSON_Item(exportKeys, j));
      labelValue := LK_Text(resolved, externalName);
      procedureValue := PCJSON_Member(LK_Procedures, labelValue);
      params := LK_Array(PCJSON_Member(procedureValue, 'params'));
      location := PCJSON_Member(LK_Obj(PCJSON_Member(libraryMap, 'sourceMap')), PCJSON_Member(starts, labelValue));
      block := externalName + ':' + host.string_from_codepoint(10);
      k := 0;
      while k < PCJSON_Count(params) do
      begin
        block := block + 'LOAD ' + PCJSON_Text(PCJSON_Item(params, k)) + host.string_from_codepoint(10);
        k := k + 1
      end;
      block := block + 'CALL ' + LK_Text(labels, labelValue) + ' ' + LK_Number(PCJSON_Count(params)) + host.string_from_codepoint(10) + 'RET' + host.string_from_codepoint(10);
      pos := 0;
      while pos < host.string_length(block) do
      begin
        last := LK_LineEnd(block, pos);
        line := host.string_slice(block, pos, last);
        if LK_Executable(line) then
        begin
          if location <> '' then sourceMap := PCJSON_Put(sourceMap, LK_Number(address + shift), PCJSON_Put(location, 'instruction', PCJSON_Quote(line)));
          address := address + 1
        end;
        pos := last + 1
      end;
      snippets := snippets + block;
      value := PCJSON_Member(procedureValue, 'returnType');
      if value = '' then value := 'null';
      procedureValue := '{"name":' + PCJSON_Quote(externalName) + ',"returnType":' + value + ',"params":' + params + ',"locals":[]}';
      LK_RootProcedures := PCJSON_Put(LK_RootProcedures, externalName, procedureValue);
      exportedNames := PCJSON_Put(exportedNames, externalName, PCJSON_Quote(externalName));
      j := j + 1
    end;
    identity := '{"id":' + PCJSON_Quote(LK_Id) + ',"exports":' + exportedNames + ',"hash":' + PCJSON_Quote(host.text_hash_utf8(libraryText)) + '}';
    value := PCJSON_Member(libraryValue, 'version');
    if value <> '' then identity := PCJSON_Put(identity, 'version', value + ' ');
    if initLabel <> '' then
    begin
      identity := PCJSON_Put(identity, 'initialize', PCJSON_Quote(LK_Text(labels, initLabel)));
      initCalls := initCalls + 'CALL ' + LK_Text(labels, initLabel) + ' 0' + host.string_from_codepoint(10)
    end;
    rootMap := PCJSON_Put(rootMap, 'linkedLibraries', PCJSON_Append(LK_Array(PCJSON_Member(rootMap, 'linkedLibraries')), identity));
    rootMap := PCJSON_Put(rootMap, 'procedures', LK_RootProcedures);
    text := LK_Trim(text) + host.string_from_codepoint(10) + snippets;
    libraryCapabilities := LK_Array(PCJSON_Member(libraryMap, 'requiredHostCapabilities'));
    if PCJSON_Member(libraryValue, 'inferCapabilities') = 'true' then
    begin
      libraryCapabilities := '[]';
      pos := 0;
      while pos < host.string_length(snippets) do
      begin
        last := LK_LineEnd(snippets, pos);
        line := host.string_slice(snippets, pos, last);
        if LK_Token(line, 0) = 'CALL_EXT' then
        begin
          value := LK_Array(PCJSON_Member(bindingCapabilities, LK_Token(line, 1)));
          j := 0;
          while j < PCJSON_Count(value) do
          begin
            libraryCapabilities := LK_Add(libraryCapabilities, PCJSON_Text(PCJSON_Item(value, j)));
            j := j + 1
          end
        end;
        pos := last + 1
      end
    end;
    j := 0;
    while j < PCJSON_Count(libraryCapabilities) do
    begin
      capabilities := LK_Add(capabilities, PCJSON_Text(PCJSON_Item(libraryCapabilities, j)));
      j := j + 1
    end;
    value := PCJSON_Member(libraryMap, 'targets');
    if value <> '' then
    begin
      haveTargets := true;
      nextTargets := '[]';
      j := 0;
      while j < PCJSON_Count(targets) do
      begin
        if LK_Has(value, PCJSON_Text(PCJSON_Item(targets, j))) then nextTargets := PCJSON_Append(nextTargets, PCJSON_Item(targets, j));
        j := j + 1
      end;
      targets := nextTargets;
      if PCJSON_Count(targets) = 0 then LK_Fail('Library ' + LK_Id + ' has no compatible target')
    end;
    rootMap := LK_MergeVersion(rootMap, libraryMap, 'hostBindingsVersion', LK_Id);
    rootMap := LK_MergeVersion(rootMap, libraryMap, 'hostCapabilitiesVersion', LK_Id);
    i := i + 1
  end;
  if initCalls <> '' then
  begin
    block := '';
    pos := 0;
    while pos < host.string_length(text) do
    begin
      last := LK_LineEnd(text, pos);
      line := host.string_slice(text, pos, last);
      block := block + line + host.string_from_codepoint(10);
      if LK_Trim(line) = 'MAIN:' then block := block + initCalls;
      pos := last + 1
    end;
    text := block
  end;
  rootMap := PCJSON_Put(rootMap, 'globals', rootGlobals);
  rootMap := PCJSON_Put(rootMap, 'sourceMap', sourceMap);
  if PCJSON_Count(capabilities) > 0 then rootMap := PCJSON_Put(rootMap, 'requiredHostCapabilities', LK_Sort(capabilities));
  if haveTargets then rootMap := PCJSON_Put(rootMap, 'targets', targets);
  programValue := PCJSON_Put(programValue, 'pcodeText', PCJSON_Quote(text));
  return PCJSON_Put(programValue, 'programMap', rootMap)
end;

function Linker_Init(): integer;
begin
  PCODECS_Init();
  LK_Catalog := '[]';
  LK_State := '{}';
  LK_Order := '[]';
  return 1
end;

function Linker_Link(request: string): string;
var i: integer;
    libraries: string;
begin
  PCJSON_Validate(request);
  LK_Catalog := LK_Array(PCJSON_Member(request, 'libraries'));
  LK_State := '{}';
  LK_Order := '[]';
  libraries := LK_Catalog;
  i := 0;
  while i < PCJSON_Count(libraries) do
  begin
    LK_Dependency(PCJSON_Quote(LK_Text(PCJSON_Item(libraries, i), 'id')));
    i := i + 1
  end;
  return LK_LinkOrdered(request, LK_Order)
end;

function Linker_Resolve(request: string): string;
var required: string;
    i: integer;
begin
  PCJSON_Validate(request);
  LK_Catalog := LK_Array(PCJSON_Member(request, 'libraries'));
  LK_State := '{}';
  LK_Order := '[]';
  required := LK_Array(PCJSON_Member(request, 'required'));
  i := 0;
  while i < PCJSON_Count(required) do
  begin
    LK_Dependency(PCJSON_Item(required, i));
    i := i + 1
  end;
  return LK_LinkOrdered(request, LK_Order)
end;

function Linker_BindResources(request: string): string;
var resultMap: string;
    scopeSeen: string;
    scopes: string;
    bindings: string;
    binding: string;
    symbol: string;
    kind: string;
    old: string;
    keys: string;
    resultValue: string;
    i: integer;
    j: integer;
begin
  PCJSON_Validate(request);
  scopes := '["programDefaults","deployment","overrides"]';
  resultMap := '{}';
  i := 0;
  while i < 3 do
  begin
    scopeSeen := '{}';
    bindings := LK_Array(PCJSON_Member(request, PCJSON_Text(PCJSON_Item(scopes, i))));
    j := 0;
    while j < PCJSON_Count(bindings) do
    begin
      binding := PCJSON_Item(bindings, j);
      symbol := LK_Text(binding, 'symbol');
      kind := LK_Text(binding, 'kind');
      if (LK_Trim(symbol) = '') or (LK_Trim(LK_Text(binding, 'physicalName')) = '') then LK_Fail('Resource requires nonempty symbol and physicalName');
      if (kind <> 'queue') and (kind <> 'file') then LK_Fail('Invalid resource kind ' + kind);
      if PCJSON_Member(scopeSeen, symbol) <> '' then LK_Fail('Duplicate resource symbol ' + symbol);
      scopeSeen := PCJSON_Put(scopeSeen, symbol, 'true');
      old := PCJSON_Member(resultMap, symbol);
      if old <> '' then
        if LK_Text(old, 'kind') <> kind then LK_Fail('Resource kind changes for ' + symbol);
      resultMap := PCJSON_Put(resultMap, symbol, binding);
      j := j + 1
    end;
    i := i + 1
  end;
  keys := PCJSON_Keys(resultMap);
  resultValue := '[]';
  i := 0;
  while i < PCJSON_Count(keys) do
  begin
    resultValue := PCJSON_Append(resultValue, PCJSON_Member(resultMap, PCJSON_Text(PCJSON_Item(keys, i))));
    i := i + 1
  end;
  return resultValue
end;

function Linker_Resource(bindingsRaw: string; symbol: string; kind: string): string;
var i: integer;
    binding: string;
begin
  i := 0;
  while i < PCJSON_Count(bindingsRaw) do
  begin
    binding := PCJSON_Item(bindingsRaw, i);
    if LK_Text(binding, 'symbol') = symbol then
    begin
      if LK_Text(binding, 'kind') <> kind then LK_Fail('Wrong resource kind for ' + symbol);
      return binding
    end;
    i := i + 1
  end;
  LK_Fail('Missing resource binding ' + symbol);
  return ''
end;

begin
  Linker_Init()
end.
