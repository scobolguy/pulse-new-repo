service 'pcode-linker';
use "Linker";

post '/link';
begin
  Linker_Init();
  return Linker_Link(host.event_body())
end

post '/resolve';
begin
  Linker_Init();
  return Linker_Resolve(host.event_body())
end

post '/bindings';
begin
  Linker_Init();
  return Linker_BindResources(host.event_body())
end

end.
