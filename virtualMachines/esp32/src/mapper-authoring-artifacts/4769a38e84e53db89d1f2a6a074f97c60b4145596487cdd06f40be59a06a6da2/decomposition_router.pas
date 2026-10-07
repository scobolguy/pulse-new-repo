SERVICE "decomposition_router_service";

ROUTER "decomposition_router_router" INPUT "pacs008_queue" DESCRIPTION "Router to decompose a PACS message into individual messages. | CONCURRENT-MODE workers=12 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress | EXPECTED-SPLIT-COUNT=25" ENABLED TRUE BEGIN
  OUTPUT "messages.to.swift" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"decomposition_router\", fromxml(src)));";
END;

MAPPER "decomposition_router" SOURCE "pacs008_canonical" TARGET "swiftmt700_canonical" DESCRIPTION "Router to decompose a PACS message into individual messages." ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;