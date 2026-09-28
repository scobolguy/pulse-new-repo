SERVICE "new-pascalish-service";

VAR myLegacyMessage : swift-mt103 from LIBRARIAN;

BEGIN
  if myLegacyMessage.finEnvelope.block4.fields.59A = "BOFM" then
  println("From BOFM");
  end.


