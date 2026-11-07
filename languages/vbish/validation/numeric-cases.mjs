const program = body => `Option Strict On\nImports System\nModule Program\nSub Main()\n${body}\nEnd Sub\nEnd Module\n`;
const positive = (id, body, stdout) => ({
  id, clause: 'conversions#primitive-conversions', feature: 'numeric', suite: 'numeric',
  kind: 'positive', source: program(body), stdout
});
const negative = (id, body, diagnostic) => ({
  ...positive(id, body, []), kind: 'negative', diagnostic
});

export const NUMERIC_CASES = [
  positive('VB-NUM-001', 'Console.WriteLine(CInt(True))\nConsole.WriteLine(CInt(False))', ['-1', '0']),
  positive('VB-NUM-002', 'Dim t As Boolean = True\nDim f As Boolean = False\nConsole.WriteLine(CInt(t))\nConsole.WriteLine(CInt(f))', ['-1', '0']),
  positive('VB-NUM-003', 'Console.WriteLine(CBool(0))\nConsole.WriteLine(CBool(-2147483648))\nConsole.WriteLine(CBool(2147483647))', ['False', 'True', 'True']),
  positive('VB-NUM-004', 'Dim n As Integer = -2147483648\nConsole.WriteLine(CBool(n))\nn = 0\nConsole.WriteLine(CBool(n))\nn = 2147483647\nConsole.WriteLine(CBool(n))', ['True', 'False', 'True']),
  positive('VB-NUM-005', 'Dim n As Integer = -2147483648\nDim b As Boolean = True\nDim s As String = "001"\nConsole.WriteLine(CInt(n))\nConsole.WriteLine(CBool(b))\nConsole.WriteLine(CStr(s))', ['-2147483648', 'True', '001']),
  positive('VB-NUM-006', 'Console.WriteLine(CStr(True))\nConsole.WriteLine(CStr(False))\nConsole.WriteLine(CStr(-2147483648))', ['True', 'False', '-2147483648']),
  positive('VB-NUM-007', 'Dim n As Integer = 2147483647\nDim b As Boolean = True\nConsole.WriteLine(CStr(n))\nConsole.WriteLine(CStr(b))', ['2147483647', 'True']),
  positive('VB-NUM-008', 'Dim n As Integer = 42\nConsole.WriteLine(CInt(CBool(n)))\nConsole.WriteLine(CBool(CInt(False)))', ['-1', 'False']),
  positive('VB-NUM-009', 'Dim n As Integer = 2147483647\nConsole.WriteLine(CInt(True) + n)\nConsole.WriteLine(CStr(CInt(True)))', ['2147483646', '-1']),
  positive('VB-NUM-010', 'Dim n As Integer = 0\nConsole.WriteLine(CBool(n = 0))\nConsole.WriteLine(CInt(n = 0))\nConsole.WriteLine(CStr(n = 0))', ['True', '-1', 'True']),
  {
    ...negative('VB-NUM-011', 'Console.WriteLine(CBool("True"))', "Unsupported explicit conversion from 'string' to 'bool'"),
    suite: 'unsupported', kind: 'unsupported'
  },
  negative('VB-NUM-012', 'Console.WriteLine(CInt(Console.WriteLine(1)))', "Unsupported explicit conversion from 'void' to 'int'"),
  negative('VB-NUM-013', 'Dim n As Integer = True', "Cannot use 'bool'"),
  negative('VB-NUM-014', 'Dim b As Boolean = 1', "Cannot use 'int'"),
  negative('VB-NUM-015', 'Console.WriteLine(CInt(2147483647 + 1))', 'Constant Int32 expression overflows'),
  ...[
    ['016', 'Dim n As Integer = -2147483648\nConsole.WriteLine(-n)'],
    ['017', 'Dim n As Integer = 2147483647\nn += 1'],
    ['018', 'Dim n As Integer = -2147483648\nn -= 1'],
    ['019', 'Dim n As Integer = 65536\nn *= n'],
    ['020', 'Dim n As Integer = -2147483648\nDim divisor As Integer = -1\nConsole.WriteLine(n Mod divisor)'],
  ].map(([suffix, body]) => ({
    ...positive(`VB-NUM-${suffix}`, body, []), suite: 'runtime', kind: 'runtime-error',
    diagnostic: 'System\\.OverflowException', errorName: 'RangeError'
  })),
  positive('VB-NUM-021', 'Console.WriteLine(-2147483648 Mod -1)', ['0'])
];
