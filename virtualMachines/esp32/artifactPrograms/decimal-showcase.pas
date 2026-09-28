{ COBOL-compatible fixed-point arithmetic.

  decimal(p, s) mirrors PIC S9(p-s)V9(s): the receiving field fixes the result scale,
  truncating by default and rounding half-up away from zero with ROUNDED.
}

program DecimalShowcase;

var
  price: decimal(11, 2);
  qty: decimal(9, 0);
  gross: decimal(13, 2);
  vat: decimal(13, 2);
  vatRounded: decimal(13, 2);
  share: decimal(13, 2);
  shareRounded: decimal(13, 2);
  running: decimal(15, 2);
  step: integer;

begin
  price := 19.99;
  qty := 3;

  gross := price * qty;
  writeln('gross     = ', gross);

  { 59.97 * 0.125 = 7.49625 -> truncated to 7.49, rounded to 7.50 }
  vat := gross * 0.125;
  vatRounded := gross * 0.125 rounded;
  writeln('fee trunc = ', vat);
  writeln('fee round = ', vatRounded);

  { 10 / 3 is exact to the intermediate scale, then quantized by the field }
  share := 10.0 / 3.0;
  shareRounded := 20.0 / 3.0 rounded;
  writeln('share     = ', share);
  writeln('share rnd = ', shareRounded);

  { the classic float failure: 0.1 added a hundred times }
  running := 0.0;
  step := 0;
  while step < 100 do
  begin
    running := running + 0.1;
    step := step + 1
  end;
  writeln('sum 0.1   = ', running);

  if running = 10.0 then
    writeln('exact     = yes')
  else
    writeln('exact     = no')
end.
