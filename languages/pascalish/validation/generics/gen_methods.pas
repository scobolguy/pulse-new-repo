program GenMethods;

{$APPTYPE CONSOLE}

type
  TUtil = class
  public
    class function Swap<T>(var A, B: T): Boolean; static;
  end;

class function TUtil.Swap<T>(var A, B: T): Boolean;
var
  Temp: T;
begin
  Temp := A;
  A := B;
  B := Temp;
  Result := True;
end;

var
  I1, I2: Integer;
  S1, S2: string;
begin
  I1 := 1; I2 := 2;
  S1 := 'Left'; S2 := 'Right';

  if not TUtil.Swap<Integer>(I1, I2) then
  begin
    Writeln('TEST gen_methods: FAIL (int swap)');
    Exit;
  end;

  if not TUtil.Swap<string>(S1, S2) then
  begin
    Writeln('TEST gen_methods: FAIL (string swap)');
    Exit;
  end;

  if (I1 = 2) and (I2 = 1) and (S1 = 'Right') and (S2 = 'Left') then
    Writeln('TEST gen_methods: OK')
  else
    Writeln('TEST gen_methods: FAIL');
end.
