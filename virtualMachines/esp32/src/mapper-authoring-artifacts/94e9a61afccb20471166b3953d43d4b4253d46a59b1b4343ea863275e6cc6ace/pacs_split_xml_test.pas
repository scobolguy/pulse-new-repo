SERVICE "pacs_split_xml_test_service";

ROUTER "pacs_split_xml_test_router" INPUT "pacs.inbound" DESCRIPTION "xml test split | CONCURRENT-MODE workers=12 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress" ENABLED TRUE BEGIN
  OUTPUT "pacs.outbound" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"pacs_split_xml_test\", fromxml(src)));";
END;

MAPPER "pacs_split_xml_test" SOURCE "pacs" TARGET "pacs" DESCRIPTION "xml test split" ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" USING "output := src;";
END;