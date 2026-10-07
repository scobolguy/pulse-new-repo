program PascalishEmitProof;

var
  n: integer;

begin
  n := 42;
  enqueue metrics_out with n;
  enqueue events_out with 7;
  writeln('done')
end.
