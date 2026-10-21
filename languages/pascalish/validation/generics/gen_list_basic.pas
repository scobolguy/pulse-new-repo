program GenListBasic;

{$APPTYPE CONSOLE}

type
  TList<T> = class
  private
    FItems: array of T;
  public
    procedure Add(const AItem: T);
    function GetItem(Index: Integer): T;
    function Count: Integer;
  end;

procedure TList<T>.Add(const AItem: T);
var
  N: Integer;
begin
  N := Length(FItems);
  SetLength(FItems, N + 1);
  FItems[N] := AItem;
end;

function TList<T>.GetItem(Index: Integer): T;
begin
  Result := FItems[Index];
end;

function TList<T>.Count: Integer;
begin
  Result := Length(FItems);
end;

var
  IntList: TList<Integer>;
  I, Sum: Integer;
begin
  IntList := TList<Integer>.Create;
  try
    for I := 1 to 5 do
      IntList.Add(I);

    Sum := 0;
    for I := 0 to IntList.Count - 1 do
      Sum := Sum + IntList.GetItem(I);

    if (IntList.Count = 5) and (Sum = 15) then
      Writeln('TEST gen_list_basic: OK')
    else
      Writeln('TEST gen_list_basic: FAIL');
  finally
    IntList.Free;
  end;
end.
