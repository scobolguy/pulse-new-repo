SERVICE "pacs8_message_to_transaction_service";

ROUTER "pacs8_message_to_transaction_router" INPUT "pacs8_message.inbound" DESCRIPTION "Create a mapper to split PACS8 messages into single transactions and deploy it specifically for child3. | CONCURRENT-MODE workers=12 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress" ENABLED TRUE BEGIN
  OUTPUT "transaction.outbound" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"pacs8_message_to_transaction\", fromxml(src)));";
END;

MAPPER "pacs8_message_to_transaction" SOURCE "pacs8_message" TARGET "transaction" DESCRIPTION "Create a mapper to split PACS8 messages into single transactions and deploy it specifically for child3." ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;