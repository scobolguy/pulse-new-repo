SERVICE "mt103-to-pacs-service";
BEGIN
  CASE httpVerb OF
    httpVerb.post: RETURN src;
    httpVerb.get: RETURN "mt103-to-pacs-service";
  END;
END;

ROUTER "mt103-to-pacs-router" INPUT "swift.mt103.parsed" DESCRIPTION "Transform MT103 payload to PACS payload" ENABLED TRUE BEGIN
  OUTPUT "tx.pacs.created" TYPE "pacs"
    WHEN "IF startswith(upper(src), \"MT103\") THEN output := 1 ELSE output := 0;"
    TRANSFORM "output := map(\"mt103-to-pacs\", src);";
END;

MAPPER "mt103-to-pacs" SOURCE "swift-mt103" TARGET "pacs" DESCRIPTION "MT103 to PACS.008 mapping" ENABLED TRUE BEGIN
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "block4.20" TO "Document.hdr:AppHdr.hdr:BizMsgIdr" USING "output := trim(src);";
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId" USING "output := trim(src);";

  MAP "block4.32A.date" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" USING "output := yymmddtoiso(src);";
  MAP "block4.32A.currency" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" USING "output := upper(src);";
  MAP "block4.32A.amount" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" USING "output := mtamounttodecimal(src);";

  MAP "block4.50K" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" USING "output := mtpartyname(src);";
  MAP "block4.59" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" USING "output := mtpartyname(src);";

  MAP "block4.70" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd" USING "output := trim(src);";
  MAP "block4.71A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr" USING "output := mtchargebearertoiso(src);";
END;
