service 'timer-dot-service';

post '/api/devices/timer-dot';
begin
  writeln('.');
  return '{"ok":true}'
end
end.
