const program = body => `using System;\nclass Program {\nstatic void Main() {\n${body}\n}\n}\n`;
const positive = (id, body, stdout) => ({
  id, clause: '10.2.1; 12.8.19; 13.12', feature: 'numeric', suite: 'numeric',
  kind: 'positive', source: program(body), stdout
});
const negative = (id, body, diagnostic) => ({
  ...positive(id, body, []), kind: 'negative', diagnostic
});

export const NUMERIC_CASES = [
  positive('CS-NUM-001', 'int n = 21; Console.WriteLine((int)n * 2); Console.WriteLine((bool)true); Console.WriteLine((string)"001");', ['42', 'True', '001']),
  positive('CS-NUM-002', 'int n = 4; Console.WriteLine((int)-n); Console.WriteLine((int)+n); Console.WriteLine((int)(n + 1));', ['-4', '4', '5']),
  positive('CS-NUM-003', 'int n = 2147483646; checked { Console.WriteLine(n + 1); Console.WriteLine(n - 1); Console.WriteLine(n * 1); }', ['2147483647', '2147483645', '2147483646']),
  positive('CS-NUM-004', 'int n = 2147483647; checked { Console.WriteLine(unchecked(n + 1)); unchecked { n++; } Console.WriteLine(n); }', ['-2147483648', '-2147483648']),
  positive('CS-NUM-005', 'unchecked { Console.WriteLine(checked(2147483646 + 1)); Console.WriteLine(2147483647 + 1); }', ['2147483647', '-2147483648']),
  positive('CS-NUM-006', 'int n = 2147483647; Console.WriteLine(checked(unchecked(n + 1) + 1));', ['-2147483647']),
  positive('CS-NUM-007', 'checked { Console.WriteLine(unchecked(2147483647 + 1)); }', ['-2147483648']),
  positive('CS-NUM-008', 'int n = 1; checked { Console.WriteLine(n++); Console.WriteLine(++n); Console.WriteLine(n--); Console.WriteLine(--n); }', ['1', '3', '3', '1']),
  positive('CS-NUM-009', 'int n = 10; checked { n += 2; n *= 3; n -= 4; n /= 2; n %= 7; } Console.WriteLine(n);', ['2']),
  positive('CS-NUM-010', 'int n = 2147483647; checked { Console.WriteLine(n); } Console.WriteLine(n + 1);', ['2147483647', '-2147483648']),
  positive('CS-NUM-011', 'int n = -2147483648; checked { Console.WriteLine(-0); Console.WriteLine(n % 1); Console.WriteLine((int)n); }', ['0', '0', '-2147483648']),
  positive('CS-NUM-012', 'int n = 2147483647; Console.WriteLine(checked(false && ++n == 0)); Console.WriteLine(checked(true || ++n == 0)); Console.WriteLine(n);', ['False', 'True', '2147483647']),
  {
    ...positive('CS-NUM-013', '', ['-2147483648']),
    source: 'using System; class Program { static int Wrap(int n) { return n + 1; } static void Main() { Console.WriteLine(checked(Wrap(2147483647))); } }'
  },
  {
    ...positive('CS-NUM-014', '', ['2147483647']),
    source: 'using System; class Program { static T Id<T>(T n) { checked { return n; } } static void Main() { Console.WriteLine(Id(2147483647)); } }'
  },
  negative('CS-NUM-015', 'Console.WriteLine(checked(2147483647 + 1));', 'Constant Int32 expression overflows'),
  negative('CS-NUM-016', 'unchecked { Console.WriteLine(checked(-(-2147483648))); }', 'Constant Int32 expression overflows'),
  negative('CS-NUM-017', 'checked { int n = 65536 * 65536; }', 'Constant Int32 expression overflows'),
  negative('CS-NUM-018', 'Console.WriteLine((int)true);', "Unsupported explicit conversion from 'bool' to 'int'"),
  negative('CS-NUM-019', 'Console.WriteLine((bool)1);', "Unsupported explicit conversion from 'int' to 'bool'"),
  negative('CS-NUM-020', 'Console.WriteLine((string)1);', "Unsupported explicit conversion from 'int' to 'string'"),
  negative('CS-NUM-021', 'Console.WriteLine((int)"1");', "Unsupported explicit conversion from 'string' to 'int'"),
  ...[
    ['022', 'int n = 2147483647; Console.WriteLine(checked(n + 1));'],
    ['023', 'int n = -2147483648; checked { Console.WriteLine(n - 1); }'],
    ['024', 'int n = 65536; checked { Console.WriteLine(n * n); }'],
    ['025', 'int n = -2147483648; Console.WriteLine(checked(-n));'],
    ['026', 'int n = 2147483647; checked { n++; }'],
    ['027', 'int n = 2147483647; Console.WriteLine(checked(++n));'],
    ['028', 'int n = -2147483648; checked { n--; }'],
    ['029', 'int n = -2147483648; Console.WriteLine(checked(--n));'],
    ['030', 'int n = 2147483647; checked { n += 1; }'],
    ['031', 'int n = -2147483648; checked { n -= 1; }'],
    ['032', 'int n = 65536; checked { n *= n; }'],
    ['033', 'int n = 2147483647; unchecked { Console.WriteLine(checked(n + 1)); }'],
    ['034', 'int n = -2147483648, divisor = -1; checked { Console.WriteLine(n % divisor); }'],
    ['035', 'int n = -2147483648, divisor = -1; unchecked { Console.WriteLine(n % divisor); }'],
    ['036', 'int n = -2147483648; checked { n %= -1; }'],
  ].map(([suffix, body]) => ({
    ...positive(`CS-NUM-${suffix}`, body, []), suite: 'runtime', kind: 'runtime-error',
    diagnostic: 'System\\.OverflowException', errorName: 'RangeError'
  })),
  positive('CS-NUM-037', 'Console.WriteLine(unchecked(-2147483648 % -1));', ['0']),
  positive('CS-NUM-038', 'Console.WriteLine(checked(-2147483648 % -1));', ['0'])
];
