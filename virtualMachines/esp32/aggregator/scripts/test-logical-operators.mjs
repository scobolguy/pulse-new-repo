import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

const src = `program TestLogical;
var x, y : integer;
begin
  x := 3;
  y := 7;
  if (x > 0) and (y > 0) then
    writeln('both positive')
  else
    writeln('not both positive');
  if (x < 0) or (y > 0) then
    writeln('one or both condition')
  else
    writeln('neither condition');
  if not (x = y) then
    writeln('x not equal y')
  else
    writeln('x equals y')
end.`;

try {
  const result = compilePascalishProgramWithAntlr(src);
  console.log('=== PCODE ===');
  console.log(result.pcodeText);
} catch(e) {
  console.error('ERROR:', e.message);
}
