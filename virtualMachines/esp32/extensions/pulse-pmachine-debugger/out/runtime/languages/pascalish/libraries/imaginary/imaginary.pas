{ Complex numbers as a class with overloaded operators.

  `use "imaginary";` makes Complex a first-class type: +, -, *, / and = work directly,
  a real widens into a Complex implicitly, and real(z) narrows explicitly.
}

program "imaginary";

class Complex;
  re: real;
  im: real;

  operator +(b: Complex): Complex;
  var r: Complex;
  begin
    r.re := self.re + b.re;
    r.im := self.im + b.im;
    return r
  end;

  operator -(b: Complex): Complex;
  var r: Complex;
  begin
    r.re := self.re - b.re;
    r.im := self.im - b.im;
    return r
  end;

  operator *(b: Complex): Complex;
  var r: Complex;
  begin
    r.re := self.re * b.re - self.im * b.im;
    r.im := self.re * b.im + self.im * b.re;
    return r
  end;

  operator /(b: Complex): Complex;
  var
    r: Complex;
    d: real;
  begin
    d := b.re * b.re + b.im * b.im;
    if d = 0.0 then
    begin
      r.re := 0.0;
      r.im := 0.0;
      return r
    end;
    r.re := (self.re * b.re + self.im * b.im) / d;
    r.im := (self.im * b.re - self.re * b.im) / d;
    return r
  end;

  operator =(b: Complex): boolean;
  begin
    if self.re <> b.re then
      return false;
    return self.im = b.im
  end;

  { a real widens into the complex plane }
  operator Complex(x: real): Complex;
  var r: Complex;
  begin
    r.re := x;
    r.im := 0.0;
    return r
  end;

  { explicit narrowing: real(z) takes the real part }
  operator real(): real;
  begin
    return self.re
  end;

  function conj(): Complex;
  var r: Complex;
  begin
    r.re := self.re;
    r.im := 0.0 - self.im;
    return r
  end;

  function normSq(): real;
  begin
    return self.re * self.re + self.im * self.im
  end;

  { Newton-Raphson; the runtime has no sqrt opcode. }
  function abs(): real;
  var
    guess: real;
    mag: real;
    step: integer;
  begin
    mag := self.re * self.re + self.im * self.im;
    if mag <= 0.0 then
      return 0.0;
    guess := mag;
    step := 0;
    while step < 24 do
    begin
      guess := (guess + mag / guess) / 2.0;
      step := step + 1
    end;
    return guess
  end;

  function toString(): string;
  begin
    if self.im < 0.0 then
      return '' + self.re + '-' + (0.0 - self.im) + 'i';
    return '' + self.re + '+' + self.im + 'i'
  end;
end;

begin
end.
