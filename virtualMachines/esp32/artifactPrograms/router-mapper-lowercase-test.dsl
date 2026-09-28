service "svc";
router "r1" input "q.in" description "demo" enabled true begin
  output "q.out" when "output := 1;" transform "output := src;";
end;
