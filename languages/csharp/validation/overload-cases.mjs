const source = (methods, body = '') => `using System; class P { ${methods}
static void Main() { ${body} } }`;
const positive = (id, methods, body, stdout) => ({
  id: `CS-OVER-${id}`, clause: '12.6.4; 15.6', suite: 'overloads', kind: 'positive',
  source: source(methods, body), stdout,
});
const negative = (id, methods, body, diagnostic) => ({
  id: `CS-OVERNEG-${id}`, clause: '12.6.4; 15.6', suite: 'overloads', kind: 'negative',
  source: source(methods, body), diagnostic,
});

export const OVERLOAD_CASES = [
  positive('001', `static string F(int x) { return "int"; }
static string F(bool x) { return "bool"; } static string F(string x) { return "string"; }`,
  'Console.WriteLine(F(1)); Console.WriteLine(F(true)); Console.WriteLine(F("x"));', ['int', 'bool', 'string']),
  positive('002', `static int F() { return 0; } static int F(int x) { return x; }
static int F(int x, int y) { return x + y; }`,
  'Console.WriteLine(F()); Console.WriteLine(F(2)); Console.WriteLine(F(3,4));', ['0', '2', '7']),
  positive('003', `static string F(int x) { return "concrete"; }
static string F<T>(T x) { return "generic"; }`,
  'Console.WriteLine(F(1)); Console.WriteLine(F<int>(1)); Console.WriteLine(F(true));', ['concrete', 'generic', 'generic']),
  positive('004', `static string F<T>(T x, int y) { return "specific"; }
static string F<T>(T x, T y) { return "general"; }`,
  'Console.WriteLine(F(1,2)); Console.WriteLine(F(true,2));', ['specific', 'specific']),
  positive('005', `static string F<T>(T x, T y) { return "generic"; }
static string F(string x, int y) { return "concrete"; }`,
  'Console.WriteLine(F("x",1));', ['concrete']),
  positive('006', `static T F<T>(T x) { return x; }
static T F<T>(T x, bool ignored) { return F(x); }`,
  'Console.WriteLine(F(7)); Console.WriteLine(F(8,true)); Console.WriteLine(F("s",false));', ['7', '8', 's']),
  positive('007', `static string F<T>(T x) { return "one"; }
static string F<T,U>(T x) { return "two"; }`,
  'Console.WriteLine(F(1)); Console.WriteLine(F<int>(1)); Console.WriteLine(F<int,bool>(1));', ['one', 'one', 'two']),
  positive('008', `static string F(int x) { return "concrete"; }
static string F<T>(T x) { return "generic"; }
static string G<T>(T x) { return F(x); }`,
  'Console.WriteLine(G(1)); Console.WriteLine(F(1));', ['generic', 'concrete']),
  positive('009', 'static int Main(int x) { return x + 1; }',
    'Console.WriteLine(Main(41));', ['42']),
  positive('010', `static int F(int n) { if (n == 0) return 1; return n * F(n-1); }
static string F(string s) { return s; }`,
  'Console.WriteLine(F(5)); Console.WriteLine(F("done"));', ['120', 'done']),
  positive('011', `static int F(int x, int y) { return x * 10 + y; }
static string F(string x, string y) { return x + y; }`,
  'int n=1; Console.WriteLine(F(n++,n++)); Console.WriteLine(n);', ['12', '3']),
  positive('012', `static string F<T>(int x, T y) { return "specific"; }
static string F<T>(T x, T y) { return "general"; }`,
  'Console.WriteLine(F(1,2));', ['specific']),
  negative('001', 'static int F(int x) { return x; } static bool F(int y) { return true; }', '', 'Duplicate method signature'),
  negative('002', 'static T F<T>(T x) { return x; } static U F<U>(U y) { return y; }', '', 'Duplicate method signature'),
  negative('003', `static string F<T>(T x, int y) { return "a"; }
static string F<T>(int x, T y) { return "b"; }`, 'F(1,2);', 'Ambiguous invocation'),
  negative('004', 'static void F(int x) {} static void F(bool x) {}', 'F("s");', 'No applicable overload'),
  negative('005', 'static void F(int x) {} static void F(bool x) {}', 'F(1,2);', 'No applicable overload'),
  negative('006', 'static void F<T>(int x) {} static void F<U,V>(bool x) {}', 'F(1);', 'No applicable overload.*Cannot infer'),
  negative('007', `static string F<T,U>(T x, U y) { return "a"; }
static string F<T,U>(U x, T y) { return "b"; }`, 'F(1,2);', 'Ambiguous invocation'),
  negative('008', `static string F<T>(T x, int y) { return "a"; }
static string F<T>(int x, T y) { return "b"; }`, 'string s=F(1,2);', 'Ambiguous invocation'),
  negative('009', 'static void F(int x) {} static void F(bool x) {}', 'F<int>(1);', 'No applicable overload'),
];
