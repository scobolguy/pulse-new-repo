SERVICE "pacs_split_single_transactions_service";

ROUTER "pacs_split_single_transactions_router" INPUT "pacs.inbound" DESCRIPTION "Deterministic PACS split into single transaction payloads | CONCURRENT-MODE workers=32" ENABLED TRUE BEGIN
  OUTPUT "pacs.outbound" WHEN "output := 1;" TRANSFORM "output := map(\"pacs_split_single_transactions\", src);";
END;

MAPPER "pacs_split_single_transactions" SOURCE "pacs" TARGET "pacs" DESCRIPTION "Deterministic PACS split into single transaction payloads" ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;