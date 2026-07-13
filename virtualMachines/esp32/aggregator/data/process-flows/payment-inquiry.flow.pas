service payment_inquiry_service;
BEGIN
  CASE httpVerb OF
    httpVerb.get: RETURN "payment_inquiry_service";
    httpVerb.post: RETURN src;
  END;
END;

router payment_inquiry_receive input "swift.mt103.inbound" description "Receive and normalize inbound MT103 payment" enabled true begin
  OUTPUT "swift.mt103.parsed" TYPE "swift-mt103"
    WHEN "IF startswith(upper(src), \"MT103\") THEN output := 1 ELSE output := 0;"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.onerror"
    WHEN "FIELD_EQUALS(message.runtime.error, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.ontimeout"
    WHEN "FIELD_EQUALS(message.runtime.timeout, \"true\")"
    TRANSFORM "output := src;";
end;

router payment_inquiry_fraud input "tx.decision.fraud" description "Fraud gate before balance check" enabled true begin
  OUTPUT "tx.decision.balance"
    WHEN "FIELD_EQUALS(message.fraud.status, \"approved\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.rejected"
    WHEN "FIELD_EQUALS(message.fraud.status, \"rejected\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.onerror"
    WHEN "FIELD_EQUALS(message.runtime.error, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.ontimeout"
    WHEN "FIELD_EQUALS(message.runtime.timeout, \"true\")"
    TRANSFORM "output := src;";
end;

router payment_inquiry_balance input "tx.decision.balance" description "Balance gate before RTGS submit" enabled true begin
  OUTPUT "tx.rtgs.ready"
    WHEN "FIELD_EQUALS(message.balance.status, \"ok\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.rejected"
    WHEN "FIELD_EQUALS(message.balance.status, \"insufficient\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.onerror"
    WHEN "FIELD_EQUALS(message.runtime.error, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.ontimeout"
    WHEN "FIELD_EQUALS(message.runtime.timeout, \"true\")"
    TRANSFORM "output := src;";
end;

router payment_inquiry_rtgs_submit input "tx.rtgs.ready" description "Submit to RTGS when window is open" enabled true begin
  OUTPUT "tx.swift.outbound.pending"
    WHEN "FIELD_EQUALS(message.rtgs.windowOpen, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.deferred.rtgs.closed"
    WHEN "FIELD_EQUALS(message.rtgs.windowOpen, \"false\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.onerror"
    WHEN "FIELD_EQUALS(message.runtime.error, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.ontimeout"
    WHEN "FIELD_EQUALS(message.runtime.timeout, \"true\")"
    TRANSFORM "output := src;";
end;

router payment_inquiry_swift_send input "tx.swift.outbound.pending" description "Send outbound SWIFT and complete transaction" enabled true begin
  OUTPUT "tx.completed"
    WHEN "FIELD_EQUALS(message.swift.sent, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.onerror"
    WHEN "FIELD_EQUALS(message.runtime.error, \"true\")"
    TRANSFORM "output := src;";

  OUTPUT "tx.lifecycle.ontimeout"
    WHEN "FIELD_EQUALS(message.runtime.timeout, \"true\")"
    TRANSFORM "output := src;";
end;

router payment_inquiry_query input "tx.inquiry.request" description "Build inquiry response payload from transaction state" enabled true begin
  OUTPUT "tx.inquiry.response"
    WHEN "output := 1;"
    TRANSFORM "output := map(\"payment_inquiry_query_response\", src);";
end;

mapper payment_inquiry_contract source "swift-mt103" target "payment-inquiry" description "Inquiry response contract fields" enabled true begin
  MAP "block4.20" TO "inquiry.transactionId" USING "output := trim(src);";
  MAP "block4.32A.amount" TO "inquiry.paymentAmount" USING "output := mtamounttodecimal(src);";
  MAP "block4.32A.currency" TO "inquiry.paymentCurrency" USING "output := upper(src);";
  MAP "block4.32A.date" TO "inquiry.receivedAt" USING "output := yymmddtoiso(src);";
end;

mapper payment_inquiry_query_response source "tx-inquiry-state" target "payment-inquiry-response" description "Queryable inquiry contract projection" enabled true begin
  MAP "transactionId" TO "inquiry.transactionId" USING "output := trim(src);";
  MAP "receivedAt" TO "inquiry.receivedAt" USING "output := trim(src);";
  MAP "replySentAt" TO "inquiry.replySentAt" USING "output := trim(src);";
  MAP "currentState" TO "inquiry.currentState" USING "output := trim(src);";
  MAP "blockingReason" TO "inquiry.blockingReason" USING "output := trim(src);";
  MAP "nextAction" TO "inquiry.nextAction" USING "output := trim(src);";
end;
