program FactorialService;

var n, result, i : integer;

procedure factorial(x : integer);
begin
  if x <= 1 then
    result := 1
  else begin
    factorial(x - 1);
    result := result * x
  end
end;

begin
  n := src;
  if (n >= 0) and (n <= 10) and (not (src = 'Invalid input')) then begin
    if (n = 0) and (not (src = '0')) then
      writeln('Invalid input')
    else begin
      result := 1;
      factorial(n);
      writeln(result)
    end
  end else
    writeln('Invalid input')
end.
