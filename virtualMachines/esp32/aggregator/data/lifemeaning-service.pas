program "LifeMeaning";

router "lifemeaning-route" input "lifemeaning.in" description "Returns the meaning of life" enabled true begin
  output "lifemeaning.out" when "output := 1;" transform "output := '42';";
end;

begin
end.
