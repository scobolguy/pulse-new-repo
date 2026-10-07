{ Negative test: a forward-declared method with no implementation must fail compilation. }

program ClassForwardMissingImplSmoke;

class Counter;
public
  procedure Bump();
end;

var
  c: Counter;

begin
  c.Bump()
end.
