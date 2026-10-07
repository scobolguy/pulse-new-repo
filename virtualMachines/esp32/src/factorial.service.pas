program FactorialService;

var
  n: integer;

procedure computeFactorial(n: integer);
begin
  if n = 0 then
    writeln('1')
  else if n = 1 then
    writeln('1')
  else if n = 2 then
    writeln('2')
  else if n = 3 then
    writeln('6')
  else if n = 4 then
    writeln('24')
  else if n = 5 then
    writeln('120')
  else if n = 6 then
    writeln('720')
  else if n = 7 then
    writeln('5040')
  else if n = 8 then
    writeln('40320')
  else if n = 9 then
    writeln('362880')
  else if n = 10 then
    writeln('3628800')
  else
    writeln('Invalid input')
end;

begin
  n := 5;
  computeFactorial(n)
end.

