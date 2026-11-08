service 'pulse-isam-library';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    state: JSONDocument;
    handles: JSONArray;
    fileState: JSONDocument;
    other: JSONDocument;
    image: JSONDocument;
    rows: JSONArray;
    row: JSONArray;
    replacement: JSONArray;
    alternateKeys: JSONArray;
    altInfo: JSONDocument;
    existingRow: JSONArray;
    response: JSONDocument;
    operation: string;
    mode: string;
    key: string;
    recordText: string;
    alternateName: string;
    alternateValue: string;
    existingAlternateValue: string;
    status: string;
    handleId: integer;
    slot: integer;
    found: integer;
    comparison: integer;
    index: integer;
    candidate: string;
    selected: string;
    selectedIndex: integer;
    alternateIndex: integer;
    recordIndex: integer;
    matchCount: integer;
    alternateOffset: integer;
    alternateLength: integer;
    relation: string;
    matched: boolean;
    duplicate: boolean;
    alternateDuplicate: boolean;

function rowKey(at: integer): string;
var value: JSONArray;
begin
  value.load(rows.item(at));
  return host.json_to_text(value.item(0))
end;

function findKey(value: string): integer;
var at: integer;
begin
  at := 0;
  while at < rows.count() do
  begin
    if rowKey(at) = value then return at;
    at := at + 1
  end;
  return -1
end;

procedure loadImage();
var at: integer;
    value: JSONArray;
begin
  image.load(host.fs_read_text(fileState.text('root'), fileState.text('path')));
  if (image.intValue('version') <> 1) or (image.text('keyName') <> fileState.text('keyName')) then
    host.raise_error('ISAM index file has an unsupported or mismatched format');
  rows.load(image.value('records'));
  if rows.count() > 1024 then host.raise_error('ISAM record capacity exceeded');
  at := 0;
  while at < rows.count() do
  begin
    value.load(rows.item(at));
    if value.count() <> 2 then host.raise_error('Invalid ISAM record');
    if (host.json_kind(value.item(0)) <> 'string') or (host.json_kind(value.item(1)) <> 'string') then
      host.raise_error('ISAM key and record must be strings');
    if at > 0 then
      if host.string_compare(rowKey(at - 1), rowKey(at)) >= 0 then
        host.raise_error('Duplicate or unordered key in ISAM image');
    at := at + 1
  end;
  fileState.embed('records', rows.serialize())
end;

procedure insertRow();
var at: integer;
    inserted: boolean;
begin
  replacement.load('[]');
  inserted := false;
  at := 0;
  while at < rows.count() do
  begin
    if not inserted then
      if host.string_compare(key, rowKey(at)) < 0 then
      begin
        replacement.append(row.serialize());
        inserted := true
      end;
    replacement.append(rows.item(at));
    at := at + 1
  end;
  if not inserted then replacement.append(row.serialize());
  rows.load(replacement.serialize())
end;

function persist(): boolean;
begin
  image.load('{}');
  image.setInteger('version', 1);
  image.setText('keyName', fileState.text('keyName'));
  image.embed('records', rows.serialize());
  if host.fs_write_text(fileState.text('root'), fileState.text('path'), image.serialize()) <> 0 then
  begin
    status := '30';
    return false
  end;
  fileState.embed('records', rows.serialize());
  fileState.setInteger('virtual', 0);
  return true
end;

procedure openFile();
begin
  mode := request.text('mode');
  if (mode <> 'INPUT') and (mode <> 'OUTPUT') and (mode <> 'I-O') and (mode <> 'EXTEND') then
    host.raise_error('Unsupported ISAM open mode');
  if handles.count() >= 64 then host.raise_error('ISAM open-handle capacity exceeded');
  duplicate := request.intValue('duplicate') = 1;
  index := 0;
  while index < handles.count() do
  begin
    other.load(handles.item(index));
    if (other.text('root') = request.text('root')) and (other.text('path') = request.text('path'))
      and (other.intValue('available') = 1) then duplicate := true;
    index := index + 1
  end;
  handleId := state.intValue('next');
  state.setInteger('next', handleId + 1);
  fileState.load('{}');
  fileState.setInteger('id', handleId);
  fileState.setText('root', request.text('root'));
  fileState.setText('path', request.text('path'));
  fileState.setText('keyName', request.text('keyName'));
  fileState.setText('mode', mode);
  fileState.setText('organization', request.text('organization'));
  fileState.setText('access', request.text('access'));
  fileState.embed('alternateKeys', request.value('alternateKeys'));
  fileState.setText('lastWriteKey', '');
  fileState.setInteger('available', 0);
  fileState.setInteger('positioned', 0);
  fileState.setInteger('pending', 0);
  fileState.setInteger('eof', 0);
  fileState.setInteger('virtual', 0);
  fileState.setText('cursor', '');
  fileState.embed('records', '[]');
  if request.intValue('locked') = 1 then status := '38'
  else if duplicate then status := '41'
  else if mode = 'OUTPUT' then
  begin
    rows.load('[]');
    if persist() then fileState.setInteger('available', 1)
  end
  else if host.fs_exists(request.text('root'), request.text('path')) = 0 then
  begin
    if mode = 'EXTEND' then
    begin
      rows.load('[]');
      if persist() then fileState.setInteger('available', 1)
    end
    else if request.intValue('optional') = 1 then
    begin
      rows.load('[]');
      fileState.embed('records', '[]');
      fileState.setInteger('available', 1);
      fileState.setInteger('virtual', 1);
      status := '05'
    end
    else status := '35'
  end
  else
  begin
    loadImage();
    fileState.setInteger('available', 1);
    if (fileState.text('organization') = 'INDEXED')
      and (fileState.text('access') = 'SEQUENTIAL') and (rows.count() > 0) then
    begin
      row.load(rows.item(rows.count() - 1));
      fileState.setText('lastWriteKey', host.json_to_text(row.item(0)))
    end
  end;
  fileState.setText('status', status);
  if status <> '30' then handles.append(fileState.serialize());
  response.setInteger('result', handleId)
end;

procedure selectNext();
begin
  if fileState.intValue('eof') = 1 then status := '46'
  else
  begin
    selectedIndex := -1;
    index := 0;
    while index < rows.count() do
    begin
      candidate := rowKey(index);
      matched := true;
      if fileState.intValue('positioned') = 1 then
      begin
        comparison := host.string_compare(candidate, fileState.text('cursor'));
        matched := comparison > 0
      end;
      if matched then
      begin
        if selectedIndex < 0 then
        begin
          selected := candidate;
          selectedIndex := index
        end
        else if host.string_compare(candidate, selected) < 0 then
        begin
          selected := candidate;
          selectedIndex := index
        end
      end;
      index := index + 1
    end;
    if fileState.intValue('pending') = 1 then
    begin
      selectedIndex := findKey(fileState.text('cursor'));
      fileState.setInteger('pending', 0)
    end;
    if selectedIndex < 0 then
    begin
      status := '10';
      fileState.setInteger('eof', 1);
      fileState.setInteger('positioned', 0)
    end
    else
    begin
      row.load(rows.item(selectedIndex));
      recordText := host.json_to_text(row.item(1));
      fileState.setText('cursor', rowKey(selectedIndex));
      fileState.setInteger('positioned', 1);
      fileState.setInteger('eof', 0)
    end
  end
end;

procedure startFile();
begin
  fileState.setInteger('eof', 0);
  relation := request.text('comparison');
  if (relation <> '=') and (relation <> '>') and (relation <> '>=') and (relation <> '<') and (relation <> '<=') then
    host.raise_error('Invalid ISAM START comparison');
  selectedIndex := -1;
  index := 0;
  while index < rows.count() do
  begin
    candidate := rowKey(index);
    comparison := host.string_compare(candidate, key);
    matched := ((relation = '=') and (comparison = 0))
      or ((relation = '>') and (comparison > 0))
      or ((relation = '>=') and (comparison >= 0))
      or ((relation = '<') and (comparison < 0))
      or ((relation = '<=') and (comparison <= 0));
    if matched then
    begin
      if selectedIndex < 0 then
      begin
        selected := candidate;
        selectedIndex := index
      end
      else if host.string_compare(candidate, selected) < 0 then
      begin
        selected := candidate;
        selectedIndex := index
      end
    end;
    index := index + 1
  end;
  if selectedIndex < 0 then
  begin
    status := '23';
    fileState.setInteger('pending', 0);
    fileState.setInteger('positioned', 0)
  end
  else
  begin
    fileState.setText('cursor', selected);
    fileState.setInteger('pending', 1);
    fileState.setInteger('positioned', 1)
  end
end;

procedure operate();
begin
  mode := fileState.text('mode');
  if fileState.intValue('available') = 0 then status := fileState.text('status')
  else
  begin
    rows.load(fileState.value('records'));
    if (operation = 'read') or (operation = 'read_next') or (operation = 'read_alt') or (operation = 'start') then
    begin
      if (mode = 'OUTPUT') or (mode = 'EXTEND') then status := '47'
      else
      begin
        if fileState.intValue('virtual') = 0 then loadImage();
        if operation = 'read_next' then selectNext()
        else if operation = 'start' then startFile()
        else if operation = 'read_alt' then
        begin
          alternateName := request.text('alternateKeyName');
          alternateKeys.load(fileState.value('alternateKeys'));
          alternateIndex := 0;
          while alternateIndex < alternateKeys.count() do
          begin
            altInfo.load(alternateKeys.item(alternateIndex));
            if altInfo.text('name') = alternateName then
            begin
              alternateOffset := altInfo.intValue('offset');
              alternateLength := altInfo.intValue('length');
              selectedIndex := -1;
              matchCount := 0;
              index := 0;
              while index < rows.count() do
              begin
                existingRow.load(rows.item(index));
                existingAlternateValue := host.string_slice(
                  host.json_to_text(existingRow.item(1)), alternateOffset, alternateOffset + alternateLength);
                if existingAlternateValue = key then
                begin
                  if selectedIndex < 0 then selectedIndex := index;
                  matchCount := matchCount + 1
                end;
                index := index + 1
              end;
              if selectedIndex < 0 then status := '23'
              else
              begin
                row.load(rows.item(selectedIndex));
                recordText := host.json_to_text(row.item(1));
                fileState.setText('cursor', rowKey(selectedIndex));
                fileState.setInteger('positioned', 1);
                fileState.setInteger('pending', 0);
                fileState.setInteger('eof', 0);
                if (matchCount > 1) and (altInfo.intValue('duplicates') = 1) then status := '02'
              end;
              alternateIndex := alternateKeys.count()
            end
            else alternateIndex := alternateIndex + 1
          end
        end
        else
        begin
          found := findKey(key);
          if found < 0 then status := '23'
          else
          begin
            row.load(rows.item(found));
            recordText := host.json_to_text(row.item(1));
            fileState.setText('cursor', key);
            fileState.setInteger('positioned', 1);
            fileState.setInteger('pending', 0);
            fileState.setInteger('eof', 0)
          end
        end
      end
    end
    else if (operation = 'write') or (operation = 'rewrite') or (operation = 'delete') then
    begin
      if operation <> 'delete' then
        if host.json_kind(request.value('record')) <> 'string' then
          host.raise_error('ISAM WRITE/REWRITE requires a string record');
      if (operation = 'write') and (mode = 'INPUT') then status := '48'
      else if (operation <> 'write') and (mode <> 'I-O') then status := '49'
      else if (operation = 'rewrite') and (fileState.text('organization') = 'SEQUENTIAL')
        and (fileState.intValue('positioned') = 0) then status := '43'
      else
      begin
        if fileState.intValue('virtual') = 0 then loadImage();
        found := findKey(key);
        alternateDuplicate := false;
        if operation = 'write' then
        begin
          duplicate := false;
          alternateKeys.load(fileState.value('alternateKeys'));
          alternateIndex := 0;
          while alternateIndex < alternateKeys.count() do
          begin
            altInfo.load(alternateKeys.item(alternateIndex));
            alternateOffset := altInfo.intValue('offset');
            alternateLength := altInfo.intValue('length');
            alternateValue := host.string_slice(
              request.text('record'), alternateOffset, alternateOffset + alternateLength);
            recordIndex := 0;
            while recordIndex < rows.count() do
            begin
              existingRow.load(rows.item(recordIndex));
              existingAlternateValue := host.string_slice(
                host.json_to_text(existingRow.item(1)), alternateOffset, alternateOffset + alternateLength);
              if existingAlternateValue = alternateValue then
                if altInfo.intValue('duplicates') = 1 then alternateDuplicate := true
                else duplicate := true;
              recordIndex := recordIndex + 1
            end;
            alternateIndex := alternateIndex + 1
          end
        end;
        if (operation = 'write') and (found >= 0) then status := '22'
        else if (operation = 'write') and (fileState.text('organization') = 'INDEXED')
          and (fileState.text('access') = 'SEQUENTIAL')
          and (fileState.text('lastWriteKey') <> '')
          and (host.string_compare(key, fileState.text('lastWriteKey')) <= 0) then status := '21'
        else if (operation = 'write') and duplicate then status := '22'
        else if (operation <> 'write') and (found < 0) then status := '23'
        else
        begin
          if operation = 'delete' then rows.remove(found)
          else
          begin
            row.load('[]');
            row.append(request.value('key'));
            row.append(request.value('record'));
            if operation = 'rewrite' then rows.replace(found, row.serialize())
            else
            begin
              if rows.count() >= 1024 then host.raise_error('ISAM record capacity exceeded');
              insertRow()
            end
          end;
          if (operation = 'write') and alternateDuplicate then status := '02';
          persist();
          if (operation = 'write') and ((status = '00') or (status = '02')) then
            if (fileState.text('organization') = 'INDEXED')
              and (fileState.text('access') = 'SEQUENTIAL') then fileState.setText('lastWriteKey', key)
        end
      end
    end
    else host.raise_error('Unknown ISAM operation')
  end
end;

post '/isam';
begin
  request.load(host.event_body());
  state.load(request.value('state'));
  handles.load(state.value('handles'));
  response.load('{}');
  operation := request.text('operation');
  status := '00';
  recordText := '';
  if operation = 'open' then openFile()
  else
  begin
    handleId := request.intValue('handle');
    slot := -1;
    index := 0;
    while index < handles.count() do
    begin
      fileState.load(handles.item(index));
      if fileState.intValue('id') = handleId then slot := index;
      index := index + 1
    end;
    if slot < 0 then
    begin
      if (operation = 'close') or (operation = 'close_lock') then status := '42'
      else host.raise_error('Invalid ISAM file handle')
    end
    else
    begin
      fileState.load(handles.item(slot));
      key := request.text('key');
      if (operation = 'close') or (operation = 'close_lock') then
      begin
        if fileState.intValue('available') = 0 then status := '42';
        handles.remove(slot)
      end
      else if operation = 'count' then
      begin
        if fileState.intValue('available') = 1 then
        begin
          rows.load(fileState.value('records'));
          response.setInteger('count', rows.count())
        end
        else response.setInteger('count', 0)
      end
      else if operation = 'current_key' then response.setText('key', fileState.text('cursor'))
      else
      begin
        operate();
        fileState.setText('status', status);
        handles.replace(slot, fileState.serialize())
      end
    end;
    response.setInteger('result', 0)
  end;
  state.embed('handles', handles.serialize());
  response.embed('state', state.serialize());
  response.setText('status', status);
  response.setText('record', recordText);
  return response.serialize()
end
end.
