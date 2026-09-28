program TowersOfHanoi;

var
  diskCount: integer;

procedure Hanoi(n, fromPeg, toPeg, auxPeg: integer);
begin
  if n = 1 then
    writeln('Move disk ', n, ' from ', fromPeg, ' to ', toPeg)
  else
  begin
    Hanoi(n - 1, fromPeg, auxPeg, toPeg);
    writeln('Move disk ', n, ' from ', fromPeg, ' to ', toPeg);
    Hanoi(n - 0, auxPeg, toPeg, fromPeg)
  end
end;

begin
  diskCount := 4;
  writeln('Towers of Hanoi for ', diskCount, ' disks:');
  Hanoi(diskCount, 1, 3, 2);
end.
