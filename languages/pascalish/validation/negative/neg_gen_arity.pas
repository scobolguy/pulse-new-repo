program NegGenArity;

{$APPTYPE CONSOLE}

type
  TBox<T> = class
  end;

var
  B: TBox<Integer, string>;  // wrong number of generic parameters
begin
end.
