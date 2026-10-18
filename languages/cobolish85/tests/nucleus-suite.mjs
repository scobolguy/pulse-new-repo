import assert from 'node:assert/strict';
import { test, traceProgram, traceCheck } from './support/trace.mjs';
import { compileTandemCobol85ToPcode } from '../src/compile-tandem-cobol85-to-pcode.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { createDesktopTextBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/desktop-text-bindings.mjs';

function nucleusCase(category, id, description, workingStorage, procedure, condition, environment = '', paragraphs = '') {
  return {
    category,
    id,
    description,
    condition,
    source: [
      'IDENTIFICATION DIVISION.',
      `PROGRAM-ID. ${id}.`,
      environment,
      'DATA DIVISION.',
      'WORKING-STORAGE SECTION.',
      workingStorage,
      'PROCEDURE DIVISION.',
      procedure,
      `IF ${condition} THEN`,
      `    DISPLAY "${id}: PASS"`,
      'ELSE',
      `    DISPLAY "${id}: FAIL"`,
      'END-IF',
      'STOP RUN.',
      paragraphs
    ].join('\n')
  };
}

const cases = [
  nucleusCase('lexical', 'NUC-LEX-001', 'Basic tokens and separators', '01 A PIC 9 VALUE 1.\n01 B PIC 9 VALUE 2.\n01 C PIC 9.', 'COMPUTE C = A + B', 'C = 3'),
  nucleusCase('lexical', 'NUC-LEX-002', 'Arithmetic statement spans source lines', '01 R PIC 99.', 'COMPUTE R = 1 +\n                       2', 'R = 3'),
  nucleusCase('lexical', 'NUC-LEX-003', 'Case-insensitive reserved words', '01 N PIC 9 VALUE 4.', 'compute N = N + 1', 'N = 5'),
  nucleusCase('lexical', 'NUC-LEX-004', 'Optional terminal period after a statement', '01 N PIC 9.', 'MOVE 6 TO N.', 'N = 6'),
  nucleusCase('lexical', 'NUC-LEX-005', 'Hyphenated identifiers', '01 ITEM-COUNT PIC 99 VALUE 12.', 'ADD 1 TO ITEM-COUNT', 'ITEM-COUNT = 13'),
  nucleusCase('lexical', 'NUC-LEX-006', 'Multiple statements in one sentence', '01 A PIC 9.\n01 B PIC 9.', 'MOVE 2 TO A\nMOVE 3 TO B', 'A = 2 AND B = 3'),
  nucleusCase('lexical', 'NUC-LEX-007', 'Quoted literal containing punctuation', '01 TEXT-FIELD PIC X(5).', 'MOVE "A.B,C" TO TEXT-FIELD', 'TEXT-FIELD = "A.B,C"'),
  nucleusCase('lexical', 'NUC-LEX-008', 'Arithmetic operator token boundaries', '01 N PIC 99 VALUE 8.', 'COMPUTE N = N - 3', 'N = 5'),
  nucleusCase('lexical', 'NUC-LEX-009', 'Parenthesized arithmetic expression', '01 N PIC 99.', 'COMPUTE N = (2 + 3) * 2', 'N = 10'),
  nucleusCase('lexical', 'NUC-LEX-010', 'Adjacent relational and logical operators', '01 A PIC 9 VALUE 2.\n01 B PIC 9 VALUE 3.', 'CONTINUE', 'A < B AND B > 2'),

  nucleusCase('data-description', 'NUC-DATA-001', 'Level-77 elementary item', '77 N PIC 99 VALUE 42.', 'CONTINUE', 'N = 42'),
  nucleusCase('data-description', 'NUC-DATA-002', 'PIC 9(3) numeric value', '01 N PIC 9(3) VALUE 123.', 'CONTINUE', 'N = 123'),
  nucleusCase('data-description', 'NUC-DATA-003', 'Signed numeric item', '01 S PIC S9(3) VALUE -45.', 'CONTINUE', 'S = -45'),
  nucleusCase('data-description', 'NUC-DATA-004', 'Single-digit numeric item', '01 N PIC 9 VALUE 7.', 'CONTINUE', 'N = 7'),
  nucleusCase('data-description', 'NUC-DATA-005', 'Repeated-digit picture', '01 N PIC 9(4) VALUE 2026.', 'CONTINUE', 'N = 2026'),
  nucleusCase('data-description', 'NUC-DATA-006', 'Alphanumeric item', '01 T PIC X(5) VALUE "HELLO".', 'CONTINUE', 'T = "HELLO"'),
  nucleusCase('data-description', 'NUC-DATA-007', 'Single-character item', '01 T PIC X VALUE "Q".', 'CONTINUE', 'T = "Q"'),
  nucleusCase('data-description', 'NUC-DATA-008', 'Implied decimal scale', '01 N PIC 9V99 VALUE 1.25.', 'CONTINUE', 'N = 1.25'),
  nucleusCase('data-description', 'NUC-DATA-009', 'Signed decimal value', '01 N PIC S9V99 VALUE -2.75.', 'CONTINUE', 'N = -2.75'),
  nucleusCase('data-description', 'NUC-DATA-010', 'Initial zero value', '01 N PIC 9(3) VALUE ZERO.', 'CONTINUE', 'N = 0'),
  nucleusCase('data-description', 'NUC-DATA-011', 'Initial spaces in alphanumeric item', '01 T PIC X(3) VALUE SPACES.', 'CONTINUE', 'T = "   "'),
  nucleusCase('data-description', 'NUC-DATA-012', 'VALUE clauses on subordinate elementary items', '01 G.\n   05 A PIC 9 VALUE 4.\n   05 B PIC 9 VALUE 5.', 'CONTINUE', 'A = 4 AND B = 5'),
  nucleusCase('data-description', 'NUC-DATA-013', 'Trailing sign declaration', '01 N PIC S9(3) SIGN IS TRAILING VALUE -12.', 'CONTINUE', 'N = -12'),
  nucleusCase('data-description', 'NUC-DATA-014', 'BLANK WHEN ZERO clause', '01 N PIC 9 BLANK WHEN ZERO VALUE 0.', 'CONTINUE', 'N = 0'),
  nucleusCase('data-description', 'NUC-DATA-015', 'JUSTIFIED alphanumeric receiving item', '01 T PIC X(4) JUSTIFIED RIGHT.', 'MOVE "AB" TO T', 'T = "  AB"'),

  nucleusCase('arithmetic', 'NUC-ARITH-001', 'COMPUTE addition', '01 R PIC 99.', 'COMPUTE R = 12 + 7', 'R = 19'),
  nucleusCase('arithmetic', 'NUC-ARITH-002', 'COMPUTE subtraction', '01 R PIC 99.', 'COMPUTE R = 20 - 8', 'R = 12'),
  nucleusCase('arithmetic', 'NUC-ARITH-003', 'COMPUTE multiplication', '01 R PIC 99.', 'COMPUTE R = 4 * 5', 'R = 20'),
  nucleusCase('arithmetic', 'NUC-ARITH-004', 'COMPUTE division', '01 R PIC 99.', 'COMPUTE R = 18 / 3', 'R = 6'),
  nucleusCase('arithmetic', 'NUC-ARITH-005', 'Left-associative addition and subtraction', '01 R PIC 99.', 'COMPUTE R = 10 + 5 - 3', 'R = 12'),
  nucleusCase('arithmetic', 'NUC-ARITH-006', 'Multiplication precedence over addition', '01 A PIC 9 VALUE 2.\n01 B PIC 9 VALUE 3.\n01 C PIC 9 VALUE 4.\n01 R PIC 99.', 'COMPUTE R = A + B * C', 'R = 14'),
  nucleusCase('arithmetic', 'NUC-ARITH-007', 'Parentheses override precedence', '01 R PIC 99.', 'COMPUTE R = (2 + 3) * 4', 'R = 20'),
  nucleusCase('arithmetic', 'NUC-ARITH-008', 'ADD statement', '01 N PIC 99 VALUE 9.', 'ADD 6 TO N', 'N = 15'),
  nucleusCase('arithmetic', 'NUC-ARITH-009', 'SUBTRACT statement', '01 N PIC 99 VALUE 17.', 'SUBTRACT 8 FROM N', 'N = 9'),
  nucleusCase('arithmetic', 'NUC-ARITH-010', 'ROUNDED decimal result', '01 R PIC 99.', 'COMPUTE R ROUNDED = 2.5', 'R = 3'),

  nucleusCase('move', 'NUC-MOVE-001', 'MOVE numeric literal to numeric item', '01 N PIC 99.', 'MOVE 42 TO N', 'N = 42'),
  nucleusCase('move', 'NUC-MOVE-002', 'MOVE numeric item to another numeric item', '01 A PIC 99 VALUE 27.\n01 B PIC 99.', 'MOVE A TO B', 'B = 27'),
  nucleusCase('move', 'NUC-MOVE-003', 'MOVE alphanumeric literal to alphanumeric item', '01 T PIC X(4).', 'MOVE "TEST" TO T', 'T = "TEST"'),
  nucleusCase('move', 'NUC-MOVE-004', 'MOVE numeric text to numeric item', '01 A PIC X(3) VALUE "123".\n01 N PIC 9(3).', 'MOVE A TO N', 'N = 123'),
  nucleusCase('move', 'NUC-MOVE-005', 'Group MOVE copies subordinate fields', '01 SRC.\n   05 A PIC 9 VALUE 7.\n   05 B PIC 9 VALUE 8.\n01 DST.\n   05 X PIC 9.\n   05 Y PIC 9.', 'MOVE SRC TO DST', 'X = 7 AND Y = 8'),
  nucleusCase('move', 'NUC-MOVE-006', 'MOVE one source to multiple targets', '01 A PIC 9 VALUE 5.\n01 B PIC 9.\n01 C PIC 9.', 'MOVE A TO B C', 'B = 5 AND C = 5'),
  nucleusCase('move', 'NUC-MOVE-007', 'MOVE signed numeric value', '01 A PIC S99 VALUE -3.\n01 B PIC S99.', 'MOVE A TO B', 'B = -3'),
  nucleusCase('move', 'NUC-MOVE-008', 'MOVE zero to numeric item', '01 N PIC 9(3) VALUE 999.', 'MOVE ZERO TO N', 'N = 0'),
  nucleusCase('move', 'NUC-MOVE-009', 'MOVE SPACES to alphanumeric item', '01 T PIC X(4) VALUE "ABCD".', 'MOVE SPACES TO T', 'T = "    "'),
  nucleusCase('move', 'NUC-MOVE-010', 'MOVE numeric value with receiver truncation', '01 N PIC 99.', 'MOVE 123 TO N', 'N = 23'),

  nucleusCase('conditions', 'NUC-COND-001', 'Equality condition', '01 N PIC 9 VALUE 5.', 'CONTINUE', 'N = 5'),
  nucleusCase('conditions', 'NUC-COND-002', 'Inequality condition', '01 N PIC 9 VALUE 5.', 'CONTINUE', 'N NOT = 4'),
  nucleusCase('conditions', 'NUC-COND-003', 'Less-than condition', '01 A PIC 9 VALUE 3.\n01 B PIC 9 VALUE 8.', 'CONTINUE', 'A < B'),
  nucleusCase('conditions', 'NUC-COND-004', 'Less-than-or-equal condition', '01 A PIC 9 VALUE 3.\n01 B PIC 9 VALUE 3.', 'CONTINUE', 'A <= B'),
  nucleusCase('conditions', 'NUC-COND-005', 'Greater-than condition', '01 A PIC 9 VALUE 8.\n01 B PIC 9 VALUE 3.', 'CONTINUE', 'A > B'),
  nucleusCase('conditions', 'NUC-COND-006', 'Greater-than-or-equal condition', '01 A PIC 9 VALUE 8.\n01 B PIC 9 VALUE 8.', 'CONTINUE', 'A >= B'),
  nucleusCase('conditions', 'NUC-COND-007', 'AND combination of relational conditions', '01 A PIC 9 VALUE 5.\n01 B PIC 9 VALUE 7.', 'CONTINUE', 'A < B AND B > 6'),
  nucleusCase('conditions', 'NUC-COND-008', 'OR combination of relational conditions', '01 A PIC 9 VALUE 5.\n01 B PIC 9 VALUE 7.', 'CONTINUE', 'A = 5 OR B = 0'),
  nucleusCase('conditions', 'NUC-COND-009', 'IF ELSE chooses matching branch', '01 N PIC 9 VALUE 2.\n01 R PIC 9.', 'IF N = 2 THEN MOVE 1 TO R ELSE MOVE 0 TO R END-IF', 'R = 1'),
  nucleusCase('conditions', 'NUC-COND-010', 'Combined conditions with IF', '01 A PIC 9 VALUE 5.\n01 B PIC 9 VALUE 7.\n01 R PIC 9.', 'IF A < B AND B > 6 THEN MOVE 1 TO R ELSE MOVE 0 TO R END-IF', 'R = 1'),

  nucleusCase('string-unstring', 'NUC-STRING-001', 'STRING literal into target', '01 OUT-TEXT PIC X(4) VALUE SPACES.', 'STRING "AB" DELIMITED BY SIZE INTO OUT-TEXT END-STRING', 'OUT-TEXT = "AB  "'),
  nucleusCase('string-unstring', 'NUC-STRING-002', 'STRING multiple literals', '01 OUT-TEXT PIC X(4) VALUE SPACES.', 'STRING "A" "B" DELIMITED BY SIZE INTO OUT-TEXT END-STRING', 'OUT-TEXT = "AB  "'),
  nucleusCase('string-unstring', 'NUC-STRING-003', 'STRING fields with delimiter', '01 A PIC X VALUE "A".\n01 B PIC X VALUE "B".\n01 OUT-TEXT PIC X(3).', 'STRING A DELIMITED BY SIZE "-" DELIMITED BY SIZE B DELIMITED BY SIZE INTO OUT-TEXT END-STRING', 'OUT-TEXT = "A-B"'),
  nucleusCase('string-unstring', 'NUC-STRING-004', 'STRING with pointer', '01 OUT-TEXT PIC X(4) VALUE SPACES.\n01 PTR PIC 9 VALUE 1.', 'STRING "AB" DELIMITED BY SIZE INTO OUT-TEXT WITH POINTER PTR END-STRING', 'OUT-TEXT = "AB  " AND PTR = 3'),
  nucleusCase('string-unstring', 'NUC-STRING-005', 'STRING appends at initial pointer', '01 OUT-TEXT PIC X(4) VALUE "X   ".\n01 PTR PIC 9 VALUE 2.', 'STRING "YZ" DELIMITED BY SIZE INTO OUT-TEXT WITH POINTER PTR END-STRING', 'OUT-TEXT = "XYZ " AND PTR = 4'),
  nucleusCase('string-unstring', 'NUC-STRING-008', 'STRING with DELIMITED BY SIZE', '01 OUT-TEXT PIC X(6).\n01 PTR PIC 9 VALUE 1.', 'STRING "AB" "CD" "EF" DELIMITED BY SIZE INTO OUT-TEXT WITH POINTER PTR END-STRING', 'OUT-TEXT = "ABCDEF" AND PTR = 7'),
  nucleusCase('string-unstring', 'NUC-UNSTR-001', 'UNSTRING a two-part delimited field', '01 IN-TEXT PIC X(3) VALUE "A-B".\n01 P1 PIC X.\n01 P2 PIC X.', 'UNSTRING IN-TEXT DELIMITED BY "-" INTO P1 P2 END-UNSTRING', 'P1 = "A" AND P2 = "B"'),
  nucleusCase('string-unstring', 'NUC-UNSTR-002', 'UNSTRING into three fields', '01 IN-TEXT PIC X(5) VALUE "A-B-C".\n01 P1 PIC X.\n01 P2 PIC X.\n01 P3 PIC X.', 'UNSTRING IN-TEXT DELIMITED BY "-" INTO P1 P2 P3 END-UNSTRING', 'P1 = "A" AND P2 = "B" AND P3 = "C"'),
  nucleusCase('string-unstring', 'NUC-UNSTR-003', 'UNSTRING adjacent delimiter handling', '01 IN-TEXT PIC X(4) VALUE "A--B".\n01 P1 PIC X.\n01 P2 PIC X.\n01 P3 PIC X.', 'UNSTRING IN-TEXT DELIMITED BY "-" INTO P1 P2 P3 END-UNSTRING', 'P1 = "A" AND P2 = " " AND P3 = "B"'),
  nucleusCase('string-unstring', 'NUC-UNSTR-009', 'UNSTRING with delimiter', '01 IN-TEXT PIC X(6) VALUE "A-B-C-".\n01 P1 PIC X.\n01 P2 PIC X.\n01 P3 PIC X.', 'UNSTRING IN-TEXT DELIMITED BY "-" INTO P1 P2 P3 END-UNSTRING', 'P1 = "A" AND P2 = "B" AND P3 = "C"'),

  nucleusCase('reference-modification', 'NUC-REFMOD-001', 'Reference modification extracts first character', '01 S PIC X(5) VALUE "ABCDE".\n01 R PIC X.', 'MOVE S(1:1) TO R', 'R = "A"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-002', 'Reference modification extracts middle character', '01 S PIC X(5) VALUE "ABCDE".\n01 R PIC X.', 'MOVE S(3:1) TO R', 'R = "C"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-003', 'Reference modification extracts suffix', '01 S PIC X(5) VALUE "ABCDE".\n01 R PIC X(2).', 'MOVE S(4:2) TO R', 'R = "DE"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-004', 'Reference modification uses variable start', '01 S PIC X(5) VALUE "ABCDE".\n01 START-POS PIC 9 VALUE 2.\n01 R PIC X.', 'MOVE S(START-POS:1) TO R', 'R = "B"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-005', 'Reference modification writes a substring', '01 S PIC X(5) VALUE "ABCDE".', 'MOVE "XY" TO S(2:2)', 'S = "AXYDE"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-006', 'Reference modification uses full field length', '01 S PIC X(3) VALUE "ABC".\n01 R PIC X(3).', 'MOVE S(1:3) TO R', 'R = "ABC"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-007', 'Reference modification starts at final character', '01 S PIC X(3) VALUE "ABC".\n01 R PIC X.', 'MOVE S(3:1) TO R', 'R = "C"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-008', 'Reference modification in a comparison', '01 S PIC X(5) VALUE "ABCDE".', 'CONTINUE', 'S(2:3) = "BCD"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-009', 'Reference modification accepts arithmetic start', '01 S PIC X(5) VALUE "ABCDE".\n01 R PIC X(2).', 'MOVE S(1 + 1:2) TO R', 'R = "BC"'),
  nucleusCase('reference-modification', 'NUC-REFMOD-010', 'Simple reference modification', '01 S PIC X(5) VALUE "ABCDE".\n01 SUB PIC X(3).', 'MOVE S(2:3) TO SUB', 'SUB = "BCD"'),

  nucleusCase('tables', 'NUC-TABLE-001', 'OCCURS table item first element', '01 TBL.\n   05 ELEM PIC 9 OCCURS 3 TIMES.', 'MOVE 1 TO ELEM(1)', 'ELEM(1) = 1'),
  nucleusCase('tables', 'NUC-TABLE-002', 'OCCURS table item last element', '01 TBL.\n   05 ELEM PIC 9 OCCURS 3 TIMES.', 'MOVE 3 TO ELEM(3)', 'ELEM(3) = 3'),
  nucleusCase('tables', 'NUC-TABLE-003', 'VALUE initializes every occurrence', '01 TBL.\n   05 ELEM PIC 9 OCCURS 3 TIMES VALUE 2.', 'CONTINUE', 'ELEM(1) = 2 AND ELEM(2) = 2 AND ELEM(3) = 2'),
  nucleusCase('tables', 'NUC-TABLE-004', 'Subscripted table assignment and read', '01 TBL.\n   05 ELEM PIC 9 OCCURS 2 TIMES.\n01 I PIC 9 VALUE 2.\n01 R PIC 9.', 'MOVE 7 TO ELEM(I)\nMOVE ELEM(I) TO R', 'R = 7'),
  nucleusCase('tables', 'NUC-TABLE-005', 'Table occurrence arithmetic', '01 TBL.\n   05 ELEM PIC 9 OCCURS 2 TIMES.\n01 R PIC 9.', 'MOVE 4 TO ELEM(1)\nMOVE 5 TO ELEM(2)\nCOMPUTE R = ELEM(1) + ELEM(2)', 'R = 9'),
  nucleusCase('tables', 'NUC-TABLE-006', 'OCCURS lower and upper bounds', '01 TBL.\n   05 ELEM PIC 9 OCCURS 2 TO 4 TIMES DEPENDING ON N.\n01 N PIC 9 VALUE 3.', 'MOVE 7 TO ELEM(N)', 'ELEM(3) = 7 AND N = 3'),
  nucleusCase('tables', 'NUC-TABLE-007', 'Nested OCCURS table', '01 TBL.\n   05 ROW OCCURS 2 TIMES.\n      10 ELEM PIC 9 OCCURS 2 TIMES.', 'MOVE 8 TO ELEM(2, 1)', 'ELEM(2, 1) = 8'),
  nucleusCase('tables', 'NUC-TABLE-008', 'Indexed table declaration', '01 TBL.\n   05 ELEM PIC 9 OCCURS 3 TIMES INDEXED BY IDX.', 'SET IDX TO 2\nMOVE 8 TO ELEM(IDX)', 'ELEM(2) = 8'),
  nucleusCase('tables', 'NUC-TABLE-009', 'PERFORM over table occurrences', '01 TBL.\n   05 ELEM PIC 9 OCCURS 3 TIMES.\n01 I PIC 9.\n01 TOTAL PIC 9 VALUE ZERO.', 'MOVE 1 TO ELEM(1)\nMOVE 2 TO ELEM(2)\nMOVE 3 TO ELEM(3)\nPERFORM VARYING I FROM 1 BY 1 UNTIL I > 3\nADD ELEM(I) TO TOTAL\nEND-PERFORM', 'TOTAL = 6'),
  nucleusCase('tables', 'NUC-TABLE-011', 'OCCURS and subscripting', '01 TBL.\n   05 ELEM PIC 9 OCCURS 3 TIMES.', 'MOVE 1 TO ELEM(1)\nMOVE 2 TO ELEM(2)\nMOVE 3 TO ELEM(3)', 'ELEM(1) = 1 AND ELEM(2) = 2 AND ELEM(3) = 3'),

  nucleusCase('control-flow', 'NUC-CTRL-001', 'PERFORM a paragraph once', '01 N PIC 9 VALUE ZERO.\n01 R PIC 9.', 'PERFORM INCREMENT-N\nMOVE N TO R', 'R = 1', '', 'INCREMENT-N.\nADD 1 TO N.'),
  nucleusCase('control-flow', 'NUC-CTRL-002', 'PERFORM paragraph until condition', '01 N PIC 9 VALUE ZERO.\n01 R PIC 9.', 'PERFORM INCREMENT-N UNTIL N >= 3\nMOVE N TO R', 'R = 3', '', 'INCREMENT-N.\nADD 1 TO N.'),
  nucleusCase('control-flow', 'NUC-CTRL-003', 'Inline PERFORM UNTIL', '01 N PIC 9 VALUE ZERO.\n01 R PIC 9.', 'PERFORM UNTIL N >= 3\nADD 1 TO N\nEND-PERFORM\nMOVE N TO R', 'R = 3'),
  nucleusCase('control-flow', 'NUC-CTRL-004', 'Nested IF branches', '01 A PIC 9 VALUE 2.\n01 B PIC 9 VALUE 3.\n01 R PIC 9.', 'IF A < B THEN IF B = 3 THEN MOVE 1 TO R ELSE MOVE 0 TO R END-IF ELSE MOVE 0 TO R END-IF', 'R = 1'),
  nucleusCase('control-flow', 'NUC-CTRL-005', 'EVALUATE selects matching WHEN', '01 N PIC 9 VALUE 2.\n01 R PIC 9.', 'EVALUATE N\nWHEN 1 MOVE 1 TO R\nWHEN 2 MOVE 2 TO R\nWHEN OTHER MOVE 0 TO R\nEND-EVALUATE', 'R = 2'),
  nucleusCase('control-flow', 'NUC-CTRL-006', 'EVALUATE uses WHEN OTHER', '01 N PIC 9 VALUE 8.\n01 R PIC 9.', 'EVALUATE N\nWHEN 1 MOVE 1 TO R\nWHEN OTHER MOVE 9 TO R\nEND-EVALUATE', 'R = 9'),
  nucleusCase('control-flow', 'NUC-CTRL-007', 'PERFORM VARYING increments through loop', '01 I PIC 9.\n01 R PIC 9.', 'PERFORM VARYING I FROM 1 BY 1 UNTIL I > 5\nCONTINUE\nEND-PERFORM\nMOVE I TO R', 'R = 6'),
  nucleusCase('control-flow', 'NUC-CTRL-008', 'PERFORM paragraph range', '01 N PIC 9 VALUE ZERO.\n01 R PIC 9.', 'PERFORM FIRST-PARA THRU LAST-PARA\nMOVE N TO R', 'R = 3', '', 'FIRST-PARA.\nADD 1 TO N.\nMIDDLE-PARA.\nADD 1 TO N.\nLAST-PARA.\nADD 1 TO N.'),
  nucleusCase('control-flow', 'NUC-CTRL-009', 'PERFORM a paragraph repeatedly', '01 N PIC 9 VALUE ZERO.\n01 R PIC 9.', 'PERFORM INCREMENT-N 3 TIMES\nMOVE N TO R', 'R = 3', '', 'INCREMENT-N.\nADD 1 TO N.'),
  nucleusCase('control-flow', 'NUC-CTRL-012', 'PERFORM VARYING loop', '01 I PIC 9 VALUE 0.', 'PERFORM VARYING I FROM 1 BY 1 UNTIL I > 5\nCONTINUE\nEND-PERFORM', 'I = 6'),

  nucleusCase('program-structure', 'NUC-STRUCT-001', 'Minimal program structure', '01 FLAG PIC X VALUE "N".', 'MOVE "Y" TO FLAG', 'FLAG = "Y"'),
  nucleusCase('program-structure', 'NUC-STRUCT-002', 'ENVIRONMENT DIVISION and CONFIGURATION SECTION', '01 FLAG PIC X VALUE "N".', 'MOVE "Y" TO FLAG', 'FLAG = "Y"', 'ENVIRONMENT DIVISION.\nCONFIGURATION SECTION.'),
  nucleusCase('program-structure', 'NUC-STRUCT-003', 'Procedure division with named paragraph', '01 N PIC 9.\n01 R PIC 9.', 'PERFORM SET-N\nMOVE N TO R', 'R = 7', '', 'SET-N.\nMOVE 7 TO N.'),
  nucleusCase('program-structure', 'NUC-STRUCT-004', 'Explicit END-IF scope terminator', '01 N PIC 9 VALUE 1.\n01 R PIC 9.', 'IF N = 1 THEN MOVE 4 TO R END-IF', 'R = 4'),
  nucleusCase('program-structure', 'NUC-STRUCT-005', 'STOP RUN terminates after a sentence', '01 N PIC 9.\n01 R PIC 9.', 'MOVE 3 TO N\nMOVE N TO R', 'R = 3')
];

const expectedCounts = {
  lexical: 10,
  'data-description': 15,
  arithmetic: 10,
  move: 10,
  conditions: 10,
  'string-unstring': 10,
  'reference-modification': 10,
  tables: 10,
  'control-flow': 10,
  'program-structure': 5
};

test('COBOL85 nucleus catalog contains 100 distinct programs', () => {
  const actualCounts = Object.fromEntries(Object.keys(expectedCounts)
    .map(category => [category, cases.filter(entry => entry.category === category).length]));
  traceCheck(import.meta.url, {
    description: 'Catalog size, distinct program ids, and programs per category',
    expected: { programs: 100, distinctIds: 100, perCategory: expectedCounts },
    actual: { programs: cases.length, distinctIds: new Set(cases.map(entry => entry.id)).size, perCategory: actualCounts }
  });
  assert.equal(cases.length, 100);
  assert.equal(new Set(cases.map(entry => entry.id)).size, 100);
  for (const [category, count] of Object.entries(expectedCounts)) {
    assert.equal(cases.filter(entry => entry.category === category).length, count, `${category} case count`);
  }
});

for (const entry of cases) {
  test(`${entry.id} — ${entry.description}`, async () => {
    traceProgram(import.meta.url, entry.source, { category: entry.category });
    const check = { description: `Condition ${entry.condition} holds, so the program displays the PASS line` };
    let compiled;
    try {
      compiled = compileTandemCobol85ToPcode(entry.source, { fileName: `${entry.id}.cob` });
    } catch (error) {
      traceCheck(import.meta.url, { ...check, expected: [`${entry.id}: PASS`], actual: `Compile error: ${error.message}` });
      assert.fail(`${entry.id}: compiler rejected the conformance case: ${error.message}`);
    }

    const execution = await executeProgram({
      instructions: parsePcode(compiled.pcodeText),
      programMap: compiled.programMap,
      inputQueue: '',
      sourceMessage: '',
      runtimeContext: { callHost: (name, args) => createDesktopTextBindings()[name](...args) }
    });
    traceCheck(import.meta.url, {
      ...check,
      expected: [`${entry.id}: PASS`],
      actual: execution.error ? `Runtime error: ${execution.error}` : execution.stdout
    });
    assert.equal(execution.error, null, `${entry.id}: runtime error`);
    assert.equal(execution.stepLimitHit, false, `${entry.id}: execution reached the step limit`);
    assert.deepEqual(
      execution.stdout,
      [`${entry.id}: PASS`],
      `${entry.id}: assertion failed; globals=${JSON.stringify(execution.globals)}`
    );
  });
}
