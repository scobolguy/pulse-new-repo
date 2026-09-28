program FibonacciSmoke;

var
  counter, sum : integer;

begin
  counter := 0;
  sum := 0;

  while counter < 3 do
  begin
    sum := sum + counter;
    counter := counter + 1
  end;

  enqueue outputQueue with sum
end.
