program CobolRuntimeCore;

function COBOL_RT_ABS(value: real): real;
begin
  if value < 0 then return 0 - value;
  return value
end;

function COBOL_RT_MAX_NUMERIC2(left: real; right: real): real;
begin
  if left > right then return left;
  return right
end;

function COBOL_RT_MIN_NUMERIC2(left: real; right: real): real;
begin
  if left < right then return left;
  return right
end;

begin
end.
