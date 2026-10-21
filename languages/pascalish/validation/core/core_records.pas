program CoreRecords;

{$APPTYPE CONSOLE}

type
  TPoint = record
    X, Y: Integer;
  end;

var
  P: TPoint;
begin
  P.X := 10;
  P.Y := 20;

  if (P.X = 10) and (P.Y = 20) then
    Writeln('TEST core_records: OK')
  else
    Writeln('TEST core_records: FAIL');
end.
