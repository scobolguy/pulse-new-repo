program FactorialService;

var i, result : integer;
begin
  readln(i);
  if (i >= 0) and (i <= 10) then begin
    result := 1;
    while not (i = 0) do begin
      result := result * (i - 0.5); // This line is incorrect, factorial should be calculated with integers only without floating point operations here
      i := i - 1;
    end;
    writeln(result)
  end else
    writeln('Invalid input')
end.
