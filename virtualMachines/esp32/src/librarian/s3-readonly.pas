service 'pulse-librarian-s3-readonly';
requires service 'pulse-filesystem';

get '/api/librarian/health';
begin
  return '{"status":"ok","service":"pulse-librarian-s3-readonly","profile":"read-only"}'
end

post '/api/librarian/filesystem/health';
begin
  host.http_status(202);
  return host.service_submit('pulse-filesystem', '/health', '{}')
end

post '/api/librarian/catalogs';
begin
  host.http_status(202);
  return host.service_submit('pulse-filesystem', '/catalogs', '{}')
end

post '/api/librarian/catalog/page';
begin
  host.http_status(202);
  return host.service_submit('pulse-filesystem', '/catalog/page', host.event_body())
end

post '/api/librarian/schemas/page';
begin
  host.http_status(202);
  return host.service_submit('pulse-filesystem', '/schemas/page', host.event_body())
end

post '/api/librarian/schema-tree/page';
begin
  host.http_status(202);
  return host.service_submit('pulse-filesystem', '/schema-tree/page', host.event_body())
end

end.
