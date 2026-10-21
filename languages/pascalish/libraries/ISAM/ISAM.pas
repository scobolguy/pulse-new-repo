program "ISAM";

class ISAMFile;
  handle: integer;
  status: string;

  procedure openFile(root: string; path: string; keyName: string; mode: string);
  begin
    self.handle := host.isam_open(root, path, keyName, host.string_upper(mode));
    self.status := host.isam_status(self.handle)
  end;

  function readRecord(key: string): string;
  begin
    return host.isam_read(self.handle, key)
  end;

  function readNextRecord(): string;
  begin
    return host.isam_read_next(self.handle)
  end;

  function startAt(key: string; comparison: string): integer;
  begin
    return host.isam_start(self.handle, key, comparison)
  end;

  function writeRecord(key: string; recordValue: string): integer;
  begin
    return host.isam_write(self.handle, key, recordValue)
  end;

  function rewriteRecord(key: string; recordValue: string): integer;
  begin
    return host.isam_rewrite(self.handle, key, recordValue)
  end;

  function deleteRecord(key: string): integer;
  begin
    return host.isam_delete(self.handle, key)
  end;

  procedure closeFile();
  begin
    host.isam_close(self.handle);
    self.handle := 0;
    self.status := '00'
  end;

  function lastStatus(): string;
  begin
    if self.handle > 0 then self.status := host.isam_status(self.handle);
    return self.status
  end;
end;

begin
end.
