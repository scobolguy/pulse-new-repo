program CoreControlFlow;

{$APPTYPE CONSOLE}

var
  I, Sum: Integer;
begin
  Sum := 0;

  for I := 1 to 10 do
    Sum := Sum + I;

  if Sum <> 55 then
  begin
    Writeln('TEST core_control_flow: FAIL (for)');
    Exit;
  end;

  I := 0;
  while I < 5 do
    Inc(I);

  if I <> 5 then
  begin
    Writeln('TEST core_control_flow: FAIL (while)');
    Exit;
  end;

  I := 0;
  repeat
    Inc(I);
  until I = 3;

  if I <> 3 then
  begin
    Writeln('TEST core_control_flow: FAIL (repeat)');
    Exit;
  end;

  Writeln('TEST core_control_flow: OK');
end.
