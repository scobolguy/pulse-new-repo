SERVICE "mt940_to_camt053_service";

ROUTER "mt940_to_camt053_router" INPUT "swift-mt940.inbound" DESCRIPTION "Deterministic SWIFT MT940 to ISO 20022 CAMT.053 statement mapping | SEQUENTIAL-MODE workers=1 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress" ENABLED TRUE BEGIN
  OUTPUT "camt.outbound" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"mt940_to_camt053\", fromxml(src)));";
END;

MAPPER "mt940_to_camt053" SOURCE "swift-mt940" TARGET "camt" DESCRIPTION "Deterministic SWIFT MT940 to ISO 20022 CAMT.053 statement mapping" ENABLED TRUE BEGIN
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "block4.31C" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" USING "output := yymmddtoiso(src);";
  MAP "block4.32B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt" USING "output := trim(src);";
  MAP "block4.50" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" USING "output := mtpartyname(src);";
  MAP "block4.59" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" USING "output := mtpartyname(src);";
END;