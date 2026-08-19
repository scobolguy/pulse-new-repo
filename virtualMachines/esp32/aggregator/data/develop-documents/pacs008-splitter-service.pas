// ─────────────────────────────────────────────────────────────────────────────
// pacs008-splitter-service
//
// Receives a multi-transaction pacs.008 message on the inbound queue,
// deconstructs it into one pacs.008 per CdtTrfTxInf repeating group, and
// forwards each single-transaction message to the SWIFT outbound service.
//
// Schema: pacs.008.001.14
//   Document
//     FIToFICstmrCdtTrf                          (FIToFICustomerCreditTransferV14)
//       GrpHdr                                   (GroupHeader131)          maxOccurs=1
//         MsgId, CreDtTm, NbOfTxs, SttlmInf, InstgAgt, InstdAgt
//       CdtTrfTxInf[]                            (CreditTransferTransaction73) maxOccurs=unbounded
//         PmtId.EndToEndId, IntrBkSttlmAmt, ChrgBr, Dbtr, Cdtr ...
// ─────────────────────────────────────────────────────────────────────────────

// ── Librarian type declarations ───────────────────────────────────────────────
var inboundDoc   : FIToFICustomerCreditTransferV14     from librarian;
var grpHdr       : GroupHeader131                      from librarian;
var txSlice      : CreditTransferTransaction73         from librarian;

// ── Working variables ─────────────────────────────────────────────────────────
var txCount      : integer;      // total CdtTrfTxInf entries in the batch
var i            : integer;      // loop index (0-based)
var msgIdBase    : string;       // original GrpHdr.MsgId from inbound
var creDtTm      : string;       // original GrpHdr.CreDtTm
var sttlmInf     : string;       // serialised settlement info (pass-through)
var instgAgt     : string;       // instructing agent BIC
var instdAgt     : string;       // instructed agent BIC
var endToEndId   : string;       // per-tx end-to-end id
var txAmt        : string;       // per-tx interbank settlement amount
var txCcy        : string;       // per-tx currency code
var sttlmDt      : string;       // per-tx settlement date
var chrgBr       : string;       // per-tx charge bearer code
var dbtrNm       : string;       // per-tx debtor name
var dbtrBIC      : string;       // per-tx debtor agent BIC
var cdtrNm       : string;       // per-tx creditor name
var cdtrBIC      : string;       // per-tx creditor agent BIC
var outMsgId     : string;       // synthesised single-tx message id
var ok           : boolean;      // service call result flag

// ─────────────────────────────────────────────────────────────────────────────
service pacs008splitter;
begin

  // ── Step 1: read the number of CdtTrfTxInf entries from the inbound msg.
  // maxCount(typeRef, elementName) returns the actual occurrence count found
  // in the current message for that repeating group (-1 = not present).
  // The constant UNBOUNDED is defined by the runtime as -1.
  txCount := maxCount(FIToFICustomerCreditTransferV14, "CdtTrfTxInf");

  if txCount <= 0 then
    // Nothing to do – invalid or empty batch; silently discard.
  end;

  // ── Step 2: extract the common group header fields once.
  with "Document.FIToFICstmrCdtTrf.GrpHdr" do
    msgIdBase := MsgId;
    creDtTm   := CreDtTm;
    sttlmInf  := SttlmInf;
    instgAgt  := InstgAgt;
    instdAgt  := InstdAgt;
  end;

  // ── Step 3: loop over each CdtTrfTxInf, build a single-tx message, emit.
  i := 0;
  for i := 0 to txCount - 1 do
    // Build the indexed element path for this iteration.
    // e.g. "Document.FIToFICstmrCdtTrf.CdtTrfTxInf[0]"
    with "Document.FIToFICstmrCdtTrf.CdtTrfTxInf" do

      // Extract key fields from this transaction slice.
      endToEndId := PmtId.EndToEndId;
      txAmt      := IntrBkSttlmAmt;
      txCcy      := IntrBkSttlmAmt.Ccy;
      sttlmDt    := IntrBkSttlmDt;
      chrgBr     := ChrgBr;
      dbtrNm     := Dbtr.Nm;
      dbtrBIC    := DbtrAgt.FinInstnId.BICFI;
      cdtrNm     := Cdtr.Nm;
      cdtrBIC    := CdtrAgt.FinInstnId.BICFI;

    end;

    // Synthesise a unique message id for this single-tx envelope.
    // Convention: original MsgId + "/" + 1-based sequence number.
    outMsgId := msgIdBase;

    // Build and forward the single-transaction pacs.008 to the SWIFT service.
    // subflow invokes a named registered service with the current message
    // context as a structured payload that the SWIFT gateway can serialise.
    subflow "swift-outbound-gateway" with
      endToEndId, txAmt, txCcy, sttlmDt,
      chrgBr, dbtrNm, dbtrBIC,
      cdtrNm, cdtrBIC,
      outMsgId, creDtTm, sttlmInf,
      instgAgt, instdAgt;

  end;  // for

end.
