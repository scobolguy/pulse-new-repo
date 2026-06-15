program "dual-node-atomic-check";

service "risk_check";
begin
  return '{"success":true,"replyJson":"{\"stage\":\"risk_check\",\"node\":\"childNode\"}"}';
end;

service "limits_check";
begin
  return '{"success":true,"replyJson":"{\"stage\":\"limits_check\",\"node\":\"childNode\"}"}';
end;

begin
  cobegin
    async subflow "risk_check" on "childNode" with req timeout 5 s into h_node1;
    async subflow "limits_check" on "childNode" with req timeout 5 s into h_node2;
  coend;

  wait all (h_node1, h_node2) into (r_node1, r_node2) timeout 8 s on error fail transaction "subtasks timeout or transport error";
  return success merged_reply;
end.
