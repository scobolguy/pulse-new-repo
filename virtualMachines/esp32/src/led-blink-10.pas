program LedBlinkTen;

var
  led: integer;
  i: integer;

begin
  led := fsm.open('device', 'LEDPIN', 'led', 2);
  for i := 1 to 10 do
  begin
    fsm.set(led, 'power', 'on');
    delayMs(1000);
    fsm.set(led, 'power', 'off');
    delayMs(1000);
  end;
  fsm.close(led);
end.