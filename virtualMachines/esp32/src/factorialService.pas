service factorialService on local;
  var n, factorial, i: integer;

  get "/" accepts integer returns integer;
  begin
    n := parseInt(sourceValue("n"));
    factorial := 0;
    if n >= 1 then
      if n <= 10 then
      begin
        factorial := 1;
        for i := 1 to n do
          factorial := factorial * i;
      end;
    return factorial;
  end
end.