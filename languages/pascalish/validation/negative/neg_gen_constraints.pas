program NegGenConstraints;

{$APPTYPE CONSOLE}

type
  TRefBox<T: class> = class
  end;

var
  B: TRefBox<Integer>;  // Integer is not a class type
begin
end.
