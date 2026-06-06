DAEMON "interop-router" REFRESH 2 S;
ROLE CODE_LIBRARIAN;
LIBRARY "payments-common" FROM LIBRARIAN;
USE "payments-common" AS payments;
INTEROP WFL "pain2-routing" AS wf;
INTEROP COBOLISH "nostro-posting" AS cob;

VAR inbound : envelope<swift-mt103> FROM LIBRARIAN;

ROUTER "mt103-route" INPUT "swift.mt103.inbound" DESCRIPTION "Route MT103" ENABLED TRUE BEGIN
  OUTPUT "swift.mt103.parsed" TYPE envelope<swift-mt103> WHEN "output := 1;" TRANSFORM "output := src;";
END;

MAPPER "mt103-map" SOURCE envelope<swift-mt103> TARGET envelope<pacs008> DESCRIPTION "map payload" ENABLED TRUE BEGIN
  MAP "src.sender" TO "dst.sender";
END;
