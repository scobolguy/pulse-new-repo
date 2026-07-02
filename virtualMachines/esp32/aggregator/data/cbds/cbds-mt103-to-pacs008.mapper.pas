SERVICE "cbds-transform-service";

MAPPER "cbds-mt103-to-pacs008" SOURCE "swift-mt103" TARGET "pacs" DESCRIPTION "CBDS MT103 to PACS.008 transformation" ENABLED TRUE BEGIN
  MAP "finEnvelope.block4.fields.20" TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" USING "output := trim(src);";
  MAP "finEnvelope.block4.fields.20" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId" USING "output := trim(src);";
  MAP "finEnvelope.block4.fields.21" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId" USING "output := trim(src);";
  MAP "finEnvelope.block4.fields.23B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.32A.components.valueDate" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" USING "output := yymmddtoiso(src);";
  MAP "finEnvelope.block4.fields.32A.components.currency" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.32A.components.amount" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" USING "output := mtamounttodecimal(src);";
  MAP "finEnvelope.block4.fields.33B.components.currency" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.33B.components.amount" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text" USING "output := mtamounttodecimal(src);";
  MAP "finEnvelope.block4.fields.50K" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" USING "output := mtpartyname(src);";
  MAP "finEnvelope.block4.fields.52A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.53A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.56A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.57A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI" USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.59" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" USING "output := mtpartyname(src);";
  MAP "finEnvelope.block4.fields.70" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd" USING "output := trim(src);";
  MAP "finEnvelope.block4.fields.71A" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr" USING "output := mtchargebearertoiso(src);";
  MAP "finEnvelope.block4.fields.71B" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text" USING "output := mtamounttodecimal(src);";
  MAP "finEnvelope.block4.fields.72" TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf" USING "output := trim(src);";
  MAP "finEnvelope.meta.createdAt" TO "Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm" USING "output := trim(src);";
END;

