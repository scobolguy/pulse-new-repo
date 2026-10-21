program CoreLiterals;

{$APPTYPE CONSOLE}

uses
  SysUtils;

var
  I: Integer;
  R: Double;
  B: Boolean;
  C: Char;
  S: String;
begin
  I := 42;
  R := 3.5e2;
  B := True;
  C := 'A';
  S := 'Hello';

  if (I = 42) and (Abs(R - 350.0) < 1e-9) and B and (C = 'A') and (S = 'Hello') then
    Writeln('TEST core_literals: OK')
  else
    Writeln('TEST core_literals: FAIL');
end.
