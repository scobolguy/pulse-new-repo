SERVICE "pacs_to_transaction_id_service";

ROUTER "pacs_to_transaction_id_router" INPUT "pacs.inbound" DESCRIPTION "Split PACS8 messages into individual transactions. | SEQUENTIAL-MODE workers=1 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress" ENABLED TRUE BEGIN
  OUTPUT "transaction_id.outbound" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"pacs_to_transaction_id\", fromxml(src)));";
END;

MAPPER "pacs_to_transaction_id" SOURCE "pacs" TARGET "transaction_id" DESCRIPTION "Split PACS8 messages into individual transactions." ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;