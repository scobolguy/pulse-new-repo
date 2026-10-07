daemon 'kasa-maintenance' every 1 second;
begin
  host.table_expire('devices')
end.
