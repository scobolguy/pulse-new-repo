SERVICE "pacs008_canonical_to_payment_mt700_canonical_service";

ROUTER "pacs008_canonical_to_payment_mt700_canonical_router" INPUT "pacs008-incoming" DESCRIPTION "Decompose a PACS008 message containing 25 payment messages into individual Swift MT700 transactions. | CONCURRENT-MODE workers=12 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress | EXPECTED-SPLIT-COUNT=25" ENABLED TRUE BEGIN
  OUTPUT "messages.to.swift" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"pacs008_canonical_to_payment_mt700_canonical\", fromxml(src)));";
END;

MAPPER "pacs008_canonical_to_payment_mt700_canonical" SOURCE "pacs008-canonical" TARGET "payment-mt700-canonical" DESCRIPTION "Decompose a PACS008 message containing 25 payment messages into individual Swift MT700 transactions." ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;