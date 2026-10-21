program "JSON";

class JSONDocument;
  raw: string;

  procedure load(value: string);
  begin
    self.raw := host.json_merge(value, '{}')
  end;

  function serialize(): string;
  begin
    return self.raw
  end;

  function text(key: string): string;
  begin
    return host.json_text(self.raw, key)
  end;

  function intValue(key: string): integer;
  begin
    return host.json_integer(self.raw, key)
  end;

  function value(key: string): string;
  begin
    return host.json_value(self.raw, key)
  end;

  function pathText(path: string): string;
  begin
    return host.json_path_text(self.raw, path)
  end;

  function pathInteger(path: string): integer;
  begin
    return host.json_path_integer(self.raw, path)
  end;

  procedure setText(key: string; value: string);
  begin
    self.raw := host.json_set(self.raw, key, value)
  end;

  procedure setInteger(key: string; value: integer);
  begin
    self.raw := host.json_set(self.raw, key, value)
  end;

  procedure setBoolean(key: string; value: boolean);
  begin
    if value then
      self.raw := host.json_embed(self.raw, key, 'true')
    else
      self.raw := host.json_embed(self.raw, key, 'false')
  end;

  procedure embed(key: string; value: string);
  begin
    self.raw := host.json_embed(self.raw, key, value)
  end;

  procedure merge(value: string);
  begin
    self.raw := host.json_merge(self.raw, value)
  end;

  procedure appendText(key: string; value: string);
  begin
    self.raw := host.json_append(self.raw, key, value)
  end;
end;

function JSON_ContainsEncodedToken(values: string; encodedValue: string): boolean;
begin
  return host.text_index(values, '"' + encodedValue + '"') >= 0
end;

begin
end.
