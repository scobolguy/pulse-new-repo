service "cbds-converter" on local;
role code_librarian;
library "payments-common" from librarian;
use "payments-common" as CORE;
mapper "cbds-mt103-to-pacs008" source "swift-mt103" target "pacs" begin
  map "block4.20" to "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" using "output = trim(src)";
  map "block4.20" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId" using "output = trim(src)";
  map "block4.21" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId" using "output = trim(src)";
  map "block4.23B" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry" using "output = upper(trim(src))";
  map "block4.32A.date" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt" using "output = yymmddtoiso(src)";
  map "block4.32A.currency" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy" using "output = upper(trim(src))";
  map "block4.32A.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" using "output = mtamounttodecimal(src)";
  map "block4.33B.currency" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy" using "output = upper(trim(src))";
  map "block4.33B.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text" using "output = mtamounttodecimal(src)";
  map "block4.50K" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm" using "output = mtpartyname(src)";
  map "block4.52A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI" using "output = upper(trim(src))";
  map "block4.53A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI" using "output = upper(trim(src))";
  map "block4.56A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI" using "output = upper(trim(src))";
  map "block4.57A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI" using "output = upper(trim(src))";
  map "block4.59" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm" using "output = mtpartyname(src)";
  map "block4.70" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd" using "output = trim(src)";
  map "block4.71A" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr" using "output = mtchargebearertoiso(src)";
  map "block4.71B" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text" using "output = mtamounttodecimal(src)";
  map "block4.72" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf" using "output = trim(src)";
  map "meta.createdAt" to "Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm" using "output = trim(src)";
end;
begin
route cbds_mapper from "swift.mt103.parsed" to "cbds.pacs.outbound";
end.
