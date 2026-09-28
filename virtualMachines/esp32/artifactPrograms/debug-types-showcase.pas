{ Debugger exercise program.

  Purpose: give the step debugger something with shape to display --
  scalar types, aliased types, enumerated types, flat and nested record
  types, procedure locals, and a recursive call chain deep enough that the
  call stack view has to show more than one frame. }

program DebugTypesShowcase;

type Severity = (SevInfo, SevWarning, SevError, SevFatal);
type Channel = (ChFile, ChQueue, ChHttp);
type Alert = Severity;
type Score = real;
type Tag = string;

type Vector = record
  x: integer;
  y: integer;
end;

type Sample = record
  tag: Tag;
  severity: Severity;
  channel: Channel;
  weight: Score;
  active: boolean;
  origin: Vector;
end;

var
  probe: Sample;
  mirror: Sample;
  escalations: integer;
  deepestLevel: integer;
  finalSeverity: Alert;
  totalWeight: Score;

procedure SeverityName(value: Severity);
begin
  writeln('severity=', value, ' ordinal=', ord(value))
end;

procedure ChannelName(value: Channel);
begin
  writeln('channel=', value, ' ordinal=', ord(value))
end;

{ Builds the nested record in place so the debugger shows a record grow
  field by field across several steps. }
procedure BuildProbe();
begin
  probe.tag := 'ingress-probe';
  probe.severity := SevInfo;
  probe.channel := ChQueue;
  probe.weight := 1.25;
  probe.active := true;
  probe.origin.x := 10;
  probe.origin.y := 20
end;

{ Two records of the same shape holding different contents make aliasing
  bugs visible in the variables pane. }
procedure MirrorProbe();
begin
  mirror.tag := 'echo-probe';
  mirror.severity := SevError;
  mirror.channel := ChHttp;
  mirror.weight := probe.weight + 0.75;
  mirror.active := false;
  mirror.origin.x := probe.origin.y;
  mirror.origin.y := probe.origin.x
end;

{ Recursive: each frame carries its own locals so the call stack view has
  distinct values at every depth. }
procedure Escalate(level: integer; current: Severity);
var
  nextSeverity: Severity;
  localWeight: Score;
  marker: Tag;
begin
  marker := 'frame';
  localWeight := level * 0.5;
  totalWeight := totalWeight + localWeight;
  escalations := escalations + 1;
  if level > deepestLevel then
    deepestLevel := level;
  writeln(marker, ' level=', level, ' severity=', current, ' weight=', localWeight);
  if ord(current) = 0 then
    nextSeverity := SevWarning
  else if ord(current) = 1 then
    nextSeverity := SevError
  else
    nextSeverity := SevFatal;
  if ord(current) < 3 then
    Escalate(level + 1, nextSeverity)
  else
    finalSeverity := current
end;

procedure ReportPair();
var
  spread: integer;
begin
  spread := mirror.origin.x - probe.origin.x;
  writeln('probe.tag=', probe.tag, ' mirror.tag=', mirror.tag);
  writeln('probe.origin=(', probe.origin.x, ',', probe.origin.y, ')');
  writeln('mirror.origin=(', mirror.origin.x, ',', mirror.origin.y, ')');
  writeln('origin.x spread=', spread);
  writeln('probe.weight=', probe.weight, ' mirror.weight=', mirror.weight)
end;

begin
  escalations := 0;
  deepestLevel := 0;
  totalWeight := 0.0;

  BuildProbe();
  MirrorProbe();

  SeverityName(probe.severity);
  ChannelName(probe.channel);
  SeverityName(mirror.severity);
  ChannelName(mirror.channel);
  ReportPair();

  Escalate(1, SevInfo);

  writeln('escalations=', escalations);
  writeln('deepestLevel=', deepestLevel);
  writeln('totalWeight=', totalWeight);
  writeln('finalSeverity=', finalSeverity)
end.
