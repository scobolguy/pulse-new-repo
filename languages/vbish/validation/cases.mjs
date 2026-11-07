import { OVERLOAD_CASES } from './overload-cases.mjs';
import { NUMERIC_CASES } from './numeric-cases.mjs';
import { INTEGER_CASES } from './integer-cases.mjs';

export const program = body => `Option Strict On\nImports System\nModule Program\nSub Main()\n${body}\nEnd Sub\nEnd Module\n`;
const positive = (id, clause, body, stdout) => ({
  id, clause, suite: 'core', kind: 'positive', source: program(body), stdout
});
const negative = (id, clause, body, diagnostic) => ({
  id, clause, suite: 'negative', kind: 'negative', source: program(body), diagnostic
});
const full = (id, clause, methods, body, stdout) => ({
  id, clause, suite: 'core', kind: 'positive',
  source: `Option Strict On\nImports System\nModule Program\n${methods}\nSub Main()\n${body}\nEnd Sub\nEnd Module\n`, stdout
});
const generic = (id, methods, body, stdout, specializations) => ({
  ...full(id, 'general-concepts#generic-types-and-methods', methods, body, stdout), specializations
});
const genericNegative = (id, methods, body, diagnostic) => ({
  ...full(id, 'general-concepts#generic-types-and-methods', methods, body, []),
  suite: 'negative', kind: 'negative', diagnostic
});
const arithmetic = [
  ['+', (a, b) => a + b], ['-', (a, b) => a - b], ['*', (a, b) => a * b],
  ['\\', (a, b) => a / b], ['Mod', (a, b) => a % b]
];
const operands = [[0, 1], [1, -1], [-17, 5], [17, -5], [-17, -5], [2147483646, 1], [-2147483647, 1]];
export const CASES = [
  ...OVERLOAD_CASES,
  ...NUMERIC_CASES,
  ...INTEGER_CASES,
  generic('VB-GEN-001', 'Function Id(Of T)(ByVal value As T) As T\nReturn value\nEnd Function',
    'Console.WriteLine(Id(Of Integer)(42))', ['42'], { 'program.id': [['int']] }),
  generic('VB-GEN-002', 'Function Id(Of T)(value As T) As T\nReturn value\nEnd Function',
    'Console.WriteLine(Id("text"))\nConsole.WriteLine(Id(True))', ['text', 'True'], { 'program.id': [['bool'], ['string']] }),
  generic('VB-GEN-003', 'Function First(Of T)(a As T, b As T) As T\nReturn a\nEnd Function',
    'Console.WriteLine(First(4, 9))', ['4'], { 'program.first': [['int']] }),
  generic('VB-GEN-004', 'Function Choose(Of T)(first As Boolean, a As T, b As T) As T\nIf first Then\nReturn a\nEnd If\nReturn b\nEnd Function',
    'Console.WriteLine(Choose(False, "left", "right"))', ['right'], { 'program.choose': [['string']] }),
  generic('VB-GEN-005', 'Function Id(Of T)(x As T) As T\nReturn x\nEnd Function\nFunction Forward(Of U)(x As U) As U\nReturn Id(Of U)(x)\nEnd Function',
    'Console.WriteLine(Forward(6))', ['6'], { 'program.id': [['int']], 'program.forward': [['int']] }),
  generic('VB-GEN-006', 'Function Repeat(Of T)(x As T, n As Integer) As T\nIf n = 0 Then\nReturn x\nEnd If\nReturn Repeat(x, n - 1)\nEnd Function',
    'Console.WriteLine(Repeat("done", 10))', ['done'], { 'program.repeat': [['string']] }),
  generic('VB-GEN-007', 'Function Id(Of T)(value As t) As T\nDim copy As t = value\nReturn copy\nEnd Function',
    'Console.WriteLine(ID(1) + id(2) + Id(Of Integer)(3))', ['6'], { 'program.id': [['int']] }),
  generic('VB-GEN-008', 'Function Second(Of T, U)(a As T, b As U) As U\nReturn b\nEnd Function',
    'Console.WriteLine(Second(Of Integer, String)(7, "second"))\nConsole.WriteLine(Second(False, 8))',
    ['second', '8'], { 'program.second': [['bool', 'int'], ['int', 'string']] }),
  generic('VB-GEN-009', 'Sub Ignore(Of T)(x As T)\nReturn\nEnd Sub',
    'Call Ignore(Of Integer)(7)\nIgnore("text")', [], { 'program.ignore': [['int'], ['string']] }),
  ...[
    ['001', 'Function F(Of T)(x As T) As T\nReturn x + x\nEnd Function', '', "'int' is required"],
    ['002', 'Function F(Of T)(x As T, y As T) As Boolean\nReturn x = y\nEnd Function', '', 'unconstrained'],
    ['003', 'Function Id(Of T)(x As T) As T\nReturn x\nEnd Function', 'Id(Of String)(1)', "Cannot use 'int'"],
    ['004', 'Function First(Of T)(x As T, y As T) As T\nReturn x\nEnd Function', 'First(1, "x")', 'Conflicting inferred'],
    ['005', 'Sub F(Of T)()\nEnd Sub', 'F()', 'Cannot infer type argument'],
    ['006', 'Function Id(Of T)(x As T) As T\nReturn x\nEnd Function', 'Id(Of Integer, Boolean)(1)', 'requires 1 type argument'],
    ['007', 'Function Id(Of T)(x As T) As T\nReturn x\nEnd Function', 'Id(Of Integer)()', 'requires 1 argument'],
    ['008', 'Sub F(Of T, t)()\nEnd Sub', '', 'Duplicate type parameter'],
    ['009', 'Sub F(Of T)(t As Integer)\nEnd Sub', '', 'cannot hide a type parameter'],
    ['010', 'Function F(Of T)(x As U) As T\nReturn x\nEnd Function', '', "Type 'U' is not supported"],
    ['011', 'Function F(Of T)(x As T, b As Boolean) As T\nIf b Then\nReturn x\nEnd If\nEnd Function', '', 'Not all code paths'],
    ['012', 'Function F(Of T)(x As T) As T\nDim y As T\nReturn y\nEnd Function', '', 'Default values of type parameters'],
    ['013', 'Function F(Of T)(x As T) As T\nExit Function\nEnd Function', '', 'Default values of type parameters'],
    ['014', 'Sub F(Of [Integer])()\nEnd Sub', '', 'built-in type name'],
    ['015', 'Function Id(Of T)(x As T) As T\nReturn x\nEnd Function', 'Id(Console.WriteLine(1))', 'void invocation cannot']
  ].map(([id, methods, body, diagnostic]) => genericNegative(`VB-GENNEG-${id}`, methods, body, diagnostic)),
  ...arithmetic.flatMap(([op, calculate], operator) => operands.map(([a, b], index) => {
    const result = calculate(BigInt(a), BigInt(b));
    const id = `VB-ARITH-${String(operator * operands.length + index + 1).padStart(3, '0')}`;
    const source = program(`Dim a As Integer = ${a}\nDim b As Integer = ${b}\nConsole.WriteLine(a ${op} b)`);
    return result < -2147483648n || result > 2147483647n
      ? { id, clause: 'expressions#arithmetic-operators', source, suite: 'runtime', kind: 'runtime-error', diagnostic: 'System.OverflowException', errorName: 'RangeError' }
      : { id, clause: 'expressions#arithmetic-operators', source, suite: 'core', kind: 'positive', stdout: [String(result)] };
  })),
  positive('VB-LEX-001', 'lexical-grammar#comments', "' comment\nDim n As Integer = 4 ' ignored\nConsole.WriteLine(n)", ['4']),
  positive('VB-LEX-002', 'lexical-grammar#identifiers', 'Dim [If] As Integer = 7\nConsole.WriteLine([if])', ['7']),
  positive('VB-LEX-003', 'lexical-grammar#identifiers', 'Dim Value As Integer = 6\nVALUE = value + 1\nconsole.writeline(vAlUe)', ['7']),
  positive('VB-LEX-004', 'lexical-grammar#string-literals', 'Console.WriteLine("a ""quote""")\nConsole.WriteLine("\\n")\nConsole.WriteLine("")', ['a "quote"', '\\n', '']),
  positive('VB-LEX-005', 'lexical-grammar#characters-and-lines', 'Dim n As Integer = 1 : n += 2 : Console.WriteLine(n)', ['3']),
  positive('VB-LEX-006', 'lexical-grammar#characters-and-lines', 'Dim n As Integer = 1 + _\n  2\nConsole.WriteLine(n)', ['3']),
  positive('VB-LEX-007', 'lexical-grammar#characters-and-lines', 'Dim\tn As Integer = 3\r\nConsole.WriteLine(n)', ['3']),
  positive('VB-TYPE-001', 'types#primitive-types', 'Dim n As Integer\nDim b As Boolean\nConsole.WriteLine(n)\nConsole.WriteLine(b)', ['0', 'False']),
  positive('VB-TYPE-002', 'statements#local-declaration-statements', 'Dim n = 2\nDim s = "text"\nDim b = True\nConsole.WriteLine(n)\nConsole.WriteLine(s)\nConsole.WriteLine(b)', ['2', 'text', 'True']),
  positive('VB-TYPE-003', 'statements#local-declaration-statements', 'Dim a As Integer = 2, b As Integer = a + 3\nConsole.WriteLine(b)', ['5']),
  positive('VB-EXPR-001', 'expressions#arithmetic-operators', 'Console.WriteLine(3 + 4 * 5)\nConsole.WriteLine((3 + 4) * 5)\nConsole.WriteLine(20 - 5 - 2)', ['23', '35', '13']),
  positive('VB-EXPR-002', 'expressions#arithmetic-operators', 'Dim n As Integer = 5\nConsole.WriteLine(-n)\nConsole.WriteLine(+n)\nConsole.WriteLine(-2147483648)', ['-5', '5', '-2147483648']),
  positive('VB-EXPR-003', 'expressions#concatenation-operator', 'Console.WriteLine(2 & 3)\nConsole.WriteLine("n=" & 7 & ", b=" & True)\nDim s As String = "a"\ns &= 3\nConsole.WriteLine(s)', ['23', 'n=7, b=True', 'a3']),
  positive('VB-EXPR-004', 'expressions#comparison-operators', 'Console.WriteLine(1 < 2)\nConsole.WriteLine(2 <= 2)\nConsole.WriteLine(3 > 2)\nConsole.WriteLine(3 >= 4)\nConsole.WriteLine("a" = "a")\nConsole.WriteLine("a" <> "A")', ['True', 'True', 'True', 'False', 'True', 'True']),
  positive('VB-EXPR-005', 'expressions#logical-operators', 'Console.WriteLine(Not 1 = 2)\nConsole.WriteLine(True Or False And False)\nConsole.WriteLine(True Xor True)\nConsole.WriteLine(True Xor False)', ['True', 'True', 'False', 'True']),
  positive('VB-EXPR-006', 'statements#assignment-statements', 'Dim n As Integer = 20\nn += 2\nn -= 4\nn *= 3\nConsole.WriteLine(n)', ['54']),
  ...[false, true].flatMap((a, i) => [false, true].map((b, j) =>
    positive(`VB-BOOL-00${i * 2 + j + 1}`, 'expressions#logical-operators',
      `Dim a As Boolean = ${a}\nDim b As Boolean = ${b}\nConsole.WriteLine(a And b)\nConsole.WriteLine(a Or b)\nConsole.WriteLine(a Xor b)\nConsole.WriteLine(a AndAlso b)\nConsole.WriteLine(a OrElse b)`,
      [a && b, a || b, a !== b, a && b, a || b].map(value => value ? 'True' : 'False')))),
  positive('VB-IF-001', 'statements#conditional-statements', 'Dim n As Integer = 2\nIf n = 1 Then\nConsole.WriteLine("one")\nElseIf n = 2 Then\nConsole.WriteLine("two")\nElse\nConsole.WriteLine("other")\nEnd If', ['two']),
  positive('VB-IF-002', 'statements#conditional-statements', 'If False Then\nConsole.WriteLine("bad")\nElse\nIf True Then\nConsole.WriteLine("nested")\nEnd If\nEnd If', ['nested']),
  positive('VB-IF-003', 'statements#conditional-statements', 'If False Then\nConsole.WriteLine("bad")\nEnd If\nConsole.WriteLine("after")', ['after']),
  positive('VB-FOR-001', 'statements#fornext-statements', 'Dim sum As Integer = 0\nFor i As Integer = 1 To 10\nsum += i\nNext i\nConsole.WriteLine(sum)', ['55']),
  positive('VB-FOR-002', 'statements#fornext-statements', 'For i As Integer = 5 To 1 Step -2\nConsole.WriteLine(i)\nNext i', ['5', '3', '1']),
  positive('VB-FOR-003', 'statements#fornext-statements', 'For i As Integer = 1 To 0\nConsole.WriteLine("bad")\nNext i\nConsole.WriteLine("after")', ['after']),
  positive('VB-FOR-004', 'statements#fornext-statements', 'Dim bound As Integer = 3\nFor i As Integer = 1 To bound\nbound = 0\nConsole.WriteLine(i)\nNext i', ['1', '2', '3']),
  positive('VB-FOR-005', 'statements#fornext-statements', 'Dim i As Integer\nFor i = 1 To 2\nConsole.WriteLine(i)\nNext i\nConsole.WriteLine(i)', ['1', '2', '3']),
  positive('VB-FOR-006', 'statements#branch-statements', 'For i As Integer = 1 To 6\nIf i = 2 Then\nContinue For\nEnd If\nIf i = 4 Then\nExit For\nEnd If\nConsole.WriteLine(i)\nNext i', ['1', '3']),
  positive('VB-FOR-007', 'statements#loop-statements', 'Dim n As Integer\nFor i As Integer = 1 To 3\nFor j As Integer = 1 To 2\nn += 1\nNext j\nNext i\nConsole.WriteLine(n)', ['6']),
  positive('VB-WHILE-001', 'statements#while-statements', 'Dim i As Integer\nWhile i < 3\ni += 1\nConsole.WriteLine(i)\nEnd While', ['1', '2', '3']),
  positive('VB-WHILE-002', 'statements#branch-statements', 'Dim i As Integer\nWhile True\ni += 1\nIf i = 1 Then\nContinue While\nEnd If\nConsole.WriteLine(i)\nExit While\nEnd While', ['2']),
  positive('VB-DO-001', 'statements#do-statements', 'Dim i As Integer\nDo\ni += 1\nLoop Until i = 3\nConsole.WriteLine(i)', ['3']),
  positive('VB-DO-002', 'statements#do-statements', 'Dim i As Integer\nDo While False\ni += 1\nLoop\nConsole.WriteLine(i)', ['0']),
  positive('VB-DO-003', 'statements#do-statements', 'Dim i As Integer\nDo Until i = 2\ni += 1\nLoop\nConsole.WriteLine(i)', ['2']),
  positive('VB-DO-004', 'statements#do-statements', 'Dim i As Integer\nDo\ni += 1\nLoop While False\nConsole.WriteLine(i)', ['1']),
  positive('VB-DO-005', 'statements#branch-statements', 'Dim i As Integer\nDo\ni += 1\nIf i < 3 Then\nContinue Do\nEnd If\nExit Do\nLoop\nConsole.WriteLine(i)', ['3']),
  full('VB-CALL-001', 'type-members#methods', 'Function Twice(ByVal n As Integer) As Integer\nReturn n * 2\nEnd Function', 'Console.WriteLine(Twice(6))', ['12']),
  full('VB-CALL-002', 'type-members#methods', 'Function F(ByVal n As Integer) As Integer\nn += 1\nReturn n\nEnd Function', 'Dim n As Integer = 3\nConsole.WriteLine(F(n))\nConsole.WriteLine(n)', ['4', '3']),
  full('VB-CALL-003', 'type-members#methods', 'Function Fact(ByVal n As Integer) As Integer\nIf n <= 1 Then\nReturn 1\nEnd If\nReturn n * Fact(n - 1)\nEnd Function', 'Console.WriteLine(Fact(6))', ['720']),
  full('VB-CALL-004', 'type-members#methods', 'Function F() As Integer\nEnd Function', 'Console.WriteLine(F())', ['0']),
  full('VB-CALL-005', 'statements#branch-statements', 'Sub F()\nConsole.WriteLine("before")\nReturn\nConsole.WriteLine("bad")\nEnd Sub', 'Call F()\nConsole.WriteLine("after")', ['before', 'after']),
  full('VB-CALL-006', 'expressions#logical-operators', 'Function Probe() As Boolean\nConsole.WriteLine("called")\nReturn True\nEnd Function',
    'Console.WriteLine(False AndAlso Probe())\nConsole.WriteLine(True OrElse Probe())\nConsole.WriteLine(False And Probe())\nConsole.WriteLine(True Or Probe())',
    ['False', 'True', 'called', 'False', 'called', 'True']),
  full('VB-CALL-007', 'expressions#invocation-expressions', 'Function Echo(ByVal n As Integer) As Integer\nConsole.WriteLine(n)\nReturn n\nEnd Function\nFunction Pair(ByVal a As Integer, ByVal b As Integer) As Integer\nReturn a * 10 + b\nEnd Function',
    'Console.WriteLine(Pair(Echo(1), Echo(2)))', ['1', '2', '12']),
  positive('VB-CONSOLE-001', 'type-members#methods', 'Console.Write("a")\nConsole.WriteLine("b")\nConsole.WriteLine()\nConsole.WriteLine(True)', ['ab', '', 'True']),
  positive('VB-PULSE-001', 'statements#invocation-statements', 'Print "a", 3, True\nPrint\nDisplay "done"', ['a3True', '', 'done']),
  ...[
    ['001', 'conversions#implicit-and-explicit-conversions', 'Dim n As Integer = True', "Cannot use 'bool'"],
    ['002', 'general-concepts#scope', 'Console.WriteLine(missing)', 'Unknown local'],
    ['003', 'general-concepts#declarations', 'Dim n As Integer\nDim N As Integer', 'Duplicate or shadowed'],
    ['004', 'statements#conditional-statements', 'If 1 Then\nEnd If', "'bool' is required"],
    ['005', 'statements#while-statements', 'While 1\nEnd While', "'bool' is required"],
    ['006', 'statements#branch-statements', 'Exit For', 'innermost matching loop'],
    ['007', 'statements#branch-statements', 'Continue Do', 'innermost matching loop'],
    ['008', 'statements#branch-statements', 'Return 1', 'void method'],
    ['009', 'statements#fornext-statements', 'For i As Integer = 1 To 2\nNext j', 'Next variable must match'],
    ['010', 'statements#do-statements', 'Do While True\nLoop Until True', 'both a leading and trailing'],
    ['011', 'expressions#constant-expressions', 'Dim n As Integer = 2147483647 + 1', 'Constant Int32 expression overflows'],
    ['012', 'expressions#arithmetic-operators', 'Dim n As Integer = 1 \\ 0', 'Constant division by zero'],
    ['013', 'expressions#arithmetic-operators', 'Dim n As Integer = 1 Mod 0', 'Constant division by zero'],
    ['014', 'expressions#logical-operators', 'Dim b As Boolean = True AndAlso 1', "'bool' is required"],
    ['015', 'lexical-grammar#string-literals', 'Console.WriteLine("unfinished)', 'token recognition error'],
    ['016', 'lexical-grammar#separators', 'Dim n As Integer = 1 Console.WriteLine(n)', 'mismatched input'],
    ['017', 'statements#conditional-statements', 'If True Then\nConsole.WriteLine(1)', 'extraneous input|mismatched input'],
    ['018', 'statements#local-declaration-statements', 'Dim n', 'explicit As type'],
    ['019', 'expressions#arithmetic-operators', 'Dim n As Integer = "x" + 1', 'Mixed String/numeric addition'],
    ['020', 'expressions#invocation-expressions', 'Missing()', 'Unknown static method'],
    ['021', 'general-concepts#scope', 'For i As Integer = 1 To 2\nNext i\nConsole.WriteLine(i)', 'Unknown local']
  ].map(([id, clause, body, diagnostic]) => negative(`VB-NEG-${id}`, clause, body, diagnostic)),
  ...[
    ['001', 'Dim n As Integer = 2147483647\nConsole.WriteLine(n + 1)', 'OverflowException'],
    ['002', 'Dim n As Integer = -2147483648\nConsole.WriteLine(n - 1)', 'OverflowException'],
    ['003', 'Dim n As Integer = 65536\nConsole.WriteLine(n * n)', 'OverflowException'],
    ['004', 'Dim n As Integer = -2147483648\nConsole.WriteLine(-n)', 'OverflowException'],
    ['005', 'Dim n As Integer = 0\nConsole.WriteLine(1 \\ n)', 'DivideByZeroException'],
    ['006', 'Dim n As Integer = 0\nConsole.WriteLine(1 Mod n)', 'DivideByZeroException'],
    ['007', 'Dim n As Integer = -2147483648\nDim d As Integer = -1\nConsole.WriteLine(n \\ d)', 'OverflowException']
  ].map(([id, body, diagnostic]) => ({
    id: `VB-RUN-${id}`, clause: 'expressions#arithmetic-operators', source: program(body),
    suite: 'runtime', kind: 'runtime-error', diagnostic: `System.${diagnostic}`, errorName: 'RangeError'
  })),
  ...[
    ['001', 'types#primitive-types', 'Dim n As Double = 1', 'not supported'],
    ['002', 'types#primitive-types', 'Dim n As Long = 1', 'not supported'],
    ['003', 'types#special-types', 'Dim n As Object = Nothing', 'not supported'],
    ['004', 'expressions#simple-expressions', 'Dim s As String = Nothing', 'Nothing is not supported'],
    ['005', 'expressions#arithmetic-operators', 'Console.WriteLine(1 / 2)', "Operator '/' is not supported"],
    ['006', 'expressions#simple-expressions', 'Console.WriteLine(1.5)', 'Floating-point literals'],
    ['007', 'types#arrays', 'Dim a(3) As Integer', 'mismatched input'],
    ['008', 'statements#exception-handling-statements', 'Try\nCatch\nEnd Try', 'mismatched input|no viable alternative'],
    ['009', 'statements#loop-statements', 'For Each n In values\nNext n', 'mismatched input'],
    ['010', 'expressions#cast-expressions', 'Console.WriteLine(CInt("1"))', "Unsupported explicit conversion from 'string' to 'int'"],
    ['011', 'statements#conditional-statements', 'Select Case 1\nCase 1\nEnd Select', 'no viable alternative|mismatched input'],
    ['012', 'statements#using-statement', 'Using resource\nEnd Using', 'no viable alternative|mismatched input'],
    ['013', 'statements#await-statement', 'Await F()', 'no viable alternative|mismatched input'],
    ['014', 'preprocessing-directives#conditional-compilation', '#If FEATURE Then\n#End If', 'token recognition error'],
    ['015', 'types#primitive-types', 'Dim s As String', 'Nothing/default String'],
    ['016', 'expressions#logical-operators', 'Console.WriteLine(1 And 2)', "'bool' is required"]
  ].map(([id, clause, body, diagnostic]) => ({
    id: `VB-UNSUPPORTED-${id}`, clause, suite: 'unsupported', kind: 'unsupported', source: program(body), diagnostic
  })),
  ...[
    ['017', 'type-members#methods', 'Module P\nSub F(ByRef n As Integer)\nEnd Sub\nSub Main()\nEnd Sub\nEnd Module\n', 'ByRef is not supported'],
    ['018', 'source-files-and-namespaces#compilation-options', 'Option Strict Off\nModule P\nSub Main()\nEnd Sub\nEnd Module\n', 'Option Explicit Off and Option Strict Off'],
    ['019', 'types#classes', 'Class P\nEnd Class\n', 'mismatched input|extraneous input'],
    ['020', 'attributes#attribute-blocks', '<Obsolete> Module P\nEnd Module\n', 'mismatched input|extraneous input'],
    ['021', 'source-files-and-namespaces#namespaces', 'Namespace N\nEnd Namespace\n', 'mismatched input|extraneous input'],
    ['022', 'type-members#properties', 'Module P\nProperty Value As Integer\nEnd Module\n', 'mismatched input|extraneous input'],
    ['023', 'types#delegates', 'Delegate Sub D()\n', 'mismatched input|extraneous input'],
    ['024', 'general-concepts#generic-types-and-methods', 'Module P\nFunction F(Of T As Class)(n As T) As T\nReturn n\nEnd Function\nSub Main()\nEnd Sub\nEnd Module\n', 'mismatched input|extraneous input']
  ].map(([id, clause, source, diagnostic]) => ({
    id: `VB-UNSUPPORTED-${id}`, clause, suite: 'unsupported', kind: 'unsupported', source, diagnostic
  }))
];
