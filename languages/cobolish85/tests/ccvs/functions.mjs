import { ccvsCase } from './builder.mjs';

const fn = (id, ccvs, description, build) => ccvsCase('IF', id, ccvs, description, build);

export const functionCases = [
  fn('IF-TRIG-01', ['IF101A', 'IF102A', 'IF103A', 'IF104A', 'IF105A', 'IF106A'], 'ACOS, ASIN, ATAN, COS, SIN and TAN', k => ({
    ws: '01 R PIC S9V9(8).\n01 PI-VAL PIC S9V9(8).',
    proc: `COMPUTE PI-VAL = FUNCTION ACOS(-1)
${k('acos', 'PI-VAL > 3.14159 AND PI-VAL < 3.14160')}
COMPUTE R = FUNCTION ASIN(1) * 2
${k('asin', 'R > 3.14159 AND R < 3.14160')}
COMPUTE R = FUNCTION ATAN(1) * 4
${k('atan', 'R > 3.14159 AND R < 3.14160')}
COMPUTE R = FUNCTION COS(0)
${k('cos', 'R = 1')}
COMPUTE R = FUNCTION SIN(PI-VAL / 2)
${k('sin', 'R > 0.99999 AND R < 1.00001')}
COMPUTE R = FUNCTION TAN(PI-VAL / 4)
${k('tan', 'R > 0.99999 AND R < 1.00001')}`
  })),

  fn('IF-LOG-SQRT-01', ['IF107A', 'IF108A', 'IF109A', 'IF110A'], 'LOG, LOG10, SQRT and FACTORIAL', k => ({
    ws: '01 R PIC S9(4)V9(6).\n01 N PIC 9(6).',
    proc: `COMPUTE R = FUNCTION LOG(10)
${k('log', 'R > 2.302584 AND R < 2.302586')}
COMPUTE R = FUNCTION LOG10(1000)
${k('log10', 'R = 3')}
COMPUTE R = FUNCTION SQRT(16)
${k('sqrt-exact', 'R = 4')}
COMPUTE R = FUNCTION SQRT(2)
${k('sqrt', 'R = 1.414213')}
COMPUTE N = FUNCTION FACTORIAL(5)
${k('factorial', 'N = 120')}
COMPUTE N = FUNCTION FACTORIAL(0)
${k('factorial-zero', 'N = 1')}`
  })),

  fn('IF-INTEGER-01', ['IF111A', 'IF112A', 'IF113A', 'IF114A'], 'INTEGER, INTEGER-PART, MOD and REM with negative arguments', k => ({
    ws: '01 R PIC S9(4)V99.',
    proc: `COMPUTE R = FUNCTION INTEGER(-1.5)
${k('integer', 'R = -2')}
COMPUTE R = FUNCTION INTEGER-PART(-1.5)
${k('integer-part', 'R = -1')}
COMPUTE R = FUNCTION MOD(-11 5)
${k('mod', 'R = 4')}
COMPUTE R = FUNCTION MOD(11 -5)
${k('mod-negative-divisor', 'R = -4')}
COMPUTE R = FUNCTION REM(-11 5)
${k('rem', 'R = -1')}
COMPUTE R = FUNCTION REM(7.5 2)
${k('rem-fraction', 'R = 1.5')}`
  })),

  fn('IF-STATS-01', ['IF115A', 'IF116A', 'IF117A', 'IF118A', 'IF119A', 'IF120A'], 'MAX, MIN, MEAN, MEDIAN, MIDRANGE, RANGE, SUM, VARIANCE, STANDARD-DEVIATION, ORD-MAX and ORD-MIN', k => ({
    ws: `01 R PIC S9(4)V9(4).
01 VALS.
   05 V PIC 9 OCCURS 8 TIMES.`,
    proc: `MOVE "24445579" TO VALS
COMPUTE R = FUNCTION MAX(3 9 2)
${k('max', 'R = 9')}
COMPUTE R = FUNCTION MIN(3 9 2)
${k('min', 'R = 2')}
COMPUTE R = FUNCTION MEAN(V(1) V(2) V(3) V(4) V(5) V(6) V(7) V(8))
${k('mean', 'R = 5')}
COMPUTE R = FUNCTION MEDIAN(V(1) V(2) V(3) V(4) V(5) V(6) V(7) V(8))
${k('median', 'R = 4.5')}
COMPUTE R = FUNCTION MIDRANGE(V(1) V(2) V(3) V(4) V(5) V(6) V(7) V(8))
${k('midrange', 'R = 5.5')}
COMPUTE R = FUNCTION RANGE(V(1) V(2) V(3) V(4) V(5) V(6) V(7) V(8))
${k('range', 'R = 7')}
COMPUTE R = FUNCTION SUM(V(ALL))
${k('sum-all-subscript', 'R = 40')}
COMPUTE R = FUNCTION VARIANCE(V(ALL))
${k('variance', 'R = 4')}
COMPUTE R = FUNCTION STANDARD-DEVIATION(V(ALL))
${k('standard-deviation', 'R = 2')}
COMPUTE R = FUNCTION ORD-MAX(3 9 2)
${k('ord-max', 'R = 2')}
COMPUTE R = FUNCTION ORD-MIN(3 9 2)
${k('ord-min', 'R = 3')}`
  })),

  fn('IF-ALPHA-01', ['IF121A', 'IF122A', 'IF123A', 'IF124A'], 'UPPER-CASE, LOWER-CASE, REVERSE, LENGTH and alphanumeric MAX/MIN', k => ({
    ws: '01 S PIC X(6) VALUE "AbCdEf".\n01 T PIC X(6).\n01 N PIC 99.',
    proc: `MOVE FUNCTION UPPER-CASE(S) TO T
${k('upper-case', 'T = "ABCDEF"')}
MOVE FUNCTION LOWER-CASE(S) TO T
${k('lower-case', 'T = "abcdef"')}
MOVE FUNCTION REVERSE("ABC") TO T
${k('reverse', 'T = "CBA"')}
COMPUTE N = FUNCTION LENGTH(S)
${k('length-item', 'N = 6')}
COMPUTE N = FUNCTION LENGTH("ABC")
${k('length-literal', 'N = 3')}
MOVE FUNCTION MAX("PEAR" "APPLE" "PLUM") TO T
${k('max-alpha', 'T = "PLUM"')}
MOVE FUNCTION MIN("PEAR" "APPLE" "PLUM") TO T
${k('min-alpha', 'T = "APPLE"')}`
  })),

  fn('IF-CHAR-ORD-01', ['IF125A', 'IF126A'], 'CHAR and ORD use ordinal positions (one greater than the code point)', k => ({
    ws: '01 C PIC X.\n01 N PIC 999.',
    proc: `MOVE FUNCTION CHAR(66) TO C
${k('char', 'C = "A"')}
COMPUTE N = FUNCTION ORD("A")
${k('ord', 'N = 66')}
COMPUTE N = FUNCTION ORD(FUNCTION CHAR(98))
${k('round-trip', 'N = 98')}`
  })),

  fn('IF-NUMVAL-01', ['IF127A', 'IF128A', 'IF129A'], 'NUMVAL and NUMVAL-C convert edited text to numbers', k => ({
    ws: '01 R PIC S9(6)V99.',
    proc: `COMPUTE R = FUNCTION NUMVAL(" -12.5 ")
${k('numval-leading-sign', 'R = -12.5')}
COMPUTE R = FUNCTION NUMVAL("3.25-")
${k('numval-trailing-sign', 'R = -3.25')}
COMPUTE R = FUNCTION NUMVAL("42")
${k('numval-integer', 'R = 42')}
COMPUTE R = FUNCTION NUMVAL-C("$1,234.50CR")
${k('numval-c-credit', 'R = -1234.5')}
COMPUTE R = FUNCTION NUMVAL-C(" $ 99.99 ")
${k('numval-c', 'R = 99.99')}
COMPUTE R = FUNCTION NUMVAL-C("£12.50", "£")
${k('numval-c-currency-argument', 'R = 12.5')}`
  })),

  fn('IF-DATES-01', ['IF130A', 'IF131A', 'IF132A', 'IF133A'], 'INTEGER-OF-DATE, DATE-OF-INTEGER, INTEGER-OF-DAY and DAY-OF-INTEGER', k => ({
    ws: '01 N PIC 9(8).',
    proc: `COMPUTE N = FUNCTION INTEGER-OF-DATE(20000101)
${k('integer-of-date', 'N = 145732')}
COMPUTE N = FUNCTION INTEGER-OF-DATE(16010101)
${k('integer-of-date-epoch', 'N = 1')}
COMPUTE N = FUNCTION DATE-OF-INTEGER(150000)
${k('date-of-integer', 'N = 20110908')}
COMPUTE N = FUNCTION DATE-OF-INTEGER(1)
${k('date-of-integer-epoch', 'N = 16010101')}
COMPUTE N = FUNCTION INTEGER-OF-DAY(2000001)
${k('integer-of-day', 'N = 145732')}
COMPUTE N = FUNCTION DAY-OF-INTEGER(145732)
${k('day-of-integer', 'N = 2000001')}
COMPUTE N = FUNCTION DATE-OF-INTEGER(FUNCTION INTEGER-OF-DATE(19991231) + 1)
${k('date-arithmetic', 'N = 20000101')}`
  })),

  fn('IF-FINANCE-01', ['IF134A', 'IF135A'], 'ANNUITY and PRESENT-VALUE', k => ({
    ws: `01 R PIC S9(4)V9(6).
01 PAYMENTS.
   05 PAYMENT PIC 9(3) OCCURS 2 TIMES.`,
    proc: `COMPUTE R = FUNCTION ANNUITY(0 4)
${k('annuity-zero-rate', 'R = 0.25')}
COMPUTE R = FUNCTION ANNUITY(0.1 2)
${k('annuity', 'R = 0.576190')}
COMPUTE R = FUNCTION PRESENT-VALUE(110 0.1)
${k('present-value', 'R = 100')}
COMPUTE R = FUNCTION PRESENT-VALUE(10 20 0)
${k('present-value-zero-rate', 'R = 30')}
MOVE "110000" TO PAYMENTS
COMPUTE R = FUNCTION PRESENT-VALUE(PAYMENT(ALL) 0.1)
${k('present-value-table', 'R = 100')}`
  })),

  fn('IF-RANDOM-01', ['IF136A', 'IF137A'], 'RANDOM returns values in [0, 1) and the same seed reproduces the sequence', k => ({
    ws: '01 R1 PIC 9V9(8).\n01 R2 PIC 9V9(8).\n01 R3 PIC 9V9(8).',
    proc: `COMPUTE R1 = FUNCTION RANDOM(7)
COMPUTE R3 = FUNCTION RANDOM
COMPUTE R2 = FUNCTION RANDOM(7)
${k('range', 'R1 >= 0 AND R1 < 1 AND R3 >= 0 AND R3 < 1')}
${k('seeded-repeatable', 'R1 = R2')}`
  })),

  fn('IF-CLOCK-01', ['IF138A', 'IF139A'], 'CURRENT-DATE and WHEN-COMPILED return 21-character date/time values', k => ({
    ws: `01 CD.
   05 CD-YEAR PIC 9(4).
   05 CD-MONTH PIC 99.
   05 CD-DAY PIC 99.
   05 CD-TIME PIC 9(8).
   05 CD-SIGN PIC X.
   05 CD-OFFSET PIC 9(4).
01 WC PIC X(21).
01 N PIC 99.`,
    proc: `MOVE FUNCTION CURRENT-DATE TO CD
${k('current-date-fields', 'CD-YEAR > 1600 AND CD-MONTH >= 1 AND CD-MONTH <= 12 AND CD-DAY >= 1 AND CD-DAY <= 31')}
${k('current-date-offset', 'CD-SIGN = "+" OR CD-SIGN = "-" OR CD-SIGN = "0"')}
COMPUTE N = FUNCTION LENGTH(FUNCTION CURRENT-DATE)
${k('current-date-length', 'N = 21')}
MOVE FUNCTION WHEN-COMPILED TO WC
${k('when-compiled', 'WC(1:8) IS NUMERIC AND WC(9:8) IS NUMERIC')}`
  }))
];
