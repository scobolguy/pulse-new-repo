{ Negative test: external code writing a private field directly must be rejected. }

program ClassVisibilityRejectSmoke;

class Counter;
private
  total: integer;
public
  procedure Bump();
  begin
    total := total + 1
  end;
end;

var
  c: Counter;

begin
  c.total := 5;
  c.Bump()
end.
