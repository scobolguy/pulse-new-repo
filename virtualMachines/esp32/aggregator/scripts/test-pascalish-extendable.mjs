import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';

const source = `
program "extendable-test";
  type Zot = integer;
  var
    smallValue: Zot;
    extendedValue: Zot extendable;
    table: array[1..4] of Zot extendable;
  procedure Worker();
    var localValue: Zot extendable;
  begin
  end;
begin
end.
`;

const compiled = compilePascalishProgramWithAntlr(source);
assert.deepEqual(
  compiled.programMap.extendableDeclarations.map(({ name, elementCount }) => ({ name, elementCount })),
  [
    { name: 'extendedValue', elementCount: 1 },
    { name: 'table', elementCount: 4 },
    { name: 'localValue', elementCount: 1 }
  ]
);
assert.equal(compiled.programMap.variableDeclarations.find(item => item.name === 'table').extendable, true);
assert.equal(compiled.programMap.variableDeclarations.find(item => item.name === 'smallValue').extendable, false);

assert.throws(
  () => compilePascalishProgramWithAntlr(`
program "unsupported-extendable";
  type Item = record value: integer; end;
  var items: array[0..3] of Item extendable;
begin
end.
`),
  /extendable is only supported for scalar variables and fixed arrays of scalars/
);

console.log('[pascalish-extendable] PASS');
