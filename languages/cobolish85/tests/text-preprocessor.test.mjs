import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preprocessCobolText } from '../src/cobol-text-preprocessor.mjs';

const squash = text => text.replace(/\s+/g, ' ').trim();

test('source without COPY or REPLACE is returned unchanged', () => {
  const source = 'MOVE 1 TO A.\n  DISPLAY "COPY ME".';
  assert.equal(preprocessCobolText(source), source);
});

test('COPY inserts library text in place of the whole COPY statement', () => {
  const out = preprocessCobolText('01 A PIC 9.\nCOPY REC.\n01 B PIC 9.', { copybooks: { REC: '01 R PIC X.' } });
  assert.equal(squash(out), '01 A PIC 9. 01 R PIC X. 01 B PIC 9.');
});

test('COPY text-name is matched case-insensitively and may be qualified by OF or IN', () => {
  const copybooks = { 'LIBA/SHARED': 'ADD 1 TO X', 'libb/shared2': 'ADD 2 TO X', rec: 'ADD 3 TO X' };
  const out = preprocessCobolText('COPY SHARED OF LIBA. COPY SHARED2 IN LIBB. COPY REC.', { copybooks });
  assert.equal(squash(out), 'ADD 1 TO X ADD 2 TO X ADD 3 TO X');
});

test('COPY REPLACING handles pseudo-text, literal and word operands', () => {
  const copybooks = { T: '01 :PFX:-ITEM PIC X(3) VALUE "OLD". 01 :PFX:-N PIC 9(3) VALUE 100.' };
  const out = preprocessCobolText('COPY T REPLACING ==:PFX:== BY ==WS== "OLD" BY "NEW" 100 BY 200.', { copybooks });
  assert.equal(squash(out), '01 WS-ITEM PIC X(3) VALUE "NEW". 01 WS-N PIC 9(3) VALUE 200.');
});

test('COPY REPLACING matches whole text-words and multi-word pseudo-text', () => {
  const copybooks = { ADDER: 'ADD STEP TO TARGET-ITEM. MOVE TARGET-ITEM-2 TO Z.' };
  const out = preprocessCobolText('COPY ADDER REPLACING TARGET-ITEM BY WS-ITEM ==ADD STEP== BY ==ADD 5==.', { copybooks });
  assert.equal(squash(out), 'ADD 5 TO WS-ITEM. MOVE TARGET-ITEM-2 TO Z.');
});

test('COPY text may itself contain COPY statements', () => {
  const out = preprocessCobolText('COPY OUTER.', { copybooks: { OUTER: 'MOVE 1 TO A. COPY INNER.', INNER: 'MOVE 2 TO B.' } });
  assert.equal(squash(out), 'MOVE 1 TO A. MOVE 2 TO B.');
});

test('REPLACE applies until REPLACE OFF, including to copied text', () => {
  const source = 'REPLACE ==OLD-NAME== BY ==NEW-NAME==.\nMOVE OLD-NAME TO X.\nCOPY C.\nREPLACE OFF.\nMOVE OLD-NAME TO Y.';
  const out = preprocessCobolText(source, { copybooks: { C: 'ADD 1 TO OLD-NAME.' } });
  assert.equal(squash(out), 'MOVE NEW-NAME TO X. ADD 1 TO NEW-NAME. MOVE OLD-NAME TO Y.');
});

test('a later REPLACE statement supersedes the earlier one', () => {
  const out = preprocessCobolText('REPLACE ==A1== BY ==B1==. MOVE A1 TO A2. REPLACE ==A2== BY ==C2==. MOVE A1 TO A2.');
  assert.equal(squash(out), 'MOVE B1 TO A2. MOVE A1 TO C2.');
});

test('missing copybooks and malformed statements are reported', () => {
  assert.throws(() => preprocessCobolText('COPY NOPE.'), /COPY text NOPE was not supplied/);
  assert.throws(() => preprocessCobolText('COPY X OF L.', { copybooks: { X: '' } }), /X OF L was not supplied/);
  assert.throws(() => preprocessCobolText('COPY X REPLACING A B.', { copybooks: { X: '' } }), /requires BY/);
  assert.throws(() => preprocessCobolText('REPLACE ==A== BY ==B'), /not terminated/);
  assert.throws(() => preprocessCobolText('COPY A.', { copybooks: { A: 'COPY A.' } }), /nesting/);
});

test('DECIMAL-POINT IS COMMA turns decimal commas in numeric literals into periods', () => {
  const source = 'SPECIAL-NAMES. DECIMAL-POINT IS COMMA.\n01 N PIC 9(3)V99 VALUE 12,5.\n01 E PIC Z.ZZ9,99.\n01 F PICTURE IS 999,99.\nMOVE 1234,5 TO E. ADD 1, N GIVING N. DISPLAY "1,5".';
  const out = preprocessCobolText(source);
  assert.match(out, /VALUE 12\.5\./);
  assert.match(out, /PIC Z\.ZZ9,99\./);
  assert.match(out, /PICTURE IS 999,99\./);
  assert.match(out, /MOVE 1234\.5 TO E/);
  assert.match(out, /ADD 1, N GIVING N/);
  assert.match(out, /DISPLAY "1,5"/);
});

test('decimal commas are left alone without DECIMAL-POINT IS COMMA', () => {
  assert.equal(preprocessCobolText('MOVE 1,5 TO A.'), 'MOVE 1,5 TO A.');
});
