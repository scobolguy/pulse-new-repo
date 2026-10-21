program GenConstraints;

{$APPTYPE CONSOLE}

type
  TRefBox<T: class> = class
  private
    FRef: T;
  public
    constructor Create(ARef: T);
    function GetRef: T;
  end;

constructor TRefBox<T>.Create(ARef: T);
begin
  FRef := ARef;
end;

function TRefBox<T>.GetRef: T;
begin
  Result := FRef;
end;

type
  TMyClass = class
  private
    FValue: Integer;
  public
    constructor Create(AValue: Integer);
    function GetValue: Integer;
  end;

constructor TMyClass.Create(AValue: Integer);
begin
  FValue := AValue;
end;

function TMyClass.GetValue: Integer;
begin
  Result := FValue;
end;

var
  Obj: TMyClass;
  Box: TRefBox<TMyClass>;
begin
  Obj := TMyClass.Create(99);
  Box := TRefBox<TMyClass>.Create(Obj);
  try
    if Box.GetRef.GetValue = 99 then
      Writeln('TEST gen_constraints: OK')
    else
      Writeln('TEST gen_constraints: FAIL');
  finally
    Box.Free;
    Obj.Free;
  end;
end.
