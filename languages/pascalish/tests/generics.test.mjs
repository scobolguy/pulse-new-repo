import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compilePascalishProgramWithAntlr as compile } from '../src/compile-pascalish-program-antlr-to-pcode.mjs';
import { specializeGenerics } from '../src/specialize-generics.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { loadOpcodeMap } from '../../../virtualMachines/esp32/pmachines/javascript/src/opcodes.mjs';

async function run(source, expected) {
  const compiled = compile(source);
  const result = await executeProgram({
    instructions: parsePcode(compiled.pcodeText), programMap: compiled.programMap,
    opcodeMap: await loadOpcodeMap(), queueTypesByName: new Map(), isoTypeIds: new Set(),
    runtimeContext: { maxSteps: 20000 }
  });
  assert.equal(result.runtimeError, undefined);
  assert.equal(result.state?.__runtime_error, undefined);
  assert.equal(result.stepLimitHit, false);
  assert.deepEqual(result.stdout, expected);
  return compiled;
}

const boxes = `
type
  TBox<T> = class
  public
    Value: T;
    constructor Create(AValue: T);
    function GetValue: T;
  end;
constructor TBox<T>.Create(AValue: T);
begin Value := AValue end;
function TBox<T>.GetValue: T;
begin Result := Value end;
`;

test('generic classes alias; Free releases only that variable, including returned references', async () => {
  await run(`program Aliases; ${boxes}
    var A, B: TBox<Integer>;
    function Make: TBox<Integer>;
    var Owned: TBox<Integer>;
    begin
      Owned := TBox<Integer>.Create(5);
      try Result := Owned; Exit finally Owned.Free end
    end;
    begin
      A := Make; B := A; A.Value := 17; A.Free;
      Writeln(B.GetValue); B.Free
    end.`, ['17']);
});

test('generic value records copy private data rather than alias it', async () => {
  await run(`program Copies;
    type TRec<T> = record
    private Value: T;
    public
      procedure SetValue(AValue: T);
      function GetValue: T;
    end;
    procedure TRec<T>.SetValue(AValue: T); begin Value := AValue end;
    function TRec<T>.GetValue: T; begin Result := Value end;
    var A, B: TRec<Integer>;
    begin A.SetValue(4); B := A; A.SetValue(9); Writeln(B.GetValue); Writeln(A.GetValue) end.`,
  ['4', '9']);
});

test('nested generic records and fixed arrays copy all leaves', async () => {
  await run(`program Nested;
    type TRec<T> = record Value: T; end;
    type TPair = array[1..2] of Integer;
    var A, B: TRec<TPair>;
    var C, D: TRec<TRec<Integer>>;
    begin A.Value[1] := 7; B := A; A.Value[1] := 9;
      C.Value.Value := 11; D := C; C.Value.Value := 13;
      Writeln(B.Value[1]); Writeln(D.Value.Value)
    end.`, ['7', '11']);
});

test('specialization reuses aliases and case variants and separates actual types', async () => {
  const compiled = await run(`program Reuse; ${boxes}
    type TNumber = Integer;
    var A: TBox<Integer>; B: TBox<TNumber>; C: TBox<string>;
    begin
      A := TBox<integer>.Create(2); B := A; C := TBox<string>.Create('text');
      Writeln(B.GetValue); Writeln(C.GetValue)
    end.`, ['2', 'text']);
  assert.equal(Object.keys(compiled.programMap.procedures).filter(label => /CREATE/.test(label)).length, 2);
});

test('class constraints follow aliases', async () => {
  await run(`program Constraints;
    type TRef = class end;
    type TAlias = TRef;
    type THolder<T: class> = class public Value: T; end;
    var A: TAlias; H: THolder<TAlias>;
    begin A := TRef.Create; H := THolder<TAlias>.Create; H.Value := A; Writeln('OK') end.`, ['OK']);
});

test('function Exit preserves Result and runs nested finalizers exactly once', async () => {
  await run(`program Cleanup;
    function ReadValue: Integer;
    begin
      Result := 8;
      try
        try Exit finally Writeln('inner'); Result := 99 end
      finally Writeln('outer') end
    end;
    begin Writeln(ReadValue) end.`, ['inner', 'outer', '8']);
});

test('procedure Exit writes back var arguments and main Exit halts', async () => {
  await run(`program EarlyExit;
    var N: Integer;
    procedure Change(var V: Integer);
    begin V := 6; Exit; V := 99 end;
    begin Change(N); Writeln(N); Exit; Writeln('unreachable') end.`, ['6']);
});

test('string equality uses variable and generic method result types', async () => {
  await run(`program Strings; ${boxes}
    var A: TBox<string>; S, Other: String;
    begin
      A := TBox<string>.Create('hello'); S := 'hello'; Other := 'different';
      if (A.GetValue = S) and (Other <> S) then Writeln('OK')
    end.`, ['OK']);
});

test('dynamic arrays resize with copied prefixes and preserve old aliases', async () => {
  await run(`program Arrays;
    var A, B: array of Integer;
    begin SetLength(A, 2); A[0] := 3; B := A; SetLength(A, 3);
      A[0] := 9; Writeln(B[0]); Writeln(A[0]); Writeln(A[2]); Writeln(Length(A))
    end.`, ['3', '9', '0', '3']);
});

for (const [name, source, diagnostic] of [
  ['unknown actual type', `${boxes} var A: TBox<NoSuchType>;`, /Unknown generic type argument/],
  ['wrong argument count', `${boxes} var A: TBox<Integer, String>;`, /requires 1 type arguments/],
  ['missing specialization', `${boxes} var A: TBox;`, /requires 1 type arguments/],
  ['constraint violation', 'type TRef<T: class> = class end; var A: TRef<Integer>;', /class constraint/],
  ['recursive inline record', 'type TRec<T> = record Value: TRec<T>; end; var A: TRec<Integer>;', /Recursive value layout/],
  ['recursive fixed array', 'type TRec<T> = record Value: array[1..2] of TRec<T>; end; var A: TRec<Integer>;', /Recursive value layout/],
  ['generic type mismatch', `${boxes} var A: TBox<Integer>;`, null],
  ['aliased var arguments', `var A: Integer; procedure Change(var X, Y: Integer); begin X := 1; Y := 2 end;`, null]
]) {
  test(`rejects ${name} with a semantic diagnostic`, () => {
    const body = name === 'generic type mismatch' ? `A := TBox<Integer>.Create('wrong')`
      : name === 'aliased var arguments' ? 'Change(A, A)' : '';
    assert.throws(() => compile(`program Invalid; ${source} begin ${body} end.`),
      diagnostic || (name === 'generic type mismatch' ? /type mismatch/ : /Aliased var arguments/));
  });
}

test('specialization count and expanding recursion are bounded', () => {
  const ref = id => ({ type: 'TypeRef', kind: 'user', id, genericArgs: [] });
  const makeAst = () => ({
    types: [], classes: [{ type: 'ClassDecl', name: 'Box', genericParams: [{ name: 'T' }], members: [] }],
    variables: Array.from({ length: 129 }, (_, index) => ({
      dataType: { ...ref('Box'), genericArgs: [{ type: 'TypeRef', kind: 'simple', id: `type${index}` }] }
    }))
  });
  assert.throws(() => specializeGenerics(makeAst()), /capacity exceeded/);
  assert.throws(() => compile(`program Expanding;
    type TBox<T> = class public Next: TBox<TBox<T>>; end;
    var A: TBox<Integer>; begin end.`), /capacity exceeded/);
});
