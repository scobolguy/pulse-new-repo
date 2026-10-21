program Arithmetic;
var I, Sum: integer;
begin
  Sum := 0;
  for I := 1 to 10 do
    Sum := Sum + I;
  if Sum = 55 then
    writeln('TEST arithmetic: OK')
  else
    writeln('TEST arithmetic: FAIL');
end.
