SERVICE "cbds-pcode-proof" BEGIN

ROUTER "cbds-proof-route" INPUT "swift.mt103.parsed" DESCRIPTION "CBDS pcode proof path" ENABLED TRUE BEGIN
  OUTPUT "cbds.pacs.outbound"
    WHEN "output := 1;"
    TRANSFORM BEGIN
      output := map("cbds-mt103-to-pacs008", src);
    END;
END;

MAPPER "cbds-mt103-to-pacs008" SOURCE "swift-mt103" TARGET "pacs" DESCRIPTION "CBDS MT103 to PACS.008 transformation" ENABLED TRUE BEGIN
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "block4.20" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId" USING "output := trim(src);";
  MAP "block4.21" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId" USING "output := trim(src);";
  MAP "block4.23B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry" USING "output := upper(trim(src));";
  MAP "block4.32A.date" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" USING "output := yymmddtoiso(src);";
  MAP "block4.32A.currency" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" USING "output := upper(trim(src));";
  MAP "block4.32A.amount" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" USING "output := mtamounttodecimal(src);";
  MAP "block4.33B.currency" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy" USING "output := upper(trim(src));";
  MAP "block4.33B.amount" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text" USING "output := mtamounttodecimal(src);";
  MAP "block4.50K" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" USING "output := mtpartyname(src);";
  MAP "block4.52A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "block4.53A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "block4.56A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "block4.57A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "block4.59" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" USING "output := mtpartyname(src);";
  MAP "block4.70" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd" USING "output := trim(src);";
  MAP "block4.71A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr" USING "output := mtchargebearertoiso(src);";
  MAP "block4.71B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text" USING "output := mtamounttodecimal(src);";
  MAP "block4.72" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf" USING "output := trim(src);";
  MAP "meta.createdAt" TO "Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm" USING "output := trim(src);";
END;

END;
