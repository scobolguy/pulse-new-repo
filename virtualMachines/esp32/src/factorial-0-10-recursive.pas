program RecursiveFactorial;

procedure PrintFactRange(i, max, acc: integer);
begin
  if i <= max then
  begin
    writeln('fact(', i, ')=', acc);
    PrintFactRange(i + 1, max, acc * (i + 1))
  end
end;

begin
  PrintFactRange(0, 10, 1)
end.
