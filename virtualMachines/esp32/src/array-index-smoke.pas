{ Phase (array indexing) smoke test: runtime-variable array read/write via ARR_GET/ARR_SET. }

program ArrayIndexSmoke;

var
  nums: array[0..4] of integer;
  i: integer;

begin
  for i := 0 to 4 do
    nums[i] := i * 10;
  writeln('nums[3] = ', nums[3]);
  i := 2;
  nums[i] := nums[i] + 1;
  writeln('nums[2] = ', nums[2])
end.
