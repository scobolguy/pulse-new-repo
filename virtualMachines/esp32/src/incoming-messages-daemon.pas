{ Logical names only: WFL redefines server/schema/connection bindings at deploy time. }
database messageStore type sqlserver
  server "localhost" catalog "pulse" schema "dbo"
  connection secret "messagestore-connection";

table incomingMessages of text in messageStore
  columns (reference: text, payload: text, status: text);

daemon "incoming-messages-daemon" refresh 2 s;

queue mt103Inbound queue<mt103>;

var msg : mt103;
var seen : string;

begin
  dequeue mt103Inbound into msg;
  if msg <> '' then
  begin
    select status from incomingMessages where payload = msg into seen;
    if seen = '' then
      insert into incomingMessages (reference, payload, status) values (msg, msg, 'received')
    else
      update incomingMessages set status := 'duplicate' where payload = msg
  end
end.
