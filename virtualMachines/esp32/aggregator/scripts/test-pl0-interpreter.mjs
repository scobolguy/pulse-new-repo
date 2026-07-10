/**
 * PL/0 Interpreter - Test Suite & Examples
 * Demonstrates various features and transformation capabilities
 */

import { runPL0 } from './pl0-interpreter.mjs';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, code, input, expected) {
  totalTests += 1;
  console.log(`\n✓ Test: ${name}`);
  console.log(`  Code: ${code}`);
  console.log(`  Input: ${JSON.stringify(input)}`);
  try {
    const result = runPL0(code, input);
    const output = result.output;
    console.log(`  Output: ${JSON.stringify(output)}`);
    if (expected !== undefined && output !== expected) {
      console.warn(`  ⚠️  Expected: ${JSON.stringify(expected)}`);
      failedTests += 1;
      return;
    }
    passedTests += 1;
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
    failedTests += 1;
  }
}

function testBatch(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(60)}`);
}

// Basic operations
testBatch('STRING OPERATIONS');
test('Simple trim', 'output := trim(src);', { src: '  hello  ' }, 'hello');
test('Case conversion', 'output := upper(src);', { src: 'hello' }, 'HELLO');
test('Lowercase', 'output := lower(src);', { src: 'HELLO' }, 'hello');
test('String concatenation', 'output := src || " world";', { src: 'hello' }, 'hello world');
test('String length', 'output := length(src);', { src: 'hello' }, 5);
test('Substring', 'output := substr(src, 2, 3);', { src: 'hello' }, 'ell');

testBatch('NUMERIC OPERATIONS');
test('Addition', 'output := 5 + 3;', {}, 8);
test('Subtraction', 'output := 10 - 3;', {}, 7);
test('Multiplication', 'output := 4 * 5;', {}, 20);
test('Division', 'output := 20 / 4;', {}, 5);
test('Absolute value', 'output := abs(-5);', {}, 5);
test('Min function', 'output := min(3, 1, 4, 1, 5);', {}, 1);
test('Max function', 'output := max(3, 1, 4, 1, 5);', {}, 5);

testBatch('COMPARISON & LOGIC');
test('Equality', 'output := 5 = 5;', {}, 1);
test('Inequality', 'output := 5 <> 3;', {}, 1);
test('Less than', 'output := 3 < 5;', {}, 1);
test('Greater than', 'output := 5 > 3;', {}, 1);
test('NOT operator', 'output := NOT 0;', {}, 1);

testBatch('CONDITIONAL STATEMENTS');
test('IF-THEN', 
  'IF length(src) > 0 THEN output := "yes" ELSE output := "no"',
  { src: 'hello' }, 
  'yes'
);
test('IF-ELSE branch', 
  'IF length(src) = 0 THEN output := "empty" ELSE output := "has content"',
  { src: '' }, 
  'empty'
);

testBatch('LOOPS');
test('WHILE loop', 
  `BEGIN
    VAR i;
    VAR result;
    i := 1;
    result := "";
    WHILE i <= 3 DO BEGIN
      result := result || i;
      i := i + 1
    END;
    output := result
  END`,
  {},
  '123'
);

test('FOR loop', 
  `BEGIN
    VAR result;
    result := "";
    FOR i := 1 TO 3 DO result := result || i;
    output := result
  END`,
  {},
  '123'
);

testBatch('BLOCK STATEMENTS');
test('Multiple assignments', 
  `BEGIN
    x := 10;
    y := 20;
    output := x + y
  END`,
  {},
  30
);

testBatch('MT/SWIFT TRANSFORMATIONS');
test('Date conversion', 
  'output := yymmddtoiso(src);',
  { src: '250512' },
  '2025-05-12'
);

test('Amount conversion', 
  'output := mtamounttodecimal(src);',
  { src: '12345,67' },
  '12345.67'
);

test('Party name extraction', 
  'output := mtpartyname(src);',
  { src: '/DE89370400440532013000\nJOHN DOE\nSOMEWHERE' },
  'JOHN DOE'
);

test('Charge bearer code', 
  'output := mtchargebearertoiso(src);',
  { src: 'OUR' },
  'DEBT'
);

testBatch('COMPLEX TRANSFORMATIONS');
test('Conditional trimming',
  `IF length(trim(src)) > 0 THEN 
    output := trim(src) 
   ELSE 
    output := "N/A"`,
  { src: '  hello  ' },
  'hello'
);

test('Multi-step string processing',
  `BEGIN
    VAR trimmed;
    VAR length_check;
    trimmed := trim(src);
    length_check := length(trimmed);
    IF length_check > 50 THEN
      output := substr(trimmed, 1, 47) || "..."
    ELSE
      output := trimmed
  END`,
  { src: '  This is a very long string that needs to be truncated properly  ' },
  'This is a very long string that needs to be ...'
);

test('Date and amount combined',
  `output := "Date: " || yymmddtoiso(date_field) || " | Amount: " || mtamounttodecimal(amount_field);`,
  { date_field: '250512', amount_field: '1000,50' },
  'Date: 2025-05-12 | Amount: 1000.50'
);

test('String manipulation chain',
  `BEGIN
    VAR step1;
    VAR step2;
    step1 := upper(src);
    step2 := reverse(step1);
    output := step2
  END`,
  { src: 'hello' },
  'OLLEH'
);

testBatch('PADDING & FORMAT');
test('Pad left with zeros',
  'output := padleft(src, 5, "0");',
  { src: '42' },
  '00042'
);

test('Pad right',
  'output := padright(src, 5, " ");',
  { src: 'hi' },
  'hi   '
);

testBatch('STRING SEARCH & REPLACE');
test('Index/position',
  'output := index(src, "world");',
  { src: 'hello world' },
  7
);

test('Replace all',
  'output := replace(src, "l", "L");',
  { src: 'hello' },
  'heLLo'
);

test('Starts with check',
  'output := startswith(src, "SWIFT");',
  { src: 'SWIFTREF123' },
  1
);

test('Ends with check',
  'output := endswith(src, ".xml");',
  { src: 'message.xml' },
  1
);

testBatch('ADVANCED EXAMPLES');

// Real-world example: IBAN validation and extraction
test('IBAN country extraction',
  `BEGIN
    VAR iban;
    iban := trim(src);
    IF length(iban) >= 2 THEN
      output := substr(iban, 1, 2)
    ELSE
      output := "XX"
    END
  END`,
  { src: '  DE89370400440532013000  ' },
  'DE'
);

// Real-world example: Transaction amount formatting
test('Amount with currency',
  `BEGIN
    VAR amount;
    VAR currency;
    amount := mtamounttodecimal(amt);
    currency := upper(curr);
    output := amount || " " || currency
  END`,
  { amt: '9999,99', curr: 'eur' },
  '9999.99 EUR'
);

// Real-world example: Name formatting from MT field
test('Full name from split fields',
  `BEGIN
    VAR first;
    VAR last;
    first := upper(trim(fn));
    last := upper(trim(ln));
    output := last || ", " || first
  END`,
  { fn: 'john', ln: 'smith' },
  'SMITH, JOHN'
);

testBatch('ERROR HANDLING');
test('Division by zero protection',
  `IF n2 = 0 THEN output := "ERROR" ELSE output := n1 / n2`,
  { n1: 10, n2: 0 },
  'ERROR'
);

test('Empty string handling',
  `IF length(trim(src)) = 0 THEN output := "EMPTY" ELSE output := src`,
  { src: '   ' },
  'EMPTY'
);

console.log(`\n${'='.repeat(60)}`);
console.log('Test Suite Complete');
console.log(`${'='.repeat(60)}\n`);
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Failed: ${failedTests}/${totalTests}`);

if (failedTests > 0) {
  process.exitCode = 1;
}
