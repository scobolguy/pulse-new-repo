Service "vbish-mt103-to-pacs008" On Local

Role Code_Librarian
Library "payments-common" From Librarian
Use "payments-common" As Core
Import Mapper "cbds-mt103-to-pacs008" From Mapper

Route "swift.mt103.parsed" To "cbds.pacs.outbound" Using Mapper "cbds-mt103-to-pacs008"
