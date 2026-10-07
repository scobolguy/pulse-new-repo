{ Records as parameters and as function results. }

program AggregateCalls;

type Point = record
  x: integer;
  y: integer;
end;

var
  a: Point;
  b: Point;
  total: Point;

function AddPoints(p, q: Point): Point;
var
  sum: Point;
begin
  sum.x := p.x + q.x;
  sum.y := p.y + q.y;
  return sum
end;

function ManhattanLength(p: Point): integer;
begin
  return p.x + p.y
end;

begin
  a.x := 3;
  a.y := 4;
  b.x := 10;
  b.y := 20;

  total := AddPoints(a, b);
  writeln('total=(', total.x, ',', total.y, ')');
  writeln('len=', ManhattanLength(total));
  writeln('nested=', ManhattanLength(AddPoints(a, a)))
end.
