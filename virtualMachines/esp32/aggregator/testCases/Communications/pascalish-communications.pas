daemon "communications-pascalish" refresh 5 s;
role code_librarian;
library "communications-normalize" from librarian;
use "communications-normalize" as normalizer;
import mapper "communications-normalize" from mapper;

mapper "communications-normalize" source "swift-mt103" target "pacs" begin
  map "reference" to "messageId";
  map "amount" to "amount" using "output := mtamounttodecimal(src);";
  map "currency" to "currency" using "output := upper(src);";
end;
