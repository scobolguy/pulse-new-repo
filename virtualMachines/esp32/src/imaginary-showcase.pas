{ Complex arithmetic with operator syntax. }

program ComplexShowcase;

use "imaginary";

var
  z: Complex;
  w: Complex;
  t: Complex;
  modulus: real;
  realPart: real;

begin
  z.re := 3.0;
  z.im := 4.0;
  w.re := 1.0;
  w.im := 0.0 - 2.0;

  writeln('z = ', z.toString());
  writeln('w = ', w.toString());

  t := z + w;
  writeln('z + w = ', t.toString());

  t := z - w;
  writeln('z - w = ', t.toString());

  t := z * w;
  writeln('z * w = ', t.toString());

  t := z / w;
  writeln('z / w = ', t.toString());

  t := z.conj();
  writeln('conj z = ', t.toString());

  { a real widens into a Complex implicitly }
  t := z + 1.0;
  writeln('z + 1 = ', t.toString());

  t := z * 2.0;
  writeln('z * 2 = ', t.toString());

  modulus := z.abs();
  writeln('abs z = ', modulus);

  { explicit narrowing back to real }
  realPart := real(z);
  writeln('real z = ', realPart)
end.
