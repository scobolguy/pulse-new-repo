SERVICE "mt940_to_camt053_service";

ROUTER "mt940_to_camt053_router" INPUT "swift-mt940.inbound" DESCRIPTION "Deterministic SWIFT MT940 to ISO 20022 CAMT.053 statement mapping | SEQUENTIAL-MODE workers=1 | XML-IN-OUT contract: parse from XML at ingress, emit XML at egress" ENABLED TRUE BEGIN
  OUTPUT "camt.outbound" WHEN "output := 1;" TRANSFORM "output := toxml(map(\"mt940_to_camt053\", fromxml(src)));";
END;

MAPPER "mt940_to_camt053" SOURCE "swift-mt940" TARGET "camt" DESCRIPTION "Deterministic SWIFT MT940 to ISO 20022 CAMT.053 statement mapping" ENABLED TRUE BEGIN
  MAP "block4.field20" TO "Document.BkToCstmrStmt.GrpHdr.MsgId" USING "output := src;";
  MAP "meta.createdAt" TO "Document.BkToCstmrStmt.GrpHdr.CreDtTm" USING "output := src;";
  MAP "block4.field20" TO "Document.BkToCstmrStmt.Stmt.Id" USING "output := src;";
  MAP "block4.field28CStatementNumber" TO "Document.BkToCstmrStmt.Stmt.ElctrncSeqNb" USING "output := src;";
  MAP "block4.field28CSequenceNumber" TO "Document.BkToCstmrStmt.Stmt.LglSeqNb" USING "output := src;";
  MAP "block4.field25" TO "Document.BkToCstmrStmt.Stmt.Acct.Id.Othr.Id" USING "output := src;";
  MAP "block4.fieldBalances" TO "Document.BkToCstmrStmt.Stmt.Bal" USING "output := src;";
  MAP "block4.fieldEntries" TO "Document.BkToCstmrStmt.Stmt.Ntry" USING "output := src;";
END;