const program = body => `Option Strict On\nImports System\nModule Program\nSub Main()\n${body}\nEnd Sub\nEnd Module\n`;
const positive = (id, body, stdout) => ({
  id, clause: 'conversions#primitive-conversions', feature: 'integers',
  suite: 'integers', kind: 'positive', source: program(body), stdout
});
const negative = (id, body, diagnostic) => ({ ...positive(id, body, []), kind: 'negative', diagnostic });
const runtime = (id, body) => ({
  ...positive(id, body, []), suite: 'runtime', kind: 'runtime-error',
  diagnostic: 'System\\.OverflowException', errorName: 'RangeError'
});
const widths = [['SByte', 'CSByte', -128, 127], ['Byte', 'CByte', 0, 255],
  ['Short', 'CShort', -32768, 32767], ['UShort', 'CUShort', 0, 65535]];

export const INTEGER_CASES = [
  ...widths.flatMap(([type, cast, min, max], index) => [
    positive(`VB-WIDTH-${String(index * 5 + 1).padStart(3, '0')}`,
      `Dim a As ${type} = ${min}\nDim b As ${type} = ${max}\nDim n As Integer = b\nConsole.WriteLine(a)\nConsole.WriteLine(b)\nConsole.WriteLine(n)\nConsole.WriteLine(CStr(b))`,
      [String(min), String(max), String(max), String(max)]),
    positive(`VB-WIDTH-${String(index * 5 + 2).padStart(3, '0')}`,
      `Dim b As Boolean = True\nConsole.WriteLine(${cast}(b))\nConsole.WriteLine(${cast}(True))\nConsole.WriteLine(CBool(${cast}(${max})))`,
      [String(min === 0 ? max : -1), String(min === 0 ? max : -1), 'True']),
    runtime(`VB-WIDTH-${String(index * 5 + 3).padStart(3, '0')}`,
      `Dim n As Integer = ${max + 1}\nConsole.WriteLine(${cast}(n))`),
    negative(`VB-WIDTH-${String(index * 5 + 4).padStart(3, '0')}`,
      `Dim n As ${type} = ${max + 1}`, `Cannot use 'int' where '${type.toLowerCase()}'`),
    runtime(`VB-WIDTH-${String(index * 5 + 5).padStart(3, '0')}`,
      `Dim n As ${type} = ${max}\nn += ${cast}(1)`)
  ]),
  positive('VB-WIDTH-021', 'Dim b As Byte=255\nDim s As Short=b\nDim u As UShort=b\nConsole.WriteLine(s)\nConsole.WriteLine(u)\nConsole.WriteLine(-u)', ['255', '255', '-255']),
  runtime('VB-WIDTH-022', 'Dim a As Short=32767\nDim b As Short=1\nConsole.WriteLine(a+b)'),
  positive('VB-WIDTH-023', 'Dim a As Short=32767\nDim b As Integer=1\nConsole.WriteLine(a+b)', ['32768']),
  negative('VB-WIDTH-024', 'Dim n As Integer=1\nDim b As Byte=n', "Cannot use 'int' where 'byte'"),
  negative('VB-WIDTH-025', 'Console.WriteLine(CByte(256))', 'Constant byte conversion overflows'),
  positive('VB-WIDTH-026', 'Dim s As SByte=-128\nDim b As Byte=255\nConsole.WriteLine(s+b)\nConsole.WriteLine(CBool(s))', ['127', 'True']),
  {
    ...positive('VB-WIDTH-027', '', ['byte', 'short', 'int', 'identity']),
    source: `Option Strict On\nImports System\nModule Program
Function F(n As Byte) As String
Return "byte"
End Function
Function F(n As Short) As String
Return "short"
End Function
Function F(n As Integer) As String
Return "int"
End Function
Function G(Of T)(n As T) As String
Return "identity"
End Function
Function G(n As Integer) As String
Return "widened"
End Function
Sub Main()
Dim b As Byte=1
Dim s As Short=1
Dim i As Integer=1
Console.WriteLine(F(b))
Console.WriteLine(F(s))
Console.WriteLine(F(i))
Console.WriteLine(G(b))
End Sub\nEnd Module`
  },
  {
    ...positive('VB-WIDTH-028', '', ['short']),
    source: `Option Strict On\nImports System\nModule P
Function F(n As Short) As String
Return "short"
End Function
Function F(n As Integer) As String
Return "int"
End Function
Sub Main()
Dim b As Byte=1
Console.WriteLine(F(b))
End Sub\nEnd Module`
  },
  {
    ...positive('VB-WIDTH-029', '', ['signed']),
    source: `Option Strict On\nImports System\nModule P
Function F(n As Short) As String
Return "signed"
End Function
Function F(n As UShort) As String
Return "unsigned"
End Function
Sub Main()
Dim b As Byte=1
Console.WriteLine(F(b))
End Sub\nEnd Module`
  },
  {
    ...positive('VB-WIDTH-030', '', ['65535', '127']),
    source: `Imports System\nModule P
Function Id(Of T)(n As T) As T
Return n
End Function
Sub Main()
Dim u As UShort=65535
Dim s As SByte=127
Console.WriteLine(Id(u))
Console.WriteLine(Id(s))
End Sub\nEnd Module`
  },
  {
    ...negative('VB-WIDTH-031', '', 'Ambiguous invocation'),
    source: `Option Strict On\nModule P
Sub F(a As Short,b As Integer)
End Sub
Sub F(a As Integer,b As Short)
End Sub
Sub Main()
Dim b As Byte=1
F(b,b)
End Sub\nEnd Module`
  },
  {
    ...positive('VB-WIDTH-032', '', ['255']),
    source: `Option Strict On\nImports System\nModule P
Function F(n As Byte) As Byte
Return n
End Function
Sub Main()
Console.WriteLine(F(255))
End Sub\nEnd Module`
  },
  ...widths.map(([type], index) => negative(`VB-WIDTH-${String(index + 33).padStart(3, '0')}`,
    `Dim n As ${type}=1\nn += 1`, `Cannot use 'int' where '${type.toLowerCase()}'`))
];
