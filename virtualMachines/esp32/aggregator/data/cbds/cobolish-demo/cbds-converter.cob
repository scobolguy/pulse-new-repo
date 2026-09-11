IDENTIFICATION DIVISION.
PROGRAM-ID. CBDS-CONVERTER.
PULSE SERVICE "cbds-converter" ON LOCAL.

ROLE CODE_LIBRARIAN.
LIBRARY "payments-common" FROM LIBRARIAN.
USE "payments-common" AS CORE.
ROUTE "swift.mt103.parsed" TO "cbds.pacs.outbound" USING MAPPER cbds-mt103-to-pacs008.

DATA DIVISION.
MAPPING SECTION.
MAPPER-ENTRY cbds-mt103-to-pacs008
    SOURCE-TYPE swift-mt103
    TARGET-TYPE pacs.

MAP-RULE block4.20 TO Document.FIToFICstmrCdtTrf.GrpHdr.MsgId
    USING BEGIN output = trim(src) END.
MAP-RULE block4.20 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.PmtId.InstrId
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
MAP-RULE block4.33B.currency TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.@Ccy
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.33B.amount TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstdAmt.#text
    USING BEGIN output = mtamounttodecimal(src) END.
MAP-RULE block4.50K TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Dbtr.Nm
    USING BEGIN output = mtpartyname(src) END.
MAP-RULE block4.52A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.DbtrAgt.FinInstnId.BICFI
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.53A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt1.FinInstnId.BICFI
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.56A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrmyAgt2.FinInstnId.BICFI
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.57A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.CdtrAgt.FinInstnId.BICFI
    USING BEGIN output = upper(trim(src)) END.
MAP-RULE block4.59 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.Cdtr.Nm
    USING BEGIN output = mtpartyname(src) END.
MAP-RULE block4.70 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.RmtInf.Ustrd
    USING BEGIN output = trim(src) END.
MAP-RULE block4.71A TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgBr
    USING BEGIN output = mtchargebearertoiso(src) END.
MAP-RULE block4.71B TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.ChrgsInf.Amt.#text
    USING BEGIN output = mtamounttodecimal(src) END.
MAP-RULE block4.72 TO Document.FIToFICstmrCdtTrf.CdtTrfTxInf.InstrForNxtAgt.InstrInf
    USING BEGIN output = trim(src) END.
MAP-RULE meta.createdAt TO Document.FIToFICstmrCdtTrf.GrpHdr.CreDtTm
    USING BEGIN output = trim(src) END.

PROCEDURE DIVISION.
    DISPLAY "CBDS-CONVERTER READY".
    GOBACK.
END PROGRAM CBDS-CONVERTER.
