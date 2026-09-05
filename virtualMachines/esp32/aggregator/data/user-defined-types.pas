{ User-defined/abstract types demonstration. 
  Types are erased at compile time, so these resolve to base types in the pcode. }

program UserDefinedTypes;

type Count = integer;
type Value = Count;
type Point = record
  x: integer;
  y: integer;
end;
type Coordinate = Point;

var
  myCount: Count;
  myValue: Value;
  myPoint: Point;
  myCoord: Coordinate;

begin
  myCount := 42;
  myValue := myCount;
  myPoint.x := 10;
  myPoint.y := 20;
  myCoord.x := myPoint.x;
  myCoord.y := myPoint.y
end.
