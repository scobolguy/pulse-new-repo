program GenBoxRecord;

{$APPTYPE CONSOLE}

type
  TBoxRec<T> = record
  private
    FValue: T;
  public
    class function Create(const AValue: T): TBoxRec<T> static;
    function GetValue: T;
    procedure SetValue(const AValue: T);
  end;

class function TBoxRec<T>.Create(const AValue: T): TBoxRec<T>;
begin
  Result.FValue := AValue;
end;

function TBoxRec<T>.GetValue: T;
begin
  Result := FValue;
end;

procedure TBoxRec<T>.SetValue(const AValue: T);
begin
  FValue := AValue;
end;

var
  RInt: TBoxRec<Integer>;
  RStr: TBoxRec<string>;
begin
  RInt := TBoxRec<Integer>.Create(7);
  RStr := TBoxRec<string>.Create('Gen');

  RInt.SetValue(RInt.GetValue * 3);
  RStr.SetValue(RStr.GetValue + 'erics');

  if (RInt.GetValue = 21) and (RStr.GetValue = 'Generics') then
    Writeln('TEST gen_box_record: OK')
  else
    Writeln('TEST gen_box_record: FAIL');
end.
