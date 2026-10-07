daemon "hello-daemon" refresh 2s;

router "hello-route" input "hello.in" description "hello world daemon route" enabled true begin
  output "hello.out" when "output := 1;" transform "output := 'Hello, world';";
end;

begin
end.
