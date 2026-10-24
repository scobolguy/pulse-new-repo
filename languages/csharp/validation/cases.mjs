const program = body => `using System;\nclass Program {\n  static void Main() {\n${body}\n  }\n}\n`;
const positive = (id, clause, body, stdout) => ({
  id, clause, suite: 'core', kind: 'positive', source: program(body), stdout
});
const negative = (id, clause, body, diagnostic) => ({
  id, clause, suite: 'negative', kind: 'negative', source: program(body), diagnostic
});
const generic = (id, methods, body, stdout, specializations) => ({
  id, clause: '8.5; 15.6; 12.6.3', suite: 'generics', kind: 'positive',
  source: `using System;\nclass Program {\n${methods}\nstatic void Main() {\n${body}\n}\n}\n`,
  stdout, specializations
});
const unsupported = (id, clause, source, diagnostic) => ({
  id, clause, suite: 'unsupported', kind: 'unsupported', source, diagnostic
});

// Original Pulse test programs, not imported CCVS/PVS or ECMA examples.
export const CASES = [
  positive('CS-LEX-001', '6.3.3', '// single line\nint x = 2; /* multi\nline */ Console.WriteLine(x);', ['2']),
  positive('CS-LEX-002', '6.4.5.6', String.raw`Console.WriteLine("q=\" slash=\\ tab=\t \u0041");`, ['q=" slash=\\ tab=\t A']),
  positive('CS-LEX-003', '6.4.5.6', 'Console.WriteLine(@"first ""quote""");', ['first "quote"']),
  positive('CS-LEX-004', '6.4.3', 'int @while = 4; Console.WriteLine(@while);', ['4']),
  positive('CS-TYPE-001', '8.3.6; 8.3.9; 8.2.5', 'int n = 12; bool b = true; string s = "value"; Console.WriteLine(n); Console.WriteLine(b); Console.WriteLine(s);', ['12', 'True', 'value']),
  positive('CS-EXPR-001', '12.4.2', 'Console.WriteLine(3 + 4 * 5); Console.WriteLine((3 + 4) * 5);', ['23', '35']),
  positive('CS-EXPR-002', '12.9', 'int n = 5; Console.WriteLine(-n); Console.WriteLine(+n); Console.WriteLine(!false);', ['-5', '5', 'True']),
  positive('CS-EXPR-003', '12.10.3; 12.10.4', 'int a = -17, b = 5; Console.WriteLine(a / b); Console.WriteLine(a % b);', ['-3', '-2']),
  positive('CS-EXPR-004', '12.10.3; 12.10.4', 'int a = 17, b = -5; Console.WriteLine(a / b); Console.WriteLine(a % b);', ['-3', '2']),
  positive('CS-EXPR-005', '12.8.19', 'int n = 2147483647; Console.WriteLine(n + 1); Console.WriteLine(unchecked(2147483647 + 1));', ['-2147483648', '-2147483648']),
  positive('CS-EXPR-006', '12.8.15; 12.9.6', 'int n = 2; Console.WriteLine(n++); Console.WriteLine(++n); Console.WriteLine(n--); Console.WriteLine(--n);', ['2', '4', '4', '2']),
  positive('CS-EXPR-007', '12.10.5', 'Console.WriteLine("n=" + 7 + ", ready=" + true); string s = "a"; s += 3; Console.WriteLine(s);', ['n=7, ready=True', 'a3']),
  positive('CS-EXPR-008', '12.11', 'Console.WriteLine(3 < 4); Console.WriteLine(3 >= 4); Console.WriteLine("same" == "same"); Console.WriteLine("A" != "a");', ['True', 'False', 'True', 'True']),
  positive('CS-EXPR-009', '12.14', 'int n = 0; bool t = true, f = false; Console.WriteLine(t || ++n == 1); Console.WriteLine(f && ++n == 1); Console.WriteLine(n);', ['True', 'False', '0']),
  positive('CS-EXPR-010', '12.18', 'bool flag = false; Console.WriteLine(flag ? 10 : 20);', ['20']),
  positive('CS-EXPR-011', '12.21', 'int a = 1, b = 2; a = b = 9; Console.WriteLine(a + b); a *= 3; a -= 2; a /= 5; Console.WriteLine(a);', ['18', '5']),
  positive('CS-STMT-001', '13.8', 'int n = 2; if (n < 0) Console.WriteLine("negative"); else if (n == 2) Console.WriteLine("two"); else Console.WriteLine("other");', ['two']),
  positive('CS-STMT-002', '13.9.2', 'int i = 0, sum = 0; while (i < 5) { sum += i; i++; } Console.WriteLine(sum);', ['10']),
  positive('CS-STMT-003', '13.9.3', 'int i = 0; do { i++; } while (false); Console.WriteLine(i);', ['1']),
  positive('CS-STMT-004', '13.9.4', 'int sum = 0; for (int i = 1; i <= 10; i++) sum += i; Console.WriteLine(sum);', ['55']),
  positive('CS-STMT-005', '13.10.2; 13.10.3', 'int sum = 0; for (int i = 0; i < 8; i++) { if (i == 2) continue; if (i == 5) break; sum += i; } Console.WriteLine(sum);', ['8']),
  positive('CS-STMT-006', '13.9.4', 'int n = 0; for (int i = 0; i < 3; i++) for (int j = 0; j < 4; j++) n++; Console.WriteLine(n);', ['12']),
  positive('CS-FLOW-001', '9.4', 'int n; bool flag = true; if (flag) n = 10; else n = 20; Console.WriteLine(n);', ['10']),
  positive('CS-FLOW-002', '9.4', 'int n; do { n = 6; } while (false); Console.WriteLine(n);', ['6']),
  positive('CS-SCOPE-001', '7.7; 13.6.2', '{ int n = 1; Console.WriteLine(n); } { int n = 2; Console.WriteLine(n); }', ['1', '2']),
  {
    id: 'CS-METHOD-001', clause: '15.6', suite: 'core', kind: 'positive',
    source: 'using System; class Program { static int F(int n) { if (n <= 1) return 1; return n * F(n - 1); } static void Main() { Console.WriteLine(F(7)); } }',
    stdout: ['5040']
  },
  {
    id: 'CS-METHOD-002', clause: '12.6.2; 15.6', suite: 'core', kind: 'positive',
    source: 'using System; class Program { static int Pair(int a, int b) { return a * 10 + b; } static void Main() { int n = 3; Console.WriteLine(Pair(n++, n++)); Console.WriteLine(n); } }',
    stdout: ['34', '5']
  },
  {
    id: 'CS-METHOD-003', clause: '15.6.2', suite: 'core', kind: 'positive',
    source: 'using System; class Program { static string Copy(string text) { return text; } static void Main() { Console.WriteLine(Copy("not a number")); } }',
    stdout: ['not a number']
  },
  {
    id: 'CS-MAIN-001', clause: '7.1; 7.2', suite: 'core', kind: 'positive',
    source: 'class Program { static int Main() { return 23; } }', stdout: [], exitCode: 23
  },
  generic('CS-GEN-001', 'static T Id<T>(T x) { return x; }', 'Console.WriteLine(Id<int>(42));', ['42'], { 'Program.Id': [['int']] }),
  generic('CS-GEN-002', 'static T Id<T>(T x) { return x; }', 'Console.WriteLine(Id("text")); Console.WriteLine(Id(true));', ['text', 'True'], { 'Program.Id': [['bool'], ['string']] }),
  generic('CS-GEN-003', 'static T First<T>(T a, T b) { return a; }', 'Console.WriteLine(First(4, 9));', ['4'], { 'Program.First': [['int']] }),
  generic('CS-GEN-004', 'static T Choose<T>(bool first, T a, T b) { if (first) return a; return b; }', 'Console.WriteLine(Choose(false, "left", "right"));', ['right'], { 'Program.Choose': [['string']] }),
  generic('CS-GEN-005', 'static T Id<T>(T x) { return x; } static T Forward<T>(T x) { return Id<T>(x); }', 'Console.WriteLine(Forward(6));', ['6'], { 'Program.Id': [['int']], 'Program.Forward': [['int']] }),
  generic('CS-GEN-006', 'static T Repeat<T>(T x, int n) { if (n == 0) return x; return Repeat(x, n - 1); }', 'Console.WriteLine(Repeat("done", 10));', ['done'], { 'Program.Repeat': [['string']] }),
  generic('CS-GEN-007', 'static T Id<T>(T x) { return x; }', 'Console.WriteLine(Id(1) + Id(2) + Id<int>(3));', ['6'], { 'Program.Id': [['int']] }),
  generic('CS-GEN-008', 'static U Second<T, U>(T a, U b) { return b; }', 'Console.WriteLine(Second<int, string>(7, "second")); Console.WriteLine(Second(false, 8));', ['second', '8'], { 'Program.Second': [['bool', 'int'], ['int', 'string']] }),
  negative('CS-NEG-001', '8.3; 10.2', 'int n = true;', "Cannot use 'bool'"),
  negative('CS-NEG-002', '9.4', 'int n; Console.WriteLine(n);', 'unassigned local'),
  negative('CS-NEG-003', '9.4', 'int n; bool b = false; if (b) n = 1; Console.WriteLine(n);', 'unassigned local'),
  negative('CS-NEG-004', '9.4', 'int n; while (false) n = 1; Console.WriteLine(n);', 'unassigned local'),
  negative('CS-NEG-005', '7.7', 'int n = 1; { int n = 2; }', 'Duplicate or shadowed'),
  negative('CS-NEG-006', '7.7', '{ int n = 1; } Console.WriteLine(n);', 'Unknown local'),
  negative('CS-NEG-007', '13.8.2', 'if (1) Console.WriteLine(1);', "'bool' is required"),
  negative('CS-NEG-008', '12.14', 'bool b = true && 1;', "'bool' is required"),
  negative('CS-NEG-009', '12.23', 'int n = 2147483647 + 1;', 'Constant Int32 expression overflows'),
  negative('CS-NEG-010', '12.10.3', 'int n = 4 / 0;', 'Constant division by zero'),
  negative('CS-NEG-011', '13.10.2', 'break;', 'enclosing loop'),
  negative('CS-NEG-012', '13.10.5', 'return 1;', 'void method'),
  negative('CS-NEG-013', '13.7', '1 + 2;', 'permitted as statements'),
  negative('CS-NEG-014', '6.3.3', '/* missing terminator', 'Unterminated block comment'),
  negative('CS-NEG-015', '6.4.5.6', String.raw`string x = "\z";`, 'Unsupported string escape'),
  {
    id: 'CS-NEG-016', clause: '15.6.11', suite: 'negative', kind: 'negative',
    source: 'class P { static int F(bool b) { if (b) return 1; } static void Main() {} }',
    diagnostic: 'Not all code paths'
  },
  {
    id: 'CS-NEG-017', clause: '12.6.3', suite: 'generics', kind: 'negative',
    source: 'class P { static T Id<T>(T x) { return x; } static void Main() { Id<string>(1); } }',
    diagnostic: "Cannot use 'int'"
  },
  {
    id: 'CS-NEG-018', clause: '12.6.3', suite: 'generics', kind: 'negative',
    source: 'class P { static T First<T>(T x, T y) { return x; } static void Main() { First(1, "x"); } }',
    diagnostic: 'Conflicting inferred'
  },
  {
    id: 'CS-NEG-019', clause: '8.5; 15.6', suite: 'generics', kind: 'negative',
    source: 'class P { static T Bad<T>(T x) { return x + x; } static void Main() {} }',
    diagnostic: "'int' is required"
  },
  {
    id: 'CS-NEG-020', clause: '12.6.3', suite: 'generics', kind: 'negative',
    source: 'class P { static void F<T>() {} static void Main() { F(); } }',
    diagnostic: 'Cannot infer type argument'
  },
  {
    id: 'CS-NEG-021', clause: '8.4.2; 15.6', suite: 'generics', kind: 'negative',
    source: 'class P { static T Id<T>(T x) { return x; } static void Main() { Id<int, bool>(1); } }',
    diagnostic: 'requires 1 type argument'
  },
  {
    id: 'CS-NEG-022', clause: '12.6.2', suite: 'generics', kind: 'negative',
    source: 'class P { static T Id<T>(T x) { return x; } static void Main() { Id(System.Console.WriteLine(1)); } }',
    diagnostic: 'void invocation cannot'
  },
  ...[
    ['CS-RUN-001', 'int n = 0; Console.WriteLine(1 / n);', 'System.DivideByZeroException'],
    ['CS-RUN-002', 'int n = 0; Console.WriteLine(1 % n);', 'System.DivideByZeroException'],
    ['CS-RUN-003', 'int a = -2147483648, b = -1; Console.WriteLine(a / b);', 'System.OverflowException']
  ].map(([id, body, diagnostic]) => ({
    id, clause: '12.10.3; 12.10.4', suite: 'runtime', kind: 'runtime-error', source: program(body), diagnostic, errorName: 'RangeError'
  })),
  unsupported('CS-UNSUPPORTED-001', '8.3.7', program('double n = 1.5;'), 'Supported types|Unsupported'),
  unsupported('CS-UNSUPPORTED-002', '17', program('int[] values = new int[3];'), 'Expected an identifier'),
  unsupported('CS-UNSUPPORTED-003', '15', 'class Box<T> {} class P { static void Main() {} }', "Expected '\\{'"),
  unsupported('CS-UNSUPPORTED-004', '15.2.5', 'class P { static T F<T>(T x) where T : class { return x; } static void Main() {} }', "Expected '\\{'"),
  unsupported('CS-UNSUPPORTED-005', '15.6.1', 'class P { static int F(int x) { return x; } static string F(string x) { return x; } static void Main() {} }', 'overloading'),
  unsupported('CS-UNSUPPORTED-006', '13.11', program('try {} catch {}'), 'Unsupported'),
  unsupported('CS-UNSUPPORTED-007', '13.9.5', program('foreach (int n in values) {}'), 'Unsupported'),
  unsupported('CS-UNSUPPORTED-008', '15.5', 'class P { static int value; static void Main() {} }', "Expected '\\('"),
  unsupported('CS-UNSUPPORTED-009', '12.8.9', program('int n = int.Parse("1");'), 'Unsupported'),
  unsupported('CS-UNSUPPORTED-010', '12.8.19', program('int n = 1; Console.WriteLine(checked(n + 1));'), 'Unsupported'),
  unsupported('CS-UNSUPPORTED-011', '6.5', '#define FEATURE\nclass P { static void Main() {} }', 'Unsupported character'),
  unsupported('CS-UNSUPPORTED-012', '8.2.4; 15.11', 'class P { public P() {} static void Main() {} }', 'Only static methods')
];
