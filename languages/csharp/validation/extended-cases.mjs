const program = body => `using System;\nclass Program {\nstatic void Main() {\n${body}\n}\n}\n`;
const positive = (id, clause, body, stdout) => ({
  id, clause, suite: 'core', kind: 'positive', source: program(body), stdout
});
const negative = (id, clause, body, diagnostic) => ({
  id, clause, suite: 'negative', kind: 'negative', source: program(body), diagnostic
});
const sourceCase = (id, clause, source, stdout) => ({
  id, clause, suite: 'core', kind: 'positive', source, stdout
});
const unsupported = (id, clause, body, diagnostic, wholeProgram = false) => ({
  id, clause, suite: 'unsupported', kind: 'unsupported',
  source: wholeProgram ? body : program(body), diagnostic
});
const display = value => typeof value === 'boolean' ? value ? 'True' : 'False' : String(value);

// BigInt is an independent integer oracle; it does not call compiler or VM helpers.
const arithmetic = [
  ['+', (a, b) => a + b], ['-', (a, b) => a - b], ['*', (a, b) => a * b],
  ['/', (a, b) => a / b], ['%', (a, b) => a % b]
];
const operands = [[0, 1], [1, -1], [-17, 5], [17, -5], [-17, -5],
  [2147483647, 2], [-2147483648, 2], [65537, 65539]];
const comparisons = [
  ['<', (a, b) => a < b], ['<=', (a, b) => a <= b], ['>', (a, b) => a > b],
  ['>=', (a, b) => a >= b], ['==', (a, b) => a === b], ['!=', (a, b) => a !== b]
];

export const EXTENDED_CASES = [
  ...arithmetic.flatMap(([op, calculate], operator) => operands.map(([a, b], index) =>
    positive(`CS-ARITH-${String(operator * operands.length + index + 1).padStart(3, '0')}`,
      '8.3.6; 12.10', `int a = ${a}, b = ${b}; Console.WriteLine(a ${op} b);`,
      [String(BigInt.asIntN(32, calculate(BigInt(a), BigInt(b))))]))),
  ...comparisons.flatMap(([op, compare], operator) => [[-1, 0], [0, 0], [2147483647, -2147483648]].map(([a, b], index) =>
    positive(`CS-CMP-${String(operator * 3 + index + 1).padStart(3, '0')}`, '12.11',
      `int a = ${a}, b = ${b}; Console.WriteLine(a ${op} b);`, [display(compare(a, b))]))),
  ...[false, true].flatMap((a, i) => [false, true].map((b, j) =>
    positive(`CS-BOOL-${String(i * 2 + j + 1).padStart(3, '0')}`, '12.11; 12.14',
      `bool a = ${a}, b = ${b}; Console.WriteLine(a && b); Console.WriteLine(a || b);
Console.WriteLine(a == b); Console.WriteLine(a != b); Console.WriteLine(!a);`,
      [a && b, a || b, a === b, a !== b, !a].map(display)))),
  positive('CS-LEX-005', '6.3.2; 6.3.4', 'int\tvalue\r\n=\r\n7;\r\nConsole.WriteLine(value);', ['7']),
  positive('CS-LEX-006', '6.3.3', 'int/**/n/**/=/**/4; // ignored " /*\nConsole.WriteLine(n);', ['4']),
  positive('CS-LEX-007', '6.4.3; 6.4.4', 'int @class = 2, Class = 3, _value9 = 4; Console.WriteLine(@class + Class + _value9);', ['9']),
  positive('CS-LEX-008', '6.4.5.6', String.raw`Console.WriteLine("\0\a\b\f\n\r\t\v\'\"\\");`, ['\0\x07\b\f\n\r\t\v\'"\\']),
  positive('CS-LEX-009', '6.4.5.6', String.raw`Console.WriteLine("\x41\u0042\U0001F600");`, ['AB\u{1f600}']),
  positive('CS-LEX-010', '6.4.5.6', 'Console.WriteLine(@"a\nb"); Console.WriteLine(@"\\n"); Console.WriteLine("");', ['a\nb', '\\n', '']),
  positive('CS-EXPR-012', '12.4.2', 'int a = 20, b = 5, c = 2; Console.WriteLine(a - b - c); Console.WriteLine(a / b / c);', ['13', '2']),
  positive('CS-EXPR-013', '12.14', 'int n = 0; bool t = true, f = false; Console.WriteLine(t && ++n == 1); Console.WriteLine(f || ++n == 2); Console.WriteLine(n);', ['True', 'True', '2']),
  positive('CS-EXPR-014', '12.18', 'int n = 0, zero = 0; bool b = true; Console.WriteLine(b ? ++n : 1 / zero); b = false; Console.WriteLine(b ? 1 / zero : ++n);', ['1', '2']),
  positive('CS-EXPR-015', '12.18', 'bool a = false, b = true; Console.WriteLine(a ? 1 : b ? 2 : 3); Console.WriteLine(a ? "a" : "b");', ['2', 'b']),
  positive('CS-EXPR-016', '12.21', 'int n = 19; n %= 7; Console.WriteLine(n); n += 3; n *= 2; n -= 4; n /= 3; Console.WriteLine(n);', ['5', '4']),
  positive('CS-EXPR-017', '12.8.15; 12.9.6', 'int n = 2147483647; Console.WriteLine(++n); Console.WriteLine(--n); n = -2147483648; Console.WriteLine(n--); Console.WriteLine(n);', ['-2147483648', '2147483647', '-2147483648', '2147483647']),
  positive('CS-EXPR-018', '12.8.19', 'Console.WriteLine(unchecked(-2147483648 - 1)); Console.WriteLine(unchecked(65536 * 65536)); Console.WriteLine(unchecked(-(-2147483648)));', ['2147483647', '0', '-2147483648']),
  positive('CS-EXPR-019', '12.10.5; 12.11', 'string a = "a", b = "a"; Console.WriteLine(a == b); Console.WriteLine(a != "A"); Console.WriteLine(false + a + 0);', ['True', 'True', 'Falsea0']),
  positive('CS-EXPR-020', '12.4.2', 'bool a = false, b = true, c = true; Console.WriteLine(a || b && c); Console.WriteLine(!a == b);', ['True', 'True']),
  positive('CS-STMT-007', '13.3; 13.4', ';;; {} { {} } Console.WriteLine("empty");', ['empty']),
  positive('CS-STMT-008', '13.8.2', 'bool a = true, b = false; if (a) if (b) Console.WriteLine(1); else Console.WriteLine(2);', ['2']),
  positive('CS-STMT-009', '13.9.2', 'int n = 0; while (n < 5) { n++; if (n < 3) continue; if (n == 4) break; Console.WriteLine(n); } Console.WriteLine(n);', ['3', '4']),
  positive('CS-STMT-010', '13.9.3', 'int n = 0; do { n++; if (n < 3) continue; Console.WriteLine(n); } while (n < 3);', ['3']),
  positive('CS-STMT-011', '13.9.4', 'int n = 0; for (;;) { if (++n == 3) break; } Console.WriteLine(n);', ['3']),
  positive('CS-STMT-012', '13.9.4', 'int i = 0, j = 0; for (i = 1, j = 4; i < j; i++, j--) {} Console.WriteLine(i); Console.WriteLine(j);', ['3', '2']),
  positive('CS-STMT-013', '13.9; 13.10.2', 'int n = 0; for (int i = 0; i < 3; i++) { for (int j = 0; j < 5; j++) { if (j == 2) break; n++; } } Console.WriteLine(n);', ['6']),
  positive('CS-STMT-014', '13.9.2; 13.9.4', 'int n = 0; while (false) n++; for (; false;) n++; Console.WriteLine(n);', ['0']),
  positive('CS-FLOW-003', '9.4', 'int x; if (true) x = 7; Console.WriteLine(x);', ['7']),
  positive('CS-FLOW-004', '9.4', 'int x; while (true) { x = 8; break; } Console.WriteLine(x);', ['8']),
  positive('CS-FLOW-005', '9.4', 'int x; bool b = false; Console.WriteLine(b ? (x = 1) : (x = 2)); Console.WriteLine(x);', ['2', '2']),
  positive('CS-FLOW-006', '9.4', 'int a = 2, b = a + 3, c = b + a; Console.WriteLine(c);', ['7']),
  sourceCase('CS-METHOD-004', '9.2.5; 15.6.2',
    'using System; class P { static int F(int n) { n++; return n; } static void Main() { int n = 4; Console.WriteLine(F(n)); Console.WriteLine(n); } }', ['5', '4']),
  sourceCase('CS-METHOD-005', '15.6; 13.10.5',
    'using System; class P { static void F() { Console.WriteLine("before"); return; } static void Main() { F(); Console.WriteLine("after"); } }', ['before', 'after']),
  sourceCase('CS-METHOD-006', '15.6',
    'using System; class P { static bool Even(int n) { if (n == 0) return true; return Odd(n - 1); } static bool Odd(int n) { if (n == 0) return false; return Even(n - 1); } static void Main() { Console.WriteLine(Even(8)); Console.WriteLine(Odd(8)); } }', ['True', 'False']),
  sourceCase('CS-NS-001', '14.2; 14.3',
    'namespace A.B { class P { static void Main() { System.Console.WriteLine(9); } } }', ['9']),
  sourceCase('CS-ACCESS-001', '7.5; 15.6',
    'using System; class H { internal static int F() { return 5; } } class P { static void Main() { Console.WriteLine(H.F()); } }', ['5']),
  ...[
    ['023', '6.4.5.6', 'Console.WriteLine("unfinished);', 'Newline in regular string'],
    ['024', '6.4.5.6', 'Console.WriteLine("a\nb");', 'Newline in regular string'],
    ['025', '6.4.5.6', String.raw`Console.WriteLine("\u12");`, 'Invalid Unicode escape'],
    ['026', '6.4.5.6', String.raw`Console.WriteLine("\U00110000");`, 'Unicode escape is out of range'],
    ['027', '6.4.3', 'int while = 1;', 'Expected an identifier'],
    ['028', '6.4.5.3', 'int n = 2147483648;', 'outside the supported Int32 range'],
    ['029', '12.23', 'int n = -2147483648 - 1;', 'Constant Int32 expression overflows'],
    ['030', '12.23', 'int n = 65536 * 65536;', 'Constant Int32 expression overflows'],
    ['031', '12.10.4', 'int n = 3 % 0;', 'Constant division by zero'],
    ['032', '12.9', 'bool n = -true;', "'int' is required"],
    ['033', '12.9', 'int n = !1;', "'bool' is required"],
    ['034', '12.11', 'bool n = 1 == true;', "Cannot use 'bool'"],
    ['035', '12.18', 'int n = 1 ? 2 : 3;', "'bool' is required"],
    ['036', '12.18', 'int n = true ? 2 : false;', "Cannot use 'bool'"],
    ['037', '12.21', 'int n = 1; n = "text";', "Cannot use 'string'"],
    ['038', '12.21', '1 = 2;', 'Assignment requires a local variable'],
    ['039', '12.8.15', 'bool n = true; n++;', "'int' is required"],
    ['040', '9.4', 'int n; n++;', 'unassigned local'],
    ['041', '9.4', 'int n; n += 1;', 'unassigned local'],
    ['042', '9.4', 'int n = n;', 'unassigned local'],
    ['043', '7.7', 'int n = 1, n = 2;', 'Duplicate or shadowed'],
    ['044', '7.7', '{ int n = 1; } int n = 2;', 'Duplicate or shadowed'],
    ['045', '7.7; 13.9.4', 'for (int i = 0; i < 1; i++) {} Console.WriteLine(i);', 'Unknown local'],
    ['046', '9.4', 'int n; bool b = true; do { if (b) break; n = 2; } while (false); Console.WriteLine(n);', 'unassigned local'],
    ['047', '13.10.3', 'continue;', 'enclosing loop'],
    ['048', '13.9.2', 'while (1) {}', "'bool' is required"],
    ['049', '13.9.3', 'do {} while (1);', "'bool' is required"],
    ['050', '13.9.4', 'for (; 1;) {}', "'bool' is required"],
    ['051', '13.8.2', 'if (true) int n = 1;', 'requires a block'],
    ['052', '12.6', 'Missing();', 'Unknown static method'],
    ['053', '12.6', 'Console.WriteLine(1, 2);', 'requires 0 or 1 argument'],
    ['054', '12.6', 'Console.Write();', 'requires 1 argument'],
    ['055', '6.2.4', 'int n = 1', "Expected ';'"],
    ['056', '6.2.4', 'Console.WriteLine(1;', "Expected '\\)'"]
  ].map(([id, clause, body, diagnostic]) => negative(`CS-NEG-${id}`, clause, body, diagnostic)),
  ...[
    ['057', '7.1', 'class P { static void F() {} }', 'Exactly one static Main'],
    ['058', '7.1', 'class A { static void Main() {} } class B { static void Main() {} }', 'Exactly one static Main'],
    ['059', '7.1', 'class P { static bool Main() { return true; } }', 'Entry point must be'],
    ['060', '7.1', 'class P { static void Main(int n) {} }', 'Entry point must be'],
    ['061', '7.1', 'class P { static void Main<T>() {} }', 'Entry point must be'],
    ['062', '13.10.5', 'class P { static int F() { return; } static void Main() {} }', 'A value is required'],
    ['063', '13.10.5', 'class P { static int F() { return true; } static void Main() {} }', "Cannot use 'bool'"],
    ['064', '15.6.2', 'class P { static void F(int n, int n) {} static void Main() {} }', 'Duplicate or shadowed'],
    ['065', '12.6.2', 'class P { static void F(int n) {} static void Main() { F(); } }', 'requires 1 argument'],
    ['066', '7.5', 'class H { private static void F() {} } class P { static void Main() { H.F(); } }', 'inaccessible'],
    ['067', '7.3', 'class P { static void Main() {} } class P {}', 'Duplicate class'],
    ['068', '15.6', 'class P { static int P() { return 0; } static void Main() {} }', 'same name as its containing class'],
    ['069', '8.5', 'class P { static T F<T,T>(T n) { return n; } static void Main() {} }', 'Duplicate type parameter'],
    ['070', '8.5', 'class P { static T F<T>(T T) { return T; } static void Main() {} }', 'cannot hide a type parameter'],
    ['071', '8.5; 15.6', 'class P { static T F<T>(T n) { return 1; } static void Main() {} }', "Cannot use 'int'"],
    ['072', '8.5; 12.11', 'class P { static bool F<T>(T n) { return n == n; } static void Main() {} }', 'Equality on unconstrained'],
    ['073', '8.5; 12.6', 'class P { static void F<T>(T n) { System.Console.WriteLine(n); } static void Main() {} }', 'unconstrained type parameter']
  ].map(([id, clause, source, diagnostic]) => ({
    id: `CS-NEG-${id}`, clause, suite: 'negative', kind: 'negative', source, diagnostic
  })),
  ...[
    ['013', '8.3.4; 16', 'struct S {} class P { static void Main() {} }', 'found "struct"', true],
    ['014', '18', 'interface I {} class P { static void Main() {} }', 'found "interface"', true],
    ['015', '19', 'enum E { A } class P { static void Main() {} }', 'found "enum"', true],
    ['016', '20', 'delegate void D(); class P { static void Main() {} }', 'found "delegate"', true],
    ['017', '22', '[System.Obsolete] class P { static void Main() {} }', 'found "\\["', true],
    ['018', '23', 'unsafe class P { static void Main() {} }', 'found "unsafe"', true],
    ['019', '11; 12.11.11', 'bool b = 1 is int;', "Expected ';'"],
    ['021', '8.3.12', 'int? n = null;', 'Expected an identifier'],
    ['022', '8.2.3; 10.2.9', 'object n = 1;', 'found "object"'],
    ['023', '8.3.11', 'int n = (1, 2);', "Expected '\\)'"],
    ['024', '12.16; 12.17', 'string n = null ?? "value";', 'found "null"'],
    ['025', '12.8.17', 'int n = default(int);', 'found "default"'],
    ['026', '12.19', 'int n = x => x;', 'found ">"'],
    ['027', '12.20', 'int n = from x in y select x;', "Expected ';'"],
    ['028', '13.8.3', 'switch (1) { case 1: break; }', 'found "switch"'],
    ['029', '13.10.4', 'goto done; done:;', 'found "goto"'],
    ['030', '13.10.6; 21', 'throw new Exception();', 'found "throw"'],
    ['031', '13.12', 'lock (1) {}', 'found "lock"'],
    ['032', '13.14', 'using (int n = 1) {}', 'found "using"'],
    ['033', '13.15', 'yield return 1;', 'found "return"'],
    ['034', '15.7', 'class P { static int Value { get { return 1; } } static void Main() {} }', 'found "\\{"', true],
    ['035', '15.10', 'class P : Base {} class Q { static void Main() {} }', "Expected '\\{'", true],
    ['036', '15.6.2', 'class P { static void F(ref int n) {} static void Main() {} }', 'found "ref"', true],
    ['037', '6.4.5.5', "char n = 'a';", 'Unsupported character'],
    ['038', '6.4.5.3', 'int n = 0x10;', "Expected ';'"],
    ['039', '6.4.3', 'int café = 1;', 'Unsupported character'],
    ['040', '6.5', '#if FEATURE\n#endif', 'Unsupported character']
  ].map(([id, clause, body, diagnostic, whole]) => unsupported(`CS-UNSUPPORTED-${id}`, clause, body, diagnostic, whole))
];
