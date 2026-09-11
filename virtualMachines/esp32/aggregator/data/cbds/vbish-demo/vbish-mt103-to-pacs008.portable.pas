service "vbish-mt103-to-pacs008" on local;
role code_librarian;
library "payments-common" from librarian;
use "payments-common" as Core;
import "cbds-mt103-to-pacs008" from mapper;
router "cbds-mt103-to-pacs008-route" input "swift.mt103.parsed" begin
  output "cbds.pacs.outbound" when "output := 1;" transform "output := map('cbds-mt103-to-pacs008', src);";
end;
begin
end.
