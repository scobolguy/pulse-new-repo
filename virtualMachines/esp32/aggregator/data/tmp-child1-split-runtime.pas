ROUTER "pacs_to_swift_mt700_router" INPUT "pacs.inbound" DESCRIPTION "pacs split to swift queue" ENABLED TRUE BEGIN
  OUTPUT "messages.to.swift" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"pacs_to_swift_mt700\", fromxml(src)));";
END;

MAPPER "pacs_to_swift_mt700" SOURCE "pacs" TARGET "swift-mt700" DESCRIPTION "split pacs into single tx" ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;
