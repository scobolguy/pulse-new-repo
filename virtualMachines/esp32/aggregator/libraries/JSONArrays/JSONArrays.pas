program "JSONArrays";

class JSONArray;
  raw: string;

  procedure load(value: string);
  begin
    host.json_array_count(value);
    self.raw := value
  end;

  function serialize(): string;
  begin return self.raw end;

  function count(): integer;
  begin return host.json_array_count(self.raw) end;

  function item(index: integer): string;
  begin return host.json_array_get(self.raw, index) end;

  procedure append(value: string);
  begin self.raw := host.json_array_append(self.raw, value) end;

  procedure replace(index: integer; value: string);
  begin self.raw := host.json_array_set(self.raw, index, value) end;

  procedure remove(index: integer);
  begin self.raw := host.json_array_remove(self.raw, index) end;

  function formatted(indent: integer): string;
  begin return host.json_format(self.raw, indent) end;
end;

begin
end.
