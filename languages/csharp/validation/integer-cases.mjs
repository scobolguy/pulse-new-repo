const program = body => `using System;\nclass Program {\nstatic void Main() {\n${body}\n}\n}\n`;
const positive = (id, body, stdout) => ({
  id, clause: '8.3.6; 10.2.3; 10.3.2; 12.4.7; 12.6.4', feature: 'integers',
  suite: 'integers', kind: 'positive', source: program(body), stdout
});
const negative = (id, body, diagnostic) => ({ ...positive(id, body, []), kind: 'negative', diagnostic });
const runtime = (id, body) => ({
  ...positive(id, body, []), suite: 'runtime', kind: 'runtime-error',
  diagnostic: 'System\\.OverflowException', errorName: 'RangeError'
});
const widths = [['sbyte', -128, 127], ['byte', 0, 255], ['short', -32768, 32767], ['ushort', 0, 65535]];

export const INTEGER_CASES = [
  ...widths.flatMap(([type, min, max], index) => [
    positive(`CS-WIDTH-${String(index * 5 + 1).padStart(3, '0')}`,
      `${type} a = ${min}, b = ${max}; int n = b; Console.WriteLine(a); Console.WriteLine(b); Console.WriteLine(n); Console.WriteLine(b + 1);`,
      [String(min), String(max), String(max), String(max + 1)]),
    positive(`CS-WIDTH-${String(index * 5 + 2).padStart(3, '0')}`,
      `${type} n = ${max}; Console.WriteLine(n++); Console.WriteLine(n); n = ${max}; n += 1; Console.WriteLine(n);`,
      [String(max), String(min), String(min)]),
    positive(`CS-WIDTH-${String(index * 5 + 3).padStart(3, '0')}`,
      `int n = ${max + 1}; Console.WriteLine(unchecked((${type})n)); Console.WriteLine(unchecked((${type})${max + 1}));`,
      [String(min), String(min)]),
    runtime(`CS-WIDTH-${String(index * 5 + 4).padStart(3, '0')}`,
      `int n = ${max + 1}; Console.WriteLine(checked((${type})n));`),
    negative(`CS-WIDTH-${String(index * 5 + 5).padStart(3, '0')}`,
      `${type} n = ${max + 1};`, `Cannot use 'int' where '${type}'`)
  ]),
  positive('CS-WIDTH-021', 'byte b=255; short s=b; ushort u=b; int i=u; Console.WriteLine(s); Console.WriteLine(i); Console.WriteLine(-u);', ['255', '255', '-255']),
  negative('CS-WIDTH-022', 'int i=1; byte b=i;', "Cannot use 'int' where 'byte'"),
  negative('CS-WIDTH-023', 'short s=1; ushort u=s;', "Cannot use 'short' where 'ushort'"),
  negative('CS-WIDTH-024', 'byte b=checked((byte)256);', 'Constant byte conversion overflows'),
  runtime('CS-WIDTH-025', 'byte b=255; checked { ++b; }'),
  runtime('CS-WIDTH-026', 'short s=-32768; checked { s--; }'),
  runtime('CS-WIDTH-027', 'ushort u=65535; checked { u+=1; }'),
  positive('CS-WIDTH-028', 'byte b=255; bool f=true; Console.WriteLine(f ? b : 1); Console.WriteLine("n="+b);', ['255', 'n=255']),
  {
    ...positive('CS-WIDTH-029', '', ['byte', 'short', 'int', 'identity']),
    source: `using System; class Program {
static string F(byte n) { return "byte"; } static string F(short n) { return "short"; } static string F(int n) { return "int"; }
static string G<T>(T n) { return "identity"; } static string G(int n) { return "widened"; }
static void Main() { byte b=1; short s=1; int i=1; Console.WriteLine(F(b)); Console.WriteLine(F(s)); Console.WriteLine(F(i)); Console.WriteLine(G(b)); } }`
  },
  {
    ...positive('CS-WIDTH-030', '', ['short']),
    source: 'using System; class P { static string F(short n){return "short";} static string F(int n){return "int";} static void Main(){byte b=1; Console.WriteLine(F(b));} }'
  },
  {
    ...positive('CS-WIDTH-031', '', ['signed']),
    source: 'using System; class P { static string F(short n){return "signed";} static string F(ushort n){return "unsigned";} static void Main(){byte b=1; Console.WriteLine(F(b));} }'
  },
  {
    ...positive('CS-WIDTH-032', '', ['65535', '127']),
    source: 'using System; class P { static T Id<T>(T n){return n;} static void Main(){ushort u=65535; sbyte s=127; Console.WriteLine(Id(u)); Console.WriteLine(Id(s));} }'
  },
  {
    ...negative('CS-WIDTH-033', '', 'Ambiguous invocation'),
    source: 'class P { static void F(short a,int b){} static void F(int a,short b){} static void Main(){byte b=1; F(b,b);} }'
  },
  {
    ...positive('CS-WIDTH-034', '', ['255']),
    source: 'using System; class P { static byte F(byte n){return n;} static void Main(){Console.WriteLine(F(255));} }'
  }
];
