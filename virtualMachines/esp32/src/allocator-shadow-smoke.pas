program "allocator-shadow-smoke";

router "allocator-shadow-smoke-route" input "allocator.shadow.test.in" description "Emit deterministic smoke payload" enabled true begin
  output "allocator.shadow.test.out" when "output := 1;" transform "output := '{\"smoke\":\"allocator-shadow\",\"source\":\"pascalish\"}';";
end;

begin
end.
