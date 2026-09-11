IDENTIFICATION DIVISION.
PROGRAM-ID. MT103-PACS008-LOAD-TEST.
PULSE SERVICE "mt103-pacs008-load-test" ON LOCAL.

ROLE CODE_LIBRARIAN.
LIBRARY "payments-common" FROM LIBRARIAN.
USE "payments-common" AS CORE.
ROUTE "swift.mt103.parsed" TO "cbds.pacs.outbound" USING MAPPER cbds-mt103-to-pacs008.

DATA DIVISION.
WORKING-STORAGE SECTION.
01 ATTEMPT-COUNT PIC 99 VALUE 0.
01 MAX-ATTEMPTS PIC 99 VALUE 9.

MAPPING SECTION.
MAPPER-ENTRY cbds-mt103-to-pacs008
    SOURCE-TYPE swift-mt103
    TARGET-TYPE pacs.

MAP-RULE block4.20 TO Document.FIToFICstmrCdtTrf.GrpHdr.MsgId
    USING BEGIN output = trim(src) END.
MAP-RULE block4.21 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.EndToEndId
    USING BEGIN output = trim(src) END.
MAP-RULE block4.23B TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtTpInf.LclInstrm.Prtry
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.32A.date TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmDt
    USING BEGIN output = yymmddtoiso(src) END.
MAP-RULE block4.32A.currency TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.@Ccy
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.32A.amount TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt.#text
    USING BEGIN output = mtamounttodecimal(src) END.
MAP-RULE block4.50K TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm
    USING BEGIN output = mtpartyname(src) END.
MAP-RULE block4.57A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.59 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm
    USING BEGIN output = mtpartyname(src) END.
MAP-RULE block4.70 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd
    USING BEGIN output = trim(src) END.
MAP-RULE block4.71A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr
    USING BEGIN output = mtchargebearertoiso(src) END.

PROCEDURE DIVISION.
    ACCEPT INCOMING-MT103.
    PERFORM LOAD-ONE VARYING ATTEMPT-COUNT FROM 0 BY 1 UNTIL ATTEMPT-COUNT > MAX-ATTEMPTS.
    ACCEPT OUTGOING-PACS008.
    DISPLAY INCOMING-MT103.
    DISPLAY OUTGOING-PACS008.
    GOBACK.

LOAD-ONE.
    DISPLAY "INCOMING MT103:".
    DISPLAY "OUTGOING PACS.008:".

END PROGRAM MT103-PACS008-LOAD-TEST.
