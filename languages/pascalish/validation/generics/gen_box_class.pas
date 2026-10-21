program GenBoxClass;

{$APPTYPE CONSOLE}

type
  TBox<T> = class
  private
    FValue: T;
  public
    constructor Create(const AValue: T);
    function GetValue: T;
    procedure SetValue(const AValue: T);
  end;

constructor TBox<T>.Create(const AValue: T);
begin
  FValue := AValue;
end;

function TBox<T>.GetValue: T;
begin
  Result := FValue;
end;

procedure TBox<T>.SetValue(const AValue: T);
begin
  FValue := AValue;
end;

var
  IntBox: TBox<Integer>;
  StrBox: TBox<string>;
begin
  IntBox := TBox<Integer>.Create(10);
  StrBox := TBox<string>.Create('Hello');
  try
    IntBox.SetValue(IntBox.GetValue + 5);
    StrBox.SetValue(StrBox.GetValue + ' World');

    if (IntBox.GetValue = 15) and (StrBox.GetValue = 'Hello World') then
      Writeln('TEST gen_box_class: OK')
    else
      Writeln('TEST gen_box_class: FAIL');
  finally
    IntBox.Free;
    StrBox.Free;
  end;
end.
