program MutualRecursionEvenOdd;

var
  parity: integer;

procedure IsEven(n: integer);
begin
  if n = 0 then
    parity := 1
  else
    IsOdd(n - 1)
end;

procedure IsOdd(n: integer);
begin
  if n = 0 then
    parity := 0
  else
    IsEven(n - 1)
end;

procedure PrintChecks(i, max: integer);
begin
  if i <= max then
  begin
    IsEven(i);
    writeln('even(', i, ')=', parity);
    IsOdd(i);
    writeln('odd(', i, ')=', parity);
    PrintChecks(i + 1, max)
  end
end;

begin
  PrintChecks(0, 11)
end.
