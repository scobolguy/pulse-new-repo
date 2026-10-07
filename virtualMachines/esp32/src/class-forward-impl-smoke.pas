{ Phase 3 smoke test: forward-declared class methods implemented later via
  TypeName.Method, plus constructor/destructor keywords. }

program ClassForwardImplSmoke;

class Counter;
private
  total: integer;
public
  constructor Create();
  procedure Bump();
  function Total(): integer;
  destructor Destroy();
end;

constructor Counter.Create();
begin
  total := 0
end;

procedure Counter.Bump();
begin
  total := total + 1
end;

function Counter.Total(): integer;
begin
  return total
end;

destructor Counter.Destroy();
begin
  total := -1
end;

var
  c: Counter;

begin
  c.Create();
  c.Bump();
  c.Bump();
  c.Bump();
  writeln('total = ', c.Total());
  c.Destroy();
  writeln('after destroy = ', c.Total())
end.
