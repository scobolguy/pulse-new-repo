SERVICE "aggregator-router-service";

ROUTER "mt103-correspondent-and-lynx-fanout" INPUT "swift.mt103.parsed" DESCRIPTION "One MT103 to correspondent and LYNX flows" ENABLED TRUE BEGIN
  OUTPUT "correspondent.pacs008.outbound"
    WHEN BEGIN
      output := 1;
    END
    TRANSFORM BEGIN
      output := map("mt103-to-pacs", src);
    END;

  OUTPUT "lynx.pacs009.outbound"
    WHEN BEGIN
      output := 1;
    END
    TRANSFORM BEGIN
      output := map("pacs-to-lynx", map("mt103-to-pacs", src));
    END;
END;

ROUTER "swift-fanout-default" INPUT "swift.inbound" DESCRIPTION "Default fanout by MT type" ENABLED TRUE BEGIN
  OUTPUT "audit.all" WHEN "output := 1;" TRANSFORM "output := src;";
  OUTPUT "payments.mt103" WHEN "IF startswith(upper(src), \"MT103\") THEN output := 1 ELSE output := 0;" TRANSFORM "output := src;";
  OUTPUT "payments.mt202" WHEN "IF startswith(upper(src), \"MT202\") THEN output := 1 ELSE output := 0;" TRANSFORM "output := src;";
END;

MAPPER "mt103-to-pacs-mini" SOURCE "swift-mt103" TARGET "pacs" DESCRIPTION "Minimal MT103 to PACS sample" ENABLED TRUE BEGIN
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING BEGIN output := trim(src); END;
  MAP "block4.32A.currency" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" USING "output := upper(src);";
  MAP "block4.32A.amount" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" USING "output := mtamounttodecimal(src);";
END;

MAPPER "pacs-to-lynx-mini" SOURCE "pacs" TARGET "pacs-lynx" DESCRIPTION "Minimal PACS to LYNX sample" ENABLED TRUE BEGIN
  MAP "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" TO "LynxEnvelope.Header.MessageId" USING "output := trim(src);";
  MAP "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" TO "LynxEnvelope.Payment.Currency" USING "output := upper(src);";
END;
