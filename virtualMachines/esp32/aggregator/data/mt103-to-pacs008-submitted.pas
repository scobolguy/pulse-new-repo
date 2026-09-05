library "MT103" from librarian;
library "PACS008" from librarian;

mapper MT103_TO_PACS008
  source MT103
  target PACS008
  description "MT103 to PACS.008 conversion"
  enabled true
begin
  map "block4.20" to "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" using "output := trim(src);";
  map "block4.32A.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" using "output := mtamounttodecimal(src);";
end;

service MT103ToPACS008 on local;
  get "/convert" accepts MT103 returns PACS008;
  begin
    return map("MT103_TO_PACS008", src);
  end
end.
