Daemon "communications-vbish" On Local Every 5 S
Role Code_Librarian
Library "communications-normalize" From Librarian
Use "communications-normalize" As Normalizer
Import Mapper "communications-normalize" From Mapper
Interop COBOLISH "communications-cobolish" As CommunicationsCobol
Sub Main()
  Dim inbound As String From Librarian
  inbound = "COMMUNICATIONS VBISH READY"
End Sub
