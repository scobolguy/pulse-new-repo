import { ccvsCase } from './builder.mjs';

const nc = (id, ccvs, description, build) => ccvsCase('NC', id, ccvs, description, build);

export const ncCases = [
  nc('NC-FIGCON-01', ['NC107A', 'NC215A', 'NC219A', 'NC250A'], 'Figurative constants ZERO/ZEROES, SPACE, QUOTE, HIGH-VALUE, LOW-VALUE and ALL literal', k => ({
    ws: `01 A3 PIC X(3).
01 N3 PIC 9(3) VALUE 5.
01 Q2 PIC X(2).
01 HV PIC X(2).
01 LV PIC X(2).
01 SP PIC X(2) VALUE "AB".`,
    proc: `MOVE ALL "AB" TO A3
${k('all-literal', 'A3 = "ABA"')}
MOVE ZEROES TO N3
${k('zeroes', 'N3 = ZERO AND N3 = ZEROS')}
MOVE QUOTES TO Q2
${k('quote', 'Q2 = QUOTE AND Q2 = """"""')}
MOVE HIGH-VALUES TO HV
MOVE LOW-VALUE TO LV
${k('high-low', 'HV = HIGH-VALUE AND LV = LOW-VALUES AND LV < HV')}
${k('high-collates-last', 'HV > "ZZ" AND LV < SPACES')}
MOVE SPACE TO SP
${k('space', 'SP = SPACES AND SP = "  "')}`
  })),

  nc('NC-DISPLAY-01', ['NC109M', 'NC204M'], 'DISPLAY of unsigned numeric DISPLAY items shows every digit position and no decimal point', () => ({
    ws: `01 A PIC 9(3) VALUE 42.
01 B PIC 9V99 VALUE 1.5.
01 X PIC X(3) VALUE "AB".`,
    proc: `DISPLAY A
DISPLAY B
DISPLAY A "/" B
DISPLAY "[" X "]" SPACE "END"`,
    expected: ['042', '150', '042/150', '[AB ] END']
  })),

  nc('NC-ACCEPT-01', ['NC109M', 'NC204M'], 'ACCEPT moves input data into an alphanumeric item', k => ({
    input: 'HELLO',
    ws: '01 X PIC X(5).',
    proc: `ACCEPT X
${k('accept', 'X = "HELLO"')}`
  })),

  nc('NC-ACCEPT-02', ['NC214M'], 'ACCEPT FROM DATE, DAY, TIME and DAY-OF-WEEK', k => ({
    ws: `01 D-GRP.
   05 D-YY PIC 99.
   05 D-MM PIC 99.
   05 D-DD PIC 99.
01 Y-GRP.
   05 Y-YY PIC 99.
   05 Y-DDD PIC 999.
01 T-GRP.
   05 T-HH PIC 99.
   05 T-MI PIC 99.
   05 T-SS PIC 99.
   05 T-CC PIC 99.
01 W PIC 9.`,
    proc: `ACCEPT D-GRP FROM DATE
ACCEPT Y-GRP FROM DAY
ACCEPT T-GRP FROM TIME
ACCEPT W FROM DAY-OF-WEEK
${k('date', 'D-MM >= 1 AND D-MM <= 12 AND D-DD >= 1 AND D-DD <= 31')}
${k('day', 'Y-DDD >= 1 AND Y-DDD <= 366 AND Y-YY = D-YY')}
${k('time', 'T-HH <= 23 AND T-MI <= 59 AND T-SS <= 59')}
${k('day-of-week', 'W >= 1 AND W <= 7')}`
  })),

  nc('NC-MULTIPLY-01', ['NC101A', 'NC120A', 'NC121M', 'NC170A'], 'MULTIPLY BY, GIVING, ROUNDED and ON SIZE ERROR', k => ({
    ws: `01 A PIC 99 VALUE 6.
01 B PIC 99 VALUE 7.
01 C PIC 999.
01 S PIC 9 VALUE 5.
01 F PIC X VALUE "N".`,
    proc: `MULTIPLY A BY B
${k('by', 'B = 42')}
MULTIPLY 2.5 BY 3 GIVING C ROUNDED
${k('giving-rounded', 'C = 8')}
MULTIPLY 3 BY S ON SIZE ERROR MOVE "Y" TO F END-MULTIPLY
${k('size-error', 'F = "Y" AND S = 5')}`
  })),

  nc('NC-DIVIDE-01', ['NC117A', 'NC171A', 'NC172A', 'NC173A', 'NC203A', 'NC220M'], 'DIVIDE INTO, BY GIVING, REMAINDER, ROUNDED and division by zero', k => ({
    ws: `01 A PIC 99 VALUE 20.
01 Q PIC 9.
01 R PIC 9.
01 G PIC 99.
01 H PIC 9.
01 F PIC X VALUE "N".`,
    proc: `DIVIDE 4 INTO A
${k('into', 'A = 5')}
DIVIDE 17 BY 5 GIVING Q REMAINDER R
${k('remainder', 'Q = 3 AND R = 2')}
DIVIDE A INTO 100 GIVING G
${k('into-giving', 'G = 20')}
DIVIDE 2 INTO 7 GIVING H ROUNDED
${k('rounded', 'H = 4')}
DIVIDE 0 INTO A ON SIZE ERROR MOVE "Y" TO F END-DIVIDE
${k('zero-divisor', 'F = "Y" AND A = 5')}`
  })),

  nc('NC-ADD-01', ['NC118A', 'NC123A', 'NC176A', 'NC177A'], 'ADD series TO, GIVING multiple receivers, ROUNDED and NOT ON SIZE ERROR', k => ({
    ws: `01 A PIC 9 VALUE 1.
01 B PIC 9 VALUE 2.
01 C PIC 99 VALUE 10.
01 D PIC 99 VALUE 20.
01 E PIC 9.
01 E2 PIC 9.
01 G PIC 9 VALUE 1.
01 S PIC 9 VALUE 7.
01 F PIC X VALUE "?".`,
    proc: `ADD A B TO C D
${k('series-to', 'C = 13 AND D = 23')}
ADD A B GIVING E E2
${k('giving-series', 'E = 3 AND E2 = 3')}
ADD 1.5 TO G ROUNDED
${k('rounded', 'G = 3')}
ADD 5 TO S ON SIZE ERROR MOVE "Y" TO F NOT ON SIZE ERROR MOVE "N" TO F END-ADD
${k('size-error', 'F = "Y" AND S = 7')}
ADD 1 TO S ON SIZE ERROR MOVE "Y" TO F NOT ON SIZE ERROR MOVE "N" TO F END-ADD
${k('not-size-error', 'F = "N" AND S = 8')}`
  })),

  nc('NC-SUBTRACT-01', ['NC106A', 'NC119A', 'NC175A', 'NC253A'], 'SUBTRACT series FROM, GIVING, unsigned receivers, ROUNDED and SIZE ERROR', k => ({
    ws: `01 A PIC 9 VALUE 1.
01 B PIC 9 VALUE 2.
01 C PIC 99 VALUE 10.
01 D PIC 99 VALUE 20.
01 E PIC 9.
01 U PIC 9 VALUE 0.
01 R PIC 9.
01 SS PIC S9 VALUE -9.
01 F PIC X VALUE "N".`,
    proc: `SUBTRACT A B FROM C D
${k('series-from', 'C = 7 AND D = 17')}
SUBTRACT 3 FROM 10 GIVING E
${k('giving', 'E = 7')}
SUBTRACT 1 FROM U
${k('unsigned-receiver-absolute', 'U = 1')}
SUBTRACT 2.5 FROM 10 GIVING R ROUNDED
${k('rounded', 'R = 8')}
SUBTRACT 1 FROM SS ON SIZE ERROR MOVE "Y" TO F END-SUBTRACT
${k('size-error', 'F = "Y" AND SS = -9')}`
  })),

  nc('NC-COMPUTE-01', ['NC252A', 'NC111A'], 'COMPUTE exponentiation, multiple receivers, truncation and ON SIZE ERROR', k => ({
    ws: `01 R PIC 99.
01 X PIC 99.
01 Y PIC 99.
01 T PIC 9V9.
01 I PIC 9.
01 S PIC 99 VALUE 11.
01 F PIC X VALUE "N".`,
    proc: `COMPUTE R = 2 ** 3 + 1
${k('exponent', 'R = 9')}
COMPUTE X Y = 5 * 2
${k('multiple-receivers', 'X = 10 AND Y = 10')}
COMPUTE T = 10 / 4
COMPUTE I = 10 / 4
${k('truncation', 'T = 2.5 AND I = 2')}
COMPUTE S = 50 * 3 ON SIZE ERROR MOVE "Y" TO F END-COMPUTE
${k('size-error', 'F = "Y" AND S = 11')}`
  })),

  nc('NC-CORR-01', ['NC202A', 'NC207A', 'NC208A', 'NC209A', 'NC222A'], 'ADD, MOVE and SUBTRACT CORRESPONDING', k => ({
    ws: `01 G1.
   05 A PIC 99 VALUE 1.
   05 B PIC 99 VALUE 2.
   05 C PIC X VALUE "C".
01 G2.
   05 B PIC 99 VALUE 10.
   05 A PIC 99 VALUE 20.
   05 D PIC 99 VALUE 30.
   05 C PIC X VALUE "Z".`,
    proc: `ADD CORRESPONDING G1 TO G2
${k('add-corr', 'A OF G2 = 21 AND B OF G2 = 12 AND D OF G2 = 30 AND C OF G2 = "Z"')}
MOVE CORR G1 TO G2
${k('move-corr', 'A OF G2 = 1 AND B OF G2 = 2 AND C OF G2 = "C" AND D OF G2 = 30')}
SUBTRACT CORR G1 FROM G2
${k('subtract-corr', 'A OF G2 = 0 AND B OF G2 = 0 AND D OF G2 = 30')}`
  })),

  nc('NC-QUAL-01', ['NC206A', 'NC207A', 'NC246A'], 'Qualification with OF/IN and qualified subscripted references', k => ({
    ws: `01 R1.
   05 F PIC 9 VALUE 1.
01 R2.
   05 F PIC 9 VALUE 2.
   05 T OCCURS 3 TIMES.
      10 E PIC 9.`,
    proc: `${k('qualified', 'F OF R1 = 1 AND F IN R2 = 2')}
ADD F OF R1 TO F OF R2
${k('qualified-add', 'F OF R2 = 3')}
MOVE 5 TO E OF T OF R2 (2)
MOVE 6 TO E IN R2 (3)
${k('qualified-subscript', 'E OF R2 (2) = 5 AND E OF T IN R2 (3) = 6')}`
  })),

  nc('NC-CONDNAME-01', ['NC207A', 'NC246A', 'NC250A'], 'Level-88 condition-names with VALUE, THRU and SET TO TRUE', k => ({
    ws: `01 S PIC 9 VALUE 2.
   88 S-LOW VALUE 1 THRU 3.
   88 S-HIGH VALUES ARE 7 8 9.
   88 S-ZERO VALUE 0.`,
    proc: `${k('thru', 'S-LOW AND NOT S-HIGH')}
MOVE 8 TO S
${k('value-list', 'S-HIGH AND NOT S-LOW')}
SET S-ZERO TO TRUE
${k('set-true', 'S = 0 AND S-ZERO')}`
  })),

  nc('NC-CLASS-01', ['NC174A'], 'Class conditions NUMERIC, ALPHABETIC, ALPHABETIC-UPPER and ALPHABETIC-LOWER', k => ({
    ws: `01 X PIC X(3) VALUE "123".
01 Y PIC X(3) VALUE "AB ".
01 L PIC X(2) VALUE "ab".
01 W PIC X(3) VALUE "1A2".
01 N PIC 9(3) VALUE 5.`,
    proc: `${k('numeric', 'X IS NUMERIC AND N NUMERIC')}
${k('not-numeric', 'W IS NOT NUMERIC')}
${k('alphabetic', 'Y IS ALPHABETIC AND W NOT ALPHABETIC')}
${k('upper-lower', 'Y ALPHABETIC-UPPER AND L ALPHABETIC-LOWER AND L NOT ALPHABETIC-UPPER')}`
  })),

  nc('NC-SIGN-01', ['NC250A'], 'Sign conditions POSITIVE, NEGATIVE and ZERO on items and expressions', k => ({
    ws: `01 NEG PIC S99 VALUE -3.
01 POS PIC S99 VALUE 4.
01 ZRO PIC S99 VALUE 0.`,
    proc: `${k('negative', 'NEG IS NEGATIVE AND NEG NOT POSITIVE')}
${k('positive', 'POS IS POSITIVE')}
${k('zero', 'ZRO IS ZERO AND ZRO NOT POSITIVE AND ZRO NOT NEGATIVE')}
${k('expression', '(POS - 4) IS ZERO AND POS + NEG POSITIVE')}`
  })),

  nc('NC-ABBREV-01', ['NC211A', 'NC174A'], 'Abbreviated combined relation conditions, NOT and parentheses', k => ({
    ws: '01 A PIC 9 VALUE 2.',
    proc: `${k('or-objects', 'A = 1 OR 2 OR 3')}
${k('and-operators', 'A > 0 AND < 5')}
${k('not-relation', 'A NOT = 4 AND 5')}
${k('parentheses', '(A = 2 OR A = 3) AND NOT (A = 4)')}
${k('not-condition', 'NOT A > 2')}`
  })),

  nc('NC-COMPARE-01', ['NC103A', 'NC215A', 'NC219A'], 'Group, numeric-to-numeric scale and figurative comparisons', k => ({
    ws: `01 G.
   05 GX PIC X VALUE "A".
   05 GN PIC 9 VALUE 1.
01 N PIC 99 VALUE 5.
01 D PIC 9V9 VALUE 5.0.
01 Z3 PIC X(3) VALUE "ZZZ".`,
    proc: `${k('group-alphanumeric', 'G = "A1"')}
${k('numeric-scale', 'N = D AND N = 05 AND N = 5.00')}
${k('high-value', 'Z3 < HIGH-VALUE AND Z3 > LOW-VALUE')}
${k('greater-less', 'N > 4.9 AND N < 5.1')}`
  })),

  nc('NC-GOTO-01', ['NC102A', 'NC123A'], 'GO TO, GO TO DEPENDING ON (in and out of range) and EXIT paragraph', k => ({
    ws: `01 N PIC 9 VALUE 0.
01 K PIC 9.
01 M PIC 99 VALUE 0.
01 P PIC 9 VALUE 0.`,
    proc: `PERFORM GO-START THRU GO-EXIT
${k('go-to', 'N = 2')}
${k('depending-out-of-range', 'P = 7')}
${k('depending', 'M = 2')}`,
    paragraphs: `GO-START.
MOVE 1 TO N.
GO TO GO-NEXT.
MOVE 9 TO N.
GO-NEXT.
ADD 1 TO N.
MOVE 5 TO K.
GO TO DEP-1 DEP-2 DEP-3 DEPENDING ON K.
MOVE 7 TO P.
MOVE 2 TO K.
GO TO DEP-1 DEP-2 DEP-3 DEPENDING ON K.
MOVE 99 TO M.
GO TO GO-EXIT.
DEP-1.
MOVE 1 TO M.
GO TO GO-EXIT.
DEP-2.
MOVE 2 TO M.
GO TO GO-EXIT.
DEP-3.
MOVE 3 TO M.
GO-EXIT.
EXIT.`
  })),

  nc('NC-ALTER-01', ['NC102A'], 'ALTER changes the target of a paragraph consisting of a GO TO', k => ({
    ws: '01 R PIC 9 VALUE 0.',
    proc: `PERFORM SWITCH-PARA THRU DONE-PARA
${k('before-alter', 'R = 1')}
ALTER SWITCH-PARA TO PROCEED TO BRANCH-2
PERFORM SWITCH-PARA THRU DONE-PARA
${k('after-alter', 'R = 2')}`,
    paragraphs: `SWITCH-PARA.
GO TO BRANCH-1.
BRANCH-1.
MOVE 1 TO R.
GO TO DONE-PARA.
BRANCH-2.
MOVE 2 TO R.
GO TO DONE-PARA.
DONE-PARA.
EXIT.`
  })),

  nc('NC-PERFORM-01', ['NC102A', 'NC121M'], 'PERFORM section-name, PERFORM THRU identifier TIMES and nested PERFORM', k => ({
    source: `IDENTIFICATION DIVISION.
PROGRAM-ID. NC-PERFORM-01.
DATA DIVISION.
WORKING-STORAGE SECTION.
01 N PIC 99 VALUE 0.
01 M PIC 9 VALUE 0.
01 X PIC 999 VALUE 0.
01 K PIC 9 VALUE 2.
PROCEDURE DIVISION.
MAIN-SECTION SECTION.
MAIN-1.
PERFORM ADD-SECTION.
PERFORM ADD-SECTION 2 TIMES.
PERFORM WORK-A THRU WORK-B K TIMES.
${k('section', 'N = 33')}
${k('thru-times', 'M = 4')}
${k('nested', 'X = 200')}
STOP RUN.
ADD-SECTION SECTION.
ADD-1.
ADD 1 TO N.
ADD-2.
ADD 10 TO N.
WORK-SECTION SECTION.
WORK-A.
ADD 1 TO M.
WORK-B.
ADD 1 TO M.
PERFORM INNER-PARA.
INNER-PARA.
ADD 100 TO X.`
  })),

  nc('NC-PERFORM-02', ['NC201A', 'NC240A', 'NC241A', 'NC243A', 'NC244A'], 'PERFORM VARYING AFTER, fractional and negative BY, WITH TEST AFTER', k => ({
    ws: `01 I PIC 9.
01 J PIC 9.
01 CNT PIC 99 VALUE 0.
01 D PIC 9V9.
01 DC PIC 9 VALUE 0.
01 KS PIC S9.
01 KC PIC 9 VALUE 0.
01 TA PIC 9 VALUE 0.
01 N PIC 9 VALUE 5.`,
    proc: `PERFORM COUNT-PARA VARYING I FROM 1 BY 1 UNTIL I > 3 AFTER J FROM 1 BY 1 UNTIL J > 2
${k('varying-after-count', 'CNT = 6')}
${k('varying-after-final', 'I = 4 AND J = 1')}
PERFORM VARYING D FROM 0.5 BY 0.5 UNTIL D > 2
ADD 1 TO DC
END-PERFORM
${k('fractional-by', 'DC = 4')}
PERFORM VARYING KS FROM 5 BY -1 UNTIL KS < 1
ADD 1 TO KC
END-PERFORM
${k('negative-by', 'KC = 5 AND KS = 0')}
PERFORM WITH TEST AFTER UNTIL N > 0
ADD 1 TO TA
END-PERFORM
${k('test-after', 'TA = 1')}`,
    paragraphs: `COUNT-PARA.
ADD 1 TO CNT.`
  })),

  nc('NC-INSPECT-01', ['NC115A', 'NC122A', 'NC216A', 'NC221A'], 'INSPECT TALLYING ALL, LEADING, CHARACTERS with BEFORE/AFTER INITIAL', k => ({
    ws: `01 T PIC X(10) VALUE "AABACADA  ".
01 C1 PIC 99 VALUE 0.
01 C2 PIC 99 VALUE 0.
01 C3 PIC 99 VALUE 0.
01 C4 PIC 99 VALUE 0.
01 C5 PIC 99 VALUE 0.`,
    proc: `INSPECT T TALLYING C1 FOR ALL "A"
${k('all', 'C1 = 5')}
INSPECT T TALLYING C2 FOR LEADING "A"
${k('leading', 'C2 = 2')}
INSPECT T TALLYING C3 FOR CHARACTERS BEFORE INITIAL "C"
${k('characters-before', 'C3 = 4')}
INSPECT T TALLYING C4 FOR ALL SPACES
${k('all-figurative', 'C4 = 2')}
INSPECT T TALLYING C5 FOR CHARACTERS AFTER INITIAL "D"
${k('characters-after', 'C5 = 3')}`
  })),

  nc('NC-INSPECT-02', ['NC115A', 'NC122A', 'NC216A', 'NC221A'], 'INSPECT REPLACING ALL, LEADING, FIRST and CHARACTERS with delimiters', k => ({
    ws: `01 U PIC X(8) VALUE "AABBAABB".
01 V PIC X(8) VALUE "00012300".
01 W PIC X(6) VALUE "ABCDEF".
01 Y PIC X(4) VALUE "ABAB".
01 Z PIC X(7) VALUE "A-B-C-D".`,
    proc: `INSPECT U REPLACING ALL "A" BY "X"
${k('all', 'U = "XXBBXXBB"')}
INSPECT V REPLACING LEADING "0" BY SPACE
${k('leading', 'V = "   12300"')}
INSPECT W REPLACING CHARACTERS BY "*" AFTER INITIAL "C"
${k('characters-after', 'W = "ABC***"')}
INSPECT Y REPLACING FIRST "A" BY "Z"
${k('first', 'Y = "ZBAB"')}
INSPECT Z REPLACING ALL "-" BY "+" BEFORE INITIAL "C"
${k('all-before', 'Z = "A+B+C-D"')}`
  })),

  nc('NC-INSPECT-03', ['NC221A'], 'INSPECT TALLYING with REPLACING and INSPECT CONVERTING', k => ({
    ws: `01 Q PIC X(5) VALUE "HELLO".
01 C PIC 9 VALUE 0.
01 CV PIC X(6) VALUE "aabbcd".`,
    proc: `INSPECT Q TALLYING C FOR ALL "L" REPLACING ALL "L" BY "R"
${k('tally-replace', 'C = 2 AND Q = "HERRO"')}
INSPECT CV CONVERTING "abc" TO "ABC"
${k('converting', 'CV = "AABBCd"')}`
  })),

  nc('NC-INITIALIZE-01', ['NC223A'], 'INITIALIZE group and table items, with and without REPLACING', k => ({
    ws: `01 G.
   05 A PIC X(3) VALUE "ABC".
   05 N PIC 9(3) VALUE 123.
01 TB.
   05 TE PIC 9 OCCURS 3 TIMES.`,
    proc: `INITIALIZE G
${k('default', 'A = SPACES AND N = 0')}
INITIALIZE G REPLACING NUMERIC DATA BY 7 ALPHANUMERIC DATA BY "Q"
${k('replacing', 'A = "Q" AND N = 7')}
MOVE "999" TO TB
INITIALIZE TB
${k('table', 'TE (1) = 0 AND TE (2) = 0 AND TE (3) = 0')}`
  })),

  nc('NC-SEARCH-01', ['NC231A', 'NC232A', 'NC234A', 'NC236A', 'NC238A'], 'Serial SEARCH with AT END, starting index and VARYING', k => ({
    ws: `01 T-INIT PIC X(5) VALUE "ABCDE".
01 TBL REDEFINES T-INIT.
   05 ENT PIC X OCCURS 5 TIMES INDEXED BY IX.
01 F PIC X.
01 CT PIC 99.`,
    proc: `SET IX TO 1
SEARCH ENT AT END MOVE "N" TO F WHEN ENT (IX) = "D" MOVE "Y" TO F END-SEARCH
${k('found', 'F = "Y" AND IX = 4')}
SET IX TO 1
SEARCH ENT AT END MOVE "E" TO F WHEN ENT (IX) = "Z" MOVE "Y" TO F END-SEARCH
${k('at-end', 'F = "E"')}
SET IX TO 5
SEARCH ENT AT END MOVE "E" TO F WHEN ENT (IX) = "A" MOVE "Y" TO F END-SEARCH
${k('starts-at-index', 'F = "E"')}
SET IX TO 1
MOVE 1 TO CT
SEARCH ENT VARYING CT AT END MOVE "E" TO F WHEN ENT (IX) = "C" MOVE "V" TO F END-SEARCH
${k('varying', 'F = "V" AND CT = 3')}`
  })),

  nc('NC-SEARCH-02', ['NC233A', 'NC237A', 'NC238A'], 'Binary SEARCH ALL on an ASCENDING KEY table', k => ({
    ws: `01 T-INIT PIC X(10) VALUE "A1C3E5G7I9".
01 TT REDEFINES T-INIT.
   05 EL OCCURS 5 TIMES ASCENDING KEY IS EK INDEXED BY JX.
      10 EK PIC X.
      10 EV PIC 9.
01 R PIC 9.`,
    proc: `SEARCH ALL EL AT END MOVE 0 TO R WHEN EK (JX) = "E" MOVE EV (JX) TO R END-SEARCH
${k('found', 'R = 5')}
MOVE 9 TO R
SEARCH ALL EL AT END MOVE 0 TO R WHEN EK (JX) = "D" MOVE EV (JX) TO R END-SEARCH
${k('not-found', 'R = 0')}`
  })),

  nc('NC-SET-01', ['NC131A', 'NC133A', 'NC140A', 'NC141A', 'NC244A', 'NC248A'], 'SET index TO/UP BY/DOWN BY, SET data-name TO index and USAGE INDEX items', k => ({
    ws: `01 T.
   05 E PIC 9 OCCURS 9 TIMES INDEXED BY I1 I2.
01 N PIC 99 VALUE 3.
01 IX-ITEM USAGE IS INDEX.`,
    proc: `SET I1 TO 2
SET I1 UP BY 3
SET I1 DOWN BY 1
SET N TO I1
${k('up-down', 'N = 4')}
SET I2 TO I1
SET I2 UP BY N
${k('up-by-data-name', 'I2 = 8')}
SET IX-ITEM TO I2
SET I1 TO IX-ITEM
${k('index-data-item', 'I1 = 8')}
SET I1 I2 TO 1
${k('multiple-receivers', 'I1 = 1 AND I2 = 1')}`
  })),

  nc('NC-INDEX-01', ['NC135A', 'NC137A', 'NC139A', 'NC239A', 'NC244A'], 'Relative indexing, relative subscripting and three-level indexed tables', k => ({
    ws: `01 T.
   05 E PIC 9 OCCURS 9 TIMES INDEXED BY I1.
01 N PIC 9 VALUE 3.
01 T3.
   05 L1 OCCURS 2 TIMES INDEXED BY A1.
      10 L2 OCCURS 2 TIMES INDEXED BY A2.
         15 L3 PIC X OCCURS 2 TIMES INDEXED BY A3.`,
    proc: `MOVE "123456789" TO T
SET I1 TO 5
${k('relative-index', 'E (I1 + 1) = 6 AND E (I1 - 2) = 3')}
${k('relative-subscript', 'E (N + 1) = 4')}
MOVE "ABCDEFGH" TO T3
SET A1 A2 A3 TO 2
${k('three-level-index', 'L3 (A1, A2, A3) = "H"')}
${k('three-level-subscript', 'L3 (1, 2, 1) = "C" AND L3 (2, 1, 2) = "F"')}`
  })),

  nc('NC-ODO-01', ['NC247A'], 'OCCURS DEPENDING ON controls the length of sending and receiving groups', k => ({
    ws: `01 CNT PIC 9 VALUE 5.
01 VT.
   05 VE PIC X OCCURS 1 TO 5 TIMES DEPENDING ON CNT.
01 TGT PIC X(5).`,
    proc: `MOVE "VWXYZ" TO VT
MOVE 2 TO CNT
MOVE VT TO TGT
${k('short-sender', 'TGT = "VW"')}
MOVE 3 TO CNT
MOVE "ABC" TO VT
MOVE 5 TO CNT
MOVE VT TO TGT
${k('short-receiver', 'TGT = "ABCYZ"')}`
  })),

  nc('NC-REDEFINES-01', ['NC252A', 'NC209A'], 'REDEFINES and level-66 RENAMES', k => ({
    ws: `01 R.
   05 D PIC 9(4) VALUE 1234.
   05 X REDEFINES D PIC X(4).
   05 P REDEFINES D.
      10 P1 PIC 99.
      10 P2 PIC 99.
01 REC.
   05 F1 PIC X VALUE "A".
   05 F2 PIC X VALUE "B".
   05 F3 PIC X VALUE "C".
66 F12 RENAMES F1 THRU F2.
66 F3R RENAMES F3.`,
    proc: `${k('redefines', 'X = "1234" AND P2 = 34')}
MOVE "5678" TO X
${k('redefines-write', 'D = 5678 AND P1 = 56')}
${k('renames', 'F12 = "AB" AND F3R = "C"')}`
  })),

  nc('NC-EDIT-01', ['NC105A', 'NC114M', 'NC124A', 'NC125A'], 'Numeric editing: Z, comma, period, *, floating $, B, / and 0 insertion; de-editing', k => ({
    ws: `01 E1 PIC ZZZ9.
01 E2 PIC Z,ZZ9.99.
01 E3 PIC ***9.99.
01 E4 PIC $$$9.
01 E5 PIC $$,$$9.99.
01 E6 PIC 99/99/99.
01 E7 PIC 99B99.
01 E8 PIC 9990.
01 E9 PIC **.**.
01 N PIC 9(4)V99.`,
    proc: `MOVE 42 TO E1
${k('z-suppression', 'E1 = "  42"')}
MOVE 1234.5 TO E2
${k('comma-period', 'E2 = "1,234.50"')}
MOVE 5 TO E2
${k('comma-suppressed', 'E2 = "    5.00"')}
MOVE 12.3 TO E3
${k('check-protect', 'E3 = "**12.30"')}
MOVE 5 TO E4
MOVE 1234.5 TO E5
${k('floating-currency', 'E4 = "  $5" AND E5 = "$1,234.50"')}
MOVE 251231 TO E6
MOVE 1234 TO E7
MOVE 12 TO E8
${k('slash-b-zero', 'E6 = "25/12/31" AND E7 = "12 34" AND E8 = "0120"')}
MOVE 0 TO E9
${k('all-asterisk-zero', 'E9 = "**.**"')}
MOVE 1234.5 TO E2
MOVE E2 TO N
${k('de-edit', 'N = 1234.5')}`
  })),

  nc('NC-EDIT-02', ['NC116A', 'NC124A', 'NC125A'], 'Sign editing (+, -, CR, DB, floating) and BLANK WHEN ZERO', k => ({
    ws: `01 S1 PIC -999.
01 S2 PIC 999+.
01 S3 PIC +++9.
01 S4 PIC ---9.
01 S5 PIC 999CR.
01 S6 PIC 999DB.
01 B1 PIC ZZ9 BLANK WHEN ZERO.
01 B2 PIC ZZ.ZZ.`,
    proc: `MOVE -12 TO S1
${k('minus-negative', 'S1 = "-012"')}
MOVE 12 TO S1
${k('minus-positive', 'S1 = " 012"')}
MOVE 12 TO S2
${k('trailing-plus', 'S2 = "012+"')}
MOVE -12 TO S2
${k('trailing-plus-negative', 'S2 = "012-"')}
MOVE -7 TO S3
MOVE 7 TO S4
${k('floating-sign', 'S3 = "  -7" AND S4 = "   7"')}
MOVE -5 TO S5
MOVE -5 TO S6
${k('cr-db', 'S5 = "005CR" AND S6 = "005DB"')}
MOVE 5 TO S5
${k('cr-positive', 'S5 = "005  "')}
MOVE 0 TO B1
MOVE 0 TO B2
${k('blank-when-zero', 'B1 = SPACES AND B2 = SPACES')}`
  })),

  nc('NC-PICTURE-01', ['NC116A', 'NC124A'], 'PICTURE P scaling and SIGN LEADING/TRAILING SEPARATE representation', k => ({
    ws: `01 PP PIC 99PP.
01 VP PIC VPP99.
01 L-GRP.
   05 L PIC S9(3) SIGN IS LEADING SEPARATE CHARACTER VALUE -12.
01 L-X REDEFINES L-GRP PIC X(4).
01 T-GRP.
   05 T PIC S9(3) SIGN TRAILING SEPARATE VALUE 12.
01 T-X REDEFINES T-GRP PIC X(4).`,
    proc: `MOVE 1234 TO PP
${k('p-left', 'PP = 1200')}
MOVE .00123 TO VP
${k('p-right', 'VP = .0012')}
${k('leading-separate', 'L-X = "-012" AND L = -12')}
${k('trailing-separate', 'T-X = "012+" AND T = 12')}`
  })),

  nc('NC-USAGE-01', ['NC106A', 'NC108M', 'NC118A'], 'USAGE COMPUTATIONAL, explicit DISPLAY and SYNCHRONIZED items in arithmetic', k => ({
    ws: `01 C PIC S9(4) USAGE IS COMPUTATIONAL VALUE 1234.
01 D PIC 9(4) USAGE DISPLAY VALUE 5.
01 D2 PIC 9(4).
01 G.
   05 GX PIC X.
   05 GY PIC S9(4) COMP SYNCHRONIZED.`,
    proc: `ADD D TO C
MOVE C TO D2
${k('comp-display', 'C = 1239 AND D2 = 1239')}
MOVE 7 TO GY
${k('sync', 'GY = 7')}`
  })),

  nc('NC-SPECIAL-01', ['NC108M', 'NC174A', 'NC254A'], 'SPECIAL-NAMES CLASS, ALPHABET and SYMBOLIC CHARACTERS', k => ({
    environment: `CONFIGURATION SECTION.
SPECIAL-NAMES.
    ALPHABET STD-ALPHA IS STANDARD-1
    SYMBOLIC CHARACTERS ASTER IS 43
    CLASS HEX-DIGIT IS "0" THRU "9" "A" THRU "F".`,
    ws: `01 H PIC X(4) VALUE "1F0A".
01 G PIC X(2) VALUE "1G".
01 S PIC X.`,
    proc: `${k('class', 'H IS HEX-DIGIT AND G IS NOT HEX-DIGIT')}
MOVE ASTER TO S
${k('symbolic', 'S = "*"')}`
  })),

  nc('NC-SPECIAL-02', ['NC108M', 'SM103A'], 'DECIMAL-POINT IS COMMA swaps period and comma in literals and editing', k => ({
    environment: `CONFIGURATION SECTION.
SPECIAL-NAMES.
    DECIMAL-POINT IS COMMA.`,
    ws: `01 N PIC 9(3)V99 VALUE 12,5.
01 E PIC Z.ZZ9,99.`,
    proc: `${k('literal', 'N = 12,50')}
MOVE 1234,5 TO E
${k('editing', 'E = "1.234,50"')}`
  })),

  nc('NC-SEPARATOR-01', ['NC138A', 'NC205A', 'NC245A'], 'Semicolon and comma separators, space before subscript parentheses, signed and leading-point literals', k => ({
    ws: `01 A PIC S9V9.
01 B PIC S9V9.
01 C PIC S9V9.
01 T.
   05 E PIC 9 OCCURS 2 TIMES.`,
    proc: `MOVE +1 TO A; MOVE -.5 TO B, ADD A, B GIVING C;
${k('separators', 'C = .5')}
MOVE 7 TO E (2)
${k('subscript-space', 'E(2) = 7')}`
  })),

  nc('NC-STRING-01', ['NC217A', 'NC218A'], 'STRING DELIMITED BY identifier and ON OVERFLOW; UNSTRING OR, ALL, DELIMITER IN, COUNT IN and TALLYING IN', k => ({
    ws: `01 DL PIC X VALUE "*".
01 S4 PIC X(4) VALUE SPACES.
01 S3 PIC X(3).
01 F PIC X VALUE "N".
01 SRC PIC X(8) VALUE "AB,CD;EF".
01 U1 PIC X(3).
01 U2 PIC X(3).
01 U3 PIC X(3).
01 D1 PIC X.
01 D2 PIC X.
01 N1 PIC 9.
01 N2 PIC 9.
01 TL PIC 9 VALUE 0.
01 SP-SRC PIC X(5) VALUE "A   B".
01 V1 PIC X.
01 V2 PIC X.`,
    proc: `STRING "AB*CD" DELIMITED BY DL INTO S4 END-STRING
${k('delimited-by-identifier', 'S4 = "AB"')}
STRING "ABCDEF" DELIMITED BY SIZE INTO S3 ON OVERFLOW MOVE "Y" TO F END-STRING
${k('overflow', 'F = "Y" AND S3 = "ABC"')}
UNSTRING SRC DELIMITED BY "," OR ";" INTO U1 DELIMITER IN D1 COUNT IN N1 U2 DELIMITER IN D2 COUNT IN N2 U3 TALLYING IN TL END-UNSTRING
${k('or-delimiters', 'U1 = "AB" AND U2 = "CD" AND U3 = "EF"')}
${k('delimiter-count', 'D1 = "," AND D2 = ";" AND N1 = 2 AND N2 = 2')}
${k('tallying', 'TL = 3')}
UNSTRING SP-SRC DELIMITED BY ALL SPACE INTO V1 V2 END-UNSTRING
${k('delimited-by-all', 'V1 = "A" AND V2 = "B"')}`
  })),

  nc('NC-EVALUATE-01', ['NC225A'], 'EVALUATE TRUE, ALSO, THRU, ANY, NOT and multiple WHEN phrases', k => ({
    ws: `01 N PIC 9 VALUE 7.
01 C PIC X VALUE "C".
01 R1 PIC 9.
01 R2 PIC 9.
01 R3 PIC 9.
01 R4 PIC 9.
01 R5 PIC 9.`,
    proc: `EVALUATE TRUE
WHEN N < 5 MOVE 1 TO R1
WHEN N < 10 MOVE 2 TO R1
WHEN OTHER MOVE 3 TO R1
END-EVALUATE
${k('true-subject', 'R1 = 2')}
EVALUATE N ALSO C
WHEN 1 THRU 5 ALSO "A" MOVE 1 TO R2
WHEN 6 THRU 9 ALSO "B" MOVE 2 TO R2
WHEN ANY ALSO "C" MOVE 3 TO R2
END-EVALUATE
${k('also-thru-any', 'R2 = 3')}
EVALUATE N
WHEN 1
WHEN 7 MOVE 4 TO R3
WHEN OTHER MOVE 0 TO R3
END-EVALUATE
${k('shared-when', 'R3 = 4')}
EVALUATE N
WHEN NOT 7 MOVE 1 TO R4
WHEN OTHER MOVE 2 TO R4
END-EVALUATE
${k('not-object', 'R4 = 2')}
EVALUATE TRUE ALSO FALSE
WHEN N = 7 ALSO N = 8 MOVE 5 TO R5
WHEN OTHER MOVE 0 TO R5
END-EVALUATE
${k('true-also-false', 'R5 = 5')}`
  })),

  nc('NC-IF-01', ['NC211A'], 'NEXT SENTENCE and ELSE pairing in nested IF statements', k => ({
    ws: `01 A PIC 9 VALUE 1.
01 B PIC 9 VALUE 2.
01 R PIC 9.
01 R2 PIC 9.`,
    proc: `MOVE 0 TO R.
IF A = 1 NEXT SENTENCE ELSE MOVE 5 TO R.
ADD 1 TO R.
IF A = 1 IF B = 3 MOVE 1 TO R2 ELSE MOVE 2 TO R2 ELSE MOVE 3 TO R2.
${k('next-sentence', 'R = 1')}
${k('nested-else', 'R2 = 2')}`
  })),

  nc('NC-LIMITS-01', ['NC111A', 'NC112A'], '18-digit arithmetic precision, size error at the limit and MOVE truncation', k => ({
    ws: `01 BIG PIC 9(18) VALUE 123456789012345678.
01 MAX18 PIC 9(18) VALUE 999999999999999999.
01 F PIC X VALUE "N".
01 T1 PIC 99V99.
01 T2 PIC 99V9.`,
    proc: `ADD 1 TO BIG
${k('eighteen-digits', 'BIG = 123456789012345679')}
ADD 1 TO MAX18 ON SIZE ERROR MOVE "Y" TO F END-ADD
${k('limit-size-error', 'F = "Y" AND MAX18 = 999999999999999999')}
MOVE 12.345 TO T1
MOVE 1234.5 TO T2
${k('move-truncation', 'T1 = 12.34 AND T2 = 34.5')}`
  })),

  nc('NC-MOVE-01', ['NC104A', 'NC105A', 'NC126A'], 'Alphabetic items, numeric to alphanumeric, alphanumeric to numeric and group moves', k => ({
    ws: `01 A5 PIC A(5).
01 N3 PIC 9(3) VALUE 42.
01 X5 PIC X(5).
01 N4 PIC 9(4).
01 G.
   05 GA PIC X(2) VALUE "AB".
   05 GN PIC 99 VALUE 12.
01 X6 PIC X(6).`,
    proc: `MOVE "ABC" TO A5
${k('alphabetic', 'A5 = "ABC  "')}
MOVE N3 TO X5
${k('numeric-to-alphanumeric', 'X5 = "042  "')}
MOVE "12" TO N4
${k('alphanumeric-to-numeric', 'N4 = 12')}
MOVE G TO X6
${k('group-to-elementary', 'X6 = "AB12  "')}
MOVE "XYZ" TO G
${k('literal-to-group', 'G = "XYZ " AND GA = "XY"')}`
  }))
];
