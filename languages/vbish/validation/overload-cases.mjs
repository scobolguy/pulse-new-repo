const source = (methods, body = '') => `Option Strict On
Imports System
Module P
${methods}
Sub Main()
${body}
End Sub
End Module
`;
const positive = (id, methods, body, stdout) => ({
  id: `VB-OVER-${id}`, clause: 'overload-resolution#overloaded-method-resolution',
  suite: 'overloads', kind: 'positive', source: source(methods, body), stdout,
});
const negative = (id, methods, body, diagnostic) => ({
  id: `VB-OVERNEG-${id}`, clause: 'overload-resolution#overloaded-method-resolution',
  suite: 'overloads', kind: 'negative', source: source(methods, body), diagnostic,
});

export const OVERLOAD_CASES = [
  positive('001', `Function F(x As Integer) As String
Return "int"
End Function
Function F(x As Boolean) As String
Return "bool"
End Function
Function F(x As String) As String
Return "string"
End Function`, 'Console.WriteLine(F(1))\nConsole.WriteLine(F(True))\nConsole.WriteLine(F("x"))', ['int', 'bool', 'string']),
  positive('002', `Function F() As Integer
Return 0
End Function
Function F(x As Integer) As Integer
Return x
End Function
Function F(x As Integer, y As Integer) As Integer
Return x + y
End Function`, 'Console.WriteLine(F())\nConsole.WriteLine(F(2))\nConsole.WriteLine(F(3,4))', ['0', '2', '7']),
  positive('003', `Function F(x As Integer) As String
Return "concrete"
End Function
Function F(Of T)(x As T) As String
Return "generic"
End Function`, 'Console.WriteLine(F(1))\nConsole.WriteLine(F(Of Integer)(1))\nConsole.WriteLine(F(True))', ['concrete', 'generic', 'generic']),
  positive('004', `Function F(Of T)(x As T, y As Integer) As String
Return "specific"
End Function
Function F(Of T)(x As T, y As T) As String
Return "general"
End Function`, 'Console.WriteLine(F(1,2))\nConsole.WriteLine(F(True,2))', ['specific', 'specific']),
  positive('005', `Function F(Of T)(x As T, y As T) As String
Return "generic"
End Function
Function F(x As String, y As Integer) As String
Return "concrete"
End Function`, 'Console.WriteLine(F("x",1))', ['concrete']),
  positive('006', `Function F(Of T)(x As T) As T
Return x
End Function
Function F(Of T)(x As T, ignored As Boolean) As T
Return F(x)
End Function`, 'Console.WriteLine(F(7))\nConsole.WriteLine(F(8,True))\nConsole.WriteLine(F("s",False))', ['7', '8', 's']),
  positive('007', `Function F(Of T)(x As T) As String
Return "one"
End Function
Function F(Of T,U)(x As T) As String
Return "two"
End Function`, 'Console.WriteLine(F(1))\nConsole.WriteLine(F(Of Integer)(1))\nConsole.WriteLine(F(Of Integer,Boolean)(1))', ['one', 'one', 'two']),
  positive('008', `Function F(x As Integer) As String
Return "concrete"
End Function
Function F(Of T)(x As T) As String
Return "generic"
End Function
Function G(Of T)(x As T) As String
Return F(x)
End Function`, 'Console.WriteLine(G(1))\nConsole.WriteLine(F(1))', ['generic', 'concrete']),
  positive('009', `Function Main(x As Integer) As Integer
Return x + 1
End Function`, 'Console.WriteLine(Main(41))', ['42']),
  positive('010', `Function F(n As Integer) As Integer
If n = 0 Then
Return 1
End If
Return n * F(n-1)
End Function
Function F(s As String) As String
Return s
End Function`, 'Console.WriteLine(F(5))\nConsole.WriteLine(F("done"))', ['120', 'done']),
  positive('011', `Function Echo(x As Integer) As Integer
Console.WriteLine(x)
Return x
End Function
Function F(x As Integer, y As Integer) As Integer
Return x * 10 + y
End Function
Function F(x As String, y As String) As String
Return x & y
End Function`, 'Console.WriteLine(F(Echo(1),Echo(2)))', ['1', '2', '12']),
  positive('012', `Function F(Of T)(x As Integer, y As T) As String
Return "specific"
End Function
Function F(Of T)(x As T, y As T) As String
Return "general"
End Function`, 'Console.WriteLine(F(1,2))', ['specific']),
  negative('001', `Function F(x As Integer) As Integer
Return x
End Function
Function f(y As Integer) As Boolean
Return True
End Function`, '', 'Duplicate method signature'),
  negative('002', `Function F(Of T)(x As T) As T
Return x
End Function
Function f(Of U)(y As U) As U
Return y
End Function`, '', 'Duplicate method signature'),
  negative('003', `Function F(Of T)(x As T, y As Integer) As String
Return "a"
End Function
Function F(Of T)(x As Integer, y As T) As String
Return "b"
End Function`, 'F(1,2)', 'Ambiguous invocation'),
  negative('004', `Sub F(x As Integer)
End Sub
Sub F(x As Boolean)
End Sub`, 'F("s")', 'No applicable overload'),
  negative('005', `Sub F(x As Integer)
End Sub
Sub F(x As Boolean)
End Sub`, 'F(1,2)', 'No applicable overload'),
  negative('006', `Sub F(Of T)(x As Integer)
End Sub
Sub F(Of U,V)(x As Boolean)
End Sub`, 'F(1)', 'No applicable overload.*Cannot infer'),
  negative('007', `Function F(Of T,U)(x As T, y As U) As String
Return "a"
End Function
Function F(Of T,U)(x As U, y As T) As String
Return "b"
End Function`, 'F(1,2)', 'Ambiguous invocation'),
  negative('008', `Function F(Of T)(x As T, y As Integer) As String
Return "a"
End Function
Function F(Of T)(x As Integer, y As T) As String
Return "b"
End Function`, 'Dim s As String = F(1,2)', 'Ambiguous invocation'),
  negative('009', `Sub F(x As Integer)
End Sub
Sub F(x As Boolean)
End Sub`, 'F(Of Integer)(1)', 'No applicable overload'),
];
