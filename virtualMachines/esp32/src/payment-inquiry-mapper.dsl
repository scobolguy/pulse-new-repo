SERVICE "payment-inquiry-mapper-service";

ROUTER "payment-inquiry-map-router" INPUT "payments.inquiry.raw" DESCRIPTION "Pass through inquiry messages after mapper normalization" ENABLED TRUE BEGIN
  OUTPUT "payments.inquiry.normalized"
    WHEN "output := 1;"
    TRANSFORM BEGIN
      output := map("payment-to-transaction-inquiry", src);
    END;
END;

MAPPER "payment-to-transaction-inquiry" SOURCE "payment-request" TARGET "tx-lifecycle-event" DESCRIPTION "Normalize inbound payment inquiry payload into transaction lifecycle envelope" ENABLED TRUE BEGIN
  MAP "payment.reference" TO "reference" USING "output := trim(src);";
  MAP "payment.reference" TO "entityId" USING "output := trim(src);";
  MAP "payment.reference" TO "transaction.id" USING "output := trim(src);";
  MAP "payment.receivedAt" TO "transaction.receivedAt" USING "output := trim(src);";
  MAP "payment.amount" TO "payment.amount" USING "output := src;";
  MAP "payment.currency" TO "payment.currency" USING "output := upper(src);";
  MAP "payment.sender" TO "payment.sender" USING "output := trim(src);";
  MAP "payment.receiver" TO "payment.receiver" USING "output := trim(src);";
  MAP "gateway.rtgs" TO "gateway.rtgs" USING "output := lower(trim(src));";
  MAP "gateway.swift" TO "gateway.swift" USING "output := lower(trim(src));";
  MAP "lifecycle.stage" TO "lifecycle.stage" USING "output := lower(trim(src));";
  MAP "lifecycle.outcome" TO "lifecycle.outcome" USING "output := lower(trim(src));";
END;

MAPPER "transaction-to-support-response" SOURCE "tx-lifecycle-event" TARGET "support-payment-response" DESCRIPTION "Project lifecycle transaction facts into support-facing response shape" ENABLED TRUE BEGIN
  MAP "reference" TO "paymentReference" USING "output := trim(src);";
  MAP "entityId" TO "transactionId" USING "output := trim(src);";
  MAP "transaction.receivedAt" TO "receivedAt" USING "output := trim(src);";
  MAP "transaction.replySentAt" TO "replySentAt" USING "output := trim(src);";
  MAP "lifecycle.currentStatus" TO "currentStatus" USING "output := lower(trim(src));";
  MAP "lifecycle.blockingReason" TO "blockingReason" USING "output := trim(src);";
  MAP "lifecycle.nextAction" TO "nextAction" USING "output := trim(src);";
END;
