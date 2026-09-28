// MT103 to pacs.008.001.14 Credit Transfer Mapping Service
// Source: swift-mt103  (finEnvelope.block4.fields.*)
// Target: pacs.008.001.14  (Document.FIToFICstmrCdtTrf.*)

service "mt103-to-pacs008-svc";

// Import the registered map from the Data Mapper
import mapper "cbds-mt103-to-pacs008" from mapper;

// Source and target types resolved from the Librarian
var inboundMessage  : swift-mt103 from librarian;
var outboundMessage : pacs        from librarian;

// Mapper block
MAPPER "cbds-mt103-to-pacs008"
  SOURCE "swift-mt103"
  TARGET "pacs"
  DESCRIPTION "CBDS-aligned MT103 to PACS.008 field mapping"
  ENABLED TRUE
BEGIN

  // Group header
  MAP "finEnvelope.block4.fields.20"        TO "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId"
    USING "output := trim(src);";
  MAP "finEnvelope.meta.createdAt"          TO "Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm"
    USING "output := trim(src);";

  // Payment identifiers
  MAP "finEnvelope.block4.fields.20"        TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId"
    USING "output := trim(src);";
  MAP "finEnvelope.block4.fields.21"        TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId"
    USING "output := trim(src);";

  // Payment type
  MAP "finEnvelope.block4.fields.23B"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry"
    USING "output := upper(trim(src));";

  // Interbank settlement - field 32A components
  MAP "finEnvelope.block4.fields.32A.components.valueDate"  TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt"
    USING "output := yymmddtoiso(src);";
  MAP "finEnvelope.block4.fields.32A.components.currency"   TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy"
    USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.32A.components.amount"     TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text"
    USING "output := mtamounttodecimal(src);";

  // Instructed amount - field 33B components
  MAP "finEnvelope.block4.fields.33B.components.currency"  TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy"
    USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.33B.components.amount"    TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text"
    USING "output := mtamounttodecimal(src);";

  // Parties
  MAP "finEnvelope.block4.fields.50K"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm"
    USING "output := mtpartyname(src);";
  MAP "finEnvelope.block4.fields.52A"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI"
    USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.53A"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI"
    USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.56A"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI"
    USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.57A"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI"
    USING "output := upper(trim(src));";
  MAP "finEnvelope.block4.fields.59"        TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm"
    USING "output := mtpartyname(src);";

  // Remittance and charges
  MAP "finEnvelope.block4.fields.70"        TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd"
    USING "output := trim(src);";
  MAP "finEnvelope.block4.fields.71A"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr"
    USING "output := mtchargebearertoiso(src);";
  MAP "finEnvelope.block4.fields.71B"       TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text"
    USING "output := mtamounttodecimal(src);";
  MAP "finEnvelope.block4.fields.72"        TO "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf"
    USING "output := trim(src);";

END;

// Router feeds the mapper and emits to the output queue
ROUTER "mt103-inbound-router"
  INPUT "swift.mt103.inbound"
  DESCRIPTION "Route MT103 messages through the pacs.008 mapper"
  ENABLED TRUE
BEGIN
  OUTPUT "pacs008.outbound"
    WHEN "output := 1;"
    TRANSFORM "output := toxml(map(\"cbds-mt103-to-pacs008\", fromxml(src)));";
END;
