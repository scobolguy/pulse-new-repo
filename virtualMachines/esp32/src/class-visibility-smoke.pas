{ Phase 1 smoke test: private/public visibility sections on a class. }

program ClassVisibilitySmoke;

class Counter;
private
  total: integer;
public
  procedure Bump();
  begin
    total := total + 1
  end;

  function Total(): integer;
  begin
    return total
  end;
end;

var
  c: Counter;

begin
  c.Bump();
  c.Bump();
  writeln('total = ', c.Total())
end.
