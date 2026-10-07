program "esp32-dual-worker-orchestration";

service "double_a";
begin
  return '{"success":true,"replyJson":"{\"stage\":\"double_a\"}"}';
end;

service "double_b";
begin
  return '{"success":true,"replyJson":"{\"stage\":\"double_b\"}"}';
end;

begin
  cobegin
    async subflow "double_a" on "esp32" with req timeout 5 s into h_esp_a;
    async subflow "double_b" on "esp32" with req timeout 5 s into h_esp_b;
  coend;

  wait all (h_esp_a, h_esp_b) into (r_esp_a, r_esp_b) timeout 8 s on error fail transaction "esp32 worker timeout or transport error";
  return success merged_reply;
end.
