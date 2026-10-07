SERVICE "swift_mt700_to_pacs_service";

ROUTER "swift_mt700_to_pacs_router" INPUT "swift-mt700.inbound" DESCRIPTION "Create and deploy a mapper from MT700 to pacs payment, run on many esp nodes. | CONCURRENT-MODE workers=24 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress" ENABLED TRUE BEGIN
  OUTPUT "pacs.outbound" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"swift_mt700_to_pacs\", fromxml(src)));";
END;

MAPPER "swift_mt700_to_pacs" SOURCE "swift-mt700" TARGET "pacs" DESCRIPTION "Create and deploy a mapper from MT700 to pacs payment, run on many esp nodes." ENABLED TRUE BEGIN
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "block4.31C" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" USING "output := yymmddtoiso(src);";
  MAP "block4.32B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt" USING "output := trim(src);";
  MAP "block4.50" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" USING "output := mtpartyname(src);";
  MAP "block4.59" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" USING "output := mtpartyname(src);";
END;