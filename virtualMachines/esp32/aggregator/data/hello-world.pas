service "hello-world";
router "hello-route" input "hello.in" description "hello world route" enabled true begin
  output "hello.out" when "output := 1;" transform "output := 'Hello, world';";
end;
