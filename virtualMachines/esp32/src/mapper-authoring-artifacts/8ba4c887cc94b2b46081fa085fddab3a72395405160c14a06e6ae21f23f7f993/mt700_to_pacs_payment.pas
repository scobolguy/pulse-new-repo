SERVICE "mt700_to_pacs_payment_service";

ROUTER "mt700_to_pacs_payment_router" INPUT "swift-mt700.inbound" DESCRIPTION "Deterministic MT700 to PACS payment mapping | CONCURRENT-MODE workers=32" ENABLED TRUE BEGIN
  OUTPUT "pacs.outbound" WHEN "output := 1;" TRANSFORM "output := map(\"mt700_to_pacs_payment\", src);";
END;

MAPPER "mt700_to_pacs_payment" SOURCE "swift-mt700" TARGET "pacs" DESCRIPTION "Deterministic MT700 to PACS payment mapping" ENABLED TRUE BEGIN
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "block4.31C" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" USING "output := yymmddtoiso(src);";
  MAP "block4.32B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt" USING "output := trim(src);";
  MAP "block4.50" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" USING "output := mtpartyname(src);";
  MAP "block4.59" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" USING "output := mtpartyname(src);";
END;