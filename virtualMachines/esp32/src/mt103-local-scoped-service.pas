service MT103LocalScope on local;
  mapper LOCAL_MT103_TO_PACS
    source MT103
    target PACS008
    description "Service-private MT103 to PACS mapping"
    enabled true
  begin
    map "block4.20" to "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" using "output := trim(src);";
    map "block4.32A.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text" using "output := trim(src);";
  end;

  get "/convert" accepts MT103 returns PACS008;
  begin
    return map("LOCAL_MT103_TO_PACS", src);
  end
end.
