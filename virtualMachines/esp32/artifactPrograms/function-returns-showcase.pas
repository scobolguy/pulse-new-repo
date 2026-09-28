{ Exercises typed function return values: integer, real, string and recursion. }

program FunctionReturnsShowcase;

var
  doubled: integer;
  ratio: real;
  greeting: string;
  fact: integer;

function Double(x: integer): integer;
begin
  return x * 2
end;

function Quarter(x: real): real;
begin
  return x / 4
end;

function Greet(who: string): string;
begin
  if who = 'world' then
    return 'hello world'
  else
    return 'hello stranger'
end;

function Factorial(n: integer): integer;
begin
  if n <= 1 then
    return 1
  else
    return n * Factorial(n - 1)
end;

begin
  doubled := Double(21);
  ratio := Quarter(1.0);
  greeting := Greet('world');
  fact := Factorial(6);

  writeln('doubled=', doubled);
  writeln('ratio=', ratio);
  writeln('greeting=', greeting);
  writeln('factorial6=', fact);
  writeln('nested=', Double(Double(5)))
end.
