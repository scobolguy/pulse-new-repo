program "hello";

router "hello-route" input "hello.in" description "Simple hello service" enabled true begin
  output "hello.out" when "output := 1;" transform "output := 'hello, world';";
end;
