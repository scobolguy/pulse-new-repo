program PascalishEmitProof;

var
  n: integer;

begin
  n := 42;
  emit(metrics_out, n);
  send(events_out, 7);
  writeln('done')
end.
