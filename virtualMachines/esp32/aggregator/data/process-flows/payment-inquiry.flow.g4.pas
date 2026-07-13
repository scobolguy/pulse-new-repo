var msg: string;
var inquiry_msg: string;
var inquiry_response: string;

queue swift_mt103_inbound queue<string>;
queue swift_mt103_parsed queue<string>;
queue tx_decision_fraud queue<string>;
queue tx_decision_balance queue<string>;
queue tx_rtgs_ready queue<string>;
queue tx_swift_outbound_pending queue<string>;
queue tx_completed queue<string>;
queue tx_rejected queue<string>;
queue tx_lifecycle_onerror queue<string>;
queue tx_lifecycle_ontimeout queue<string>;
queue tx_deferred_rtgs_closed queue<string>;
queue tx_inquiry_request queue<string>;
queue tx_inquiry_response queue<string>;

program payment_inquiry_flow;

begin
  dequeue swift_mt103_inbound into msg;

  if startswith(upper(msg), "MT103") then
    enqueue swift_mt103_parsed with msg;
    enqueue tx_decision_fraud with msg;
  else
    enqueue tx_lifecycle_onerror with msg;
  end;

  dequeue tx_decision_fraud into msg;
  if field_equals(msg, "fraud.status", "approved") then
    enqueue tx_decision_balance with msg;
  else
    enqueue tx_rejected with msg;
  end;

  dequeue tx_decision_balance into msg;
  if field_equals(msg, "balance.status", "ok") then
    enqueue tx_rtgs_ready with msg;
  else
    enqueue tx_rejected with msg;
  end;

  dequeue tx_rtgs_ready into msg;
  if field_equals(msg, "rtgs.windowOpen", "true") then
    enqueue tx_swift_outbound_pending with msg;
  else
    enqueue tx_deferred_rtgs_closed with msg;
  end;

  dequeue tx_swift_outbound_pending into msg;
  if field_equals(msg, "swift.sent", "true") then
    enqueue tx_completed with msg;
  else
    enqueue tx_lifecycle_onerror with msg;
  end;

  dequeue tx_inquiry_request into inquiry_msg;
  inquiry_response := map_payment_inquiry_query_response(inquiry_msg);
  enqueue tx_inquiry_response with inquiry_response;
end.
