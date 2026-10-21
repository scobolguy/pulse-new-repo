program CoreClasses;

{$APPTYPE CONSOLE}

type
  TCounter = class
  private
    FValue: Integer;
  public
    procedure Inc;
    function GetValue: Integer;
  end;

procedure TCounter.Inc;
begin
  Inc(FValue);
end;

function TCounter.GetValue: Integer;
begin
  Result := FValue;
end;

var
  C: TCounter;
begin
  C := TCounter.Create;
  try
    C.Inc;
    C.Inc;
    if C.GetValue = 2 then
      Writeln('TEST core_classes: OK')
    else
      Writeln('TEST core_classes: FAIL');
  finally
    C.Free;
  end;
end.
