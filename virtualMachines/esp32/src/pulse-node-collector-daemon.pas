daemon 'pulse-node-collector' refresh 1000 ms
{ Passive Pulse announcements only; deployment assigns this daemon its own UDP intake.
  Nodes retain their stable identities and expire without new announcements. }
var body: string;
    kind: string;
    node: string;
    identity: string;

begin
  host.table_expire('nodes');
  if host.event_method() = 'UDP' then
  begin
    body := host.event_body();
    kind := host.json_text(body, 'kind');
    if (kind = 'nodeBeacon') or (kind = 'machineAvailability') then
    begin
      node := host.announcement(body, host.event_peer());
      identity := host.json_text(node, 'nodeId');
      node := host.json_merge(host.table_get('nodes', identity), node);
      host.table_put('nodes', identity, node, host.observation_ttl())
    end
  end
end.
