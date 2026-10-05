daemon 'discovery-maintenance' every 1 second;
begin
  host.table_expire('nodes')
end.
