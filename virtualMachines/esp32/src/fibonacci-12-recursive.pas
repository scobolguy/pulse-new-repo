program RecursiveFibonacci;

procedure PrintFibRange(i, max, a, b: integer);
begin
  if i < max then
  begin
    writeln('fib(', i, ')=', a);
    PrintFibRange(i + 1, max, b, a + b)
  end
end;

begin
  PrintFibRange(0, 12, 0, 1)
end.
