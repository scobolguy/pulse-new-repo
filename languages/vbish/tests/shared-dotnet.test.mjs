import assert from 'node:assert/strict';
import test from 'node:test';
import { compileCsharpToPcode } from '../../csharp/src/compile-csharp-to-pcode.mjs';
import { compileVb11ToPcode } from '../src/compile-vb11.mjs';
import { createScalarLibrary, prepareScalarImports } from '../../dotnet/scalar-library.mjs';
import { executeSystemIntrinsic } from '../../dotnet/system-library.mjs';
import { INTEGER_TYPES, convertInteger } from '../../dotnet/integer-types.mjs';
import { executeProgram, parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/index.mjs';

const vb = methods => `Imports System\nModule Program\n${methods}\nEnd Module\n`;
const cs = methods => `class Program { ${methods} }`;
async function execute(artifact) {
  const result = await executeProgram({
    instructions: parsePcode(artifact.pcodeText), programMap: artifact.programMap,
    inputQueue: '', sourceMessage: '', runtimeContext: { maxSteps: 100000, maxCallDepth: 64 }
  });
  assert.equal(result.error, null);
  assert.equal(result.stepLimitHit, false);
  return result.stdout;
}

test('C# calls real VBish library procedures with scalar arguments and return values', async () => {
  const provider = compileVb11ToPcode(vb(`Function Twice(ByVal n As Integer) As Integer
Return n * 2
End Function
Function Echo(ByVal s As String) As String
Return s
End Function
Function Flip(ByVal b As Boolean) As Boolean
Return Not b
End Function
Sub Main()
End Sub`));
  const library = createScalarLibrary(provider, {
    id: 'VisualBasic', version: '1.0.0', exports: { Twice: 'program.twice', Echo: 'program.echo', Flip: 'program.flip' }
  });
  const consumer = compileCsharpToPcode(cs(`static void Main() {
System.Console.WriteLine(VisualBasic.Twice(21));
System.Console.WriteLine(VisualBasic.Echo("cross language"));
System.Console.WriteLine(VisualBasic.Flip(false));
}`), { libraries: [library] });
  assert.deepEqual(await execute(consumer), ['42', 'cross language', 'True']);
  assert.deepEqual(consumer.programMap.libraryBindings, [{ id: 'VisualBasic', version: '1.0.0', abiVersion: 1 }]);
  assert.deepEqual(consumer.programMap.targets, ['js']);
});

test('VBish calls real C# procedures case-insensitively without text conversion of values', async () => {
  const provider = compileCsharpToPcode(cs(`public static int Add(int a, int b) { return a + b; }
public static bool Flip(bool b) { return !b; }
public static string Echo(string s) { return s; }
static void Main() {}`));
  const library = createScalarLibrary(provider, {
    id: 'CSharp', version: '2.0.0', exports: { Add: 'Program.Add', Flip: 'Program.Flip', Echo: 'Program.Echo' }
  });
  const consumer = compileVb11ToPcode(vb(`Sub Main()
Console.WriteLine(csharp.ADD(20, 22))
Console.WriteLine(CSHARP.flip(True))
Console.WriteLine(CSharp.Echo("001"))
End Sub`), { libraries: [library] });
  assert.deepEqual(await execute(consumer), ['42', 'False', '001']);
});

test('cross-language signatures, duplicate identities and target mismatches fail before execution', () => {
  const artifact = compileCsharpToPcode(cs('public static int Id(int n) { return n; } static void Main() {}'));
  const library = createScalarLibrary(artifact, { id: 'Shared', version: '1.0.0', exports: { Id: 'Program.Id' } });
  assert.throws(() => compileVb11ToPcode(vb('Sub Main()\nConsole.WriteLine([Shared].Id(True))\nEnd Sub'), { libraries: [library] }), /Cannot use 'bool'/);
  assert.throws(() => compileCsharpToPcode(cs('static void Main() { Shared.Id("wrong"); }'), { libraries: [library] }), /Cannot use 'string'/);
  assert.throws(() => prepareScalarImports([library, library], 'csharp'), /Duplicate scalar library/);
  assert.throws(() => createScalarLibrary(artifact, { id: 'bad-name', version: 'latest', exports: {} }), /exact major.minor.patch/);
  assert.throws(() => createScalarLibrary(artifact, { id: 'Shared', version: '1.0.0', exports: { Missing: 'Program.Missing' } }), /resolve to one/);
  const incompatible = structuredClone(library);
  incompatible.programMap.targets = ['esp32'];
  assert.throws(() => prepareScalarImports([incompatible], 'csharp'), /cannot run on target js/);
  const forged = structuredClone(library);
  forged.members[0].parameterTypes = ['bool'];
  assert.throws(() => prepareScalarImports([forged], 'vbish'), /Signature mismatch/);
  const privateArtifact = compileCsharpToPcode(cs('private static int Hidden() { return 1; } static void Main() {}'));
  assert.throws(() => createScalarLibrary(privateArtifact, { id: 'Private', version: '1.0.0', exports: { Hidden: 'Program.Hidden' } }), /not an accessible procedure/);
});

test('shared arithmetic preserves C# unchecked behavior and VB checked behavior', async () => {
  const csharp = compileCsharpToPcode(cs('static void Main() { int n = 2147483647; System.Console.WriteLine(n + 1); }'));
  assert.deepEqual(await execute(csharp), ['-2147483648']);
  const visualBasic = compileVb11ToPcode(vb('Sub Main()\nDim n As Integer = 2147483647\nConsole.WriteLine(n + 1)\nEnd Sub'));
  await assert.rejects(execute(visualBasic), /System.OverflowException/);
  assert.equal(executeSystemIntrinsic('system.int32.multiply', [-2147483648, 1]), -2147483648);
  assert.throws(() => executeSystemIntrinsic('system.int32.multiply', [2147483647, 2]), /System.OverflowException/);
  assert.throws(() => executeSystemIntrinsic('system.int32.remainder', [-2147483648, -1]), /System.OverflowException/);
  assert.equal(executeSystemIntrinsic('system.int32.remainder', [-2147483648, 1]), 0);
  assert.throws(() => executeSystemIntrinsic('system.int32.add', [1.5, 2]), /Int32/);
});

test('integer string conversion is explicit rather than relying on coercing CONCAT', async () => {
  for (const value of [-2147483648, -1, 0, 2147483647]) {
    assert.equal(executeSystemIntrinsic('system.int32.tostring', [value]), String(value));
  }
  for (const value of [1.5, '42', true, Infinity]) {
    assert.throws(() => executeSystemIntrinsic('system.int32.tostring', [value]), /Int32/);
  }
  assert.throws(() => executeSystemIntrinsic('system.int32.tostring', []), /Invalid System intrinsic/);
  const csharp = compileCsharpToPcode(cs(`static void Main() {
int n = -2147483648; string s = "n="; s += n;
System.Console.WriteLine(s); System.Console.WriteLine(n + ":end");
}`));
  const visualBasic = compileVb11ToPcode(vb(`Sub Main()
Dim n As Integer = -2147483648
Console.WriteLine(CStr(n))
Console.WriteLine("n=" & n)
End Sub`));
  for (const artifact of [csharp, visualBasic]) assert.match(artifact.pcodeText, /CALL_EXT system.int32.tostring 1/);
  assert.deepEqual(await execute(csharp), ['n=-2147483648', '-2147483648:end']);
  assert.deepEqual(await execute(visualBasic), ['-2147483648', 'n=-2147483648']);
});

test('explicit conversions preserve typed scalar values in both language directions', async () => {
  const csharpProvider = createScalarLibrary(compileCsharpToPcode(cs(`
public static int Number(int n) { checked { return (int)n + 1; } }
public static bool Flag(bool b) { return (bool)b; }
public static string Text(string s) { return (string)s; }
static void Main() {}`)), {
    id: 'Provider', version: '1.0.0',
    exports: { Number: 'Program.Number', Flag: 'Program.Flag', Text: 'Program.Text' }
  });
  const vbConsumer = compileVb11ToPcode(vb(`Sub Main()
Dim n As Integer = -2147483648
Console.WriteLine(Provider.Number(CInt(n)))
Console.WriteLine(CInt(Provider.Flag(CBool(n))))
Console.WriteLine(Provider.Text(CStr(True)))
End Sub`), { libraries: [csharpProvider] });
  assert.deepEqual(await execute(vbConsumer), ['-2147483647', '-1', 'True']);
  const vbProvider = createScalarLibrary(compileVb11ToPcode(vb(`
Function Number(b As Boolean) As Integer
Return CInt(b)
End Function
Function Flag(n As Integer) As Boolean
Return CBool(n)
End Function
Function Text(n As Integer) As String
Return CStr(n)
End Function
Sub Main()
End Sub`)), {
    id: 'Provider', version: '1.0.0',
    exports: { Number: 'program.number', Flag: 'program.flag', Text: 'program.text' }
  });
  const csharpConsumer = compileCsharpToPcode(cs(`static void Main() {
int n = -2147483648; bool b = true;
System.Console.WriteLine(Provider.Number((bool)b));
System.Console.WriteLine(Provider.Flag((int)n));
System.Console.WriteLine(Provider.Text((int)n));
}`), { libraries: [vbProvider] });
  assert.deepEqual(await execute(csharpConsumer), ['-1', 'True', '-2147483648']);
  const overflow = compileVb11ToPcode(vb(`Sub Main()
Console.WriteLine(Provider.Number(2147483647))
End Sub`), { libraries: [csharpProvider] });
  await assert.rejects(execute(overflow), /System.OverflowException/);
});

test('integer width intrinsics enforce exact bounds, signedness and explicit overflow modes', () => {
  for (const [type, { min, max }] of Object.entries(INTEGER_TYPES)) {
    for (const value of [min, 0, max]) {
      assert.equal(convertInteger(value, type, true), value);
      assert.equal(executeSystemIntrinsic('system.integer.convert', [value, type, 1]), value);
    }
    if (type === 'int') continue;
    assert.throws(() => convertInteger(max + 1, type, true), /OverflowException/);
    assert.throws(() => convertInteger(min - 1, type, true), /OverflowException/);
    assert.equal(convertInteger(max + 1, type, false), min);
    assert.equal(convertInteger(min - 1, type, false), max);
  }
  for (const value of [NaN, Infinity, 1.5, '1', 2147483648]) {
    assert.throws(() => convertInteger(value, 'byte', true), /Int32 value/);
  }
  assert.throws(() => executeSystemIntrinsic('system.integer.convert', [1, 'byte', 2]), /overflow mode/);
  assert.throws(() => convertInteger(1, 'long', true), /Unsupported integer conversion target/);
});

test('8-bit and 16-bit signatures round-trip through C# and VB libraries in both directions', async () => {
  const types = [
    { cs: 'sbyte', vb: 'SByte', cast: 'CSByte', min: -128, max: 127 },
    { cs: 'byte', vb: 'Byte', cast: 'CByte', min: 0, max: 255 },
    { cs: 'short', vb: 'Short', cast: 'CShort', min: -32768, max: 32767 },
    { cs: 'ushort', vb: 'UShort', cast: 'CUShort', min: 0, max: 65535 },
  ];
  for (const { cs: type, vb: spelling, cast, min, max } of types) {
    const csharp = createScalarLibrary(compileCsharpToPcode(cs(`
public static ${type} Copy(${type} n) { return n; }
public static short Widen(byte n) { return n; }
static void Main() {}`)), {
      id: 'Provider', version: '1.0.0', exports: { Copy: 'Program.Copy', Widen: 'Program.Widen' }
    });
    const visualBasic = createScalarLibrary(compileVb11ToPcode(vb(`
Function Copy(n As ${spelling}) As ${spelling}
Return n
End Function
Function Widen(n As Byte) As Short
Return n
End Function
Sub Main()
End Sub`)), {
      id: 'Provider', version: '1.0.0', exports: { Copy: 'program.copy', Widen: 'program.widen' }
    });
    const vbConsumer = compileVb11ToPcode(vb(`Sub Main()
Dim lo As ${spelling}=${min}
Dim hi As ${spelling}=${max}
Console.WriteLine(Provider.Copy(lo))
Console.WriteLine(Provider.Copy(hi))
Console.WriteLine(Provider.Widen(CByte(255)))
End Sub`), { libraries: [csharp] });
    const csConsumer = compileCsharpToPcode(cs(`static void Main() {
${type} lo=${min}, hi=${max};
System.Console.WriteLine(Provider.Copy(lo));
System.Console.WriteLine(Provider.Copy(hi));
System.Console.WriteLine(Provider.Widen((byte)255));
}`), { libraries: [visualBasic] });
    for (const consumer of [csConsumer, vbConsumer]) {
      assert.deepEqual(await execute(consumer), [String(min), String(max), '255']);
      const procedures = Object.values(consumer.programMap.procedures);
      assert.ok(procedures.some(procedure => procedure.returnType === type
        && procedure.parameterTypes[0] === type));
    }
    assert.throws(() => compileCsharpToPcode(cs('static void Main() { int n=1; Provider.Copy(n); }'),
      { libraries: [visualBasic] }), /Cannot use 'int'/);
    assert.throws(() => compileVb11ToPcode(vb(`Sub Main()
Dim n As Integer=1
Provider.Copy(n)
End Sub`), { libraries: [csharp] }), /Cannot use 'int'/);
    const checkedConsumer = compileVb11ToPcode(vb(`Sub Main()
Dim n As Integer=${max + 1}
Console.WriteLine(Provider.Copy(${cast}(n)))
End Sub`), { libraries: [csharp] });
    await assert.rejects(execute(checkedConsumer), /OverflowException/);
  }
});

test('overloaded providers export concrete signatures to the other language without ambiguous binding', async () => {
  const providers = [
    {
      artifact: compileCsharpToPcode(cs(`public static int Copy(int x) { return x + 1; }
public static string Copy(string x) { return x + "!"; } static void Main() {}`)),
      signature: 'Program.Copy',
      consume: library => compileVb11ToPcode(vb(`Sub Main()
Console.WriteLine(Provider.Number(41))
Console.WriteLine(Provider.Text("001"))
End Sub`), { libraries: [library] }),
    },
    {
      artifact: compileVb11ToPcode(vb(`Function Copy(x As Integer) As Integer
Return x + 1
End Function
Function Copy(x As String) As String
Return x & "!"
End Function
Sub Main()
End Sub`)),
      signature: 'program.copy',
      consume: library => compileCsharpToPcode(cs(`static void Main() {
System.Console.WriteLine(Provider.Number(41)); System.Console.WriteLine(Provider.Text("001")); }`),
      { libraries: [library] }),
    },
  ];
  for (const { artifact, signature, consume } of providers) {
    assert.throws(() => createScalarLibrary(artifact, {
      id: 'Provider', version: '1.0.0', exports: { Copy: signature },
    }), /use a signature or label/);
    const library = createScalarLibrary(artifact, {
      id: 'Provider', version: '1.0.0',
      exports: { Number: `${signature}\`0(int)`, Text: `${signature}\`0(string)` },
    });
    assert.deepEqual(await execute(consume(library)), ['42', '001!']);
  }
});

test('overload accessibility excludes private candidates without hiding public overloads', async () => {
  const csharp = compileCsharpToPcode(`class H {
private static int F(int x) { return x; } public static string F(string x) { return x; } }
class P { static void Main() { System.Console.WriteLine(H.F("public")); } }`);
  assert.deepEqual(await execute(csharp), ['public']);
  const visualBasic = compileVb11ToPcode(`Imports System
Module H
Private Function F(x As Integer) As Integer
Return x
End Function
Public Function F(x As String) As String
Return x
End Function
End Module
Module P
Sub Main()
Console.WriteLine(H.F("public"))
End Sub
End Module`);
  assert.deepEqual(await execute(visualBasic), ['public']);
  assert.throws(() => compileCsharpToPcode(`class H {
private static void F(int x) {} private static void F(bool x) {} }
class P { static void Main() { H.F(1); } }`), /inaccessible/);
});

test('scalar overload selection is independent of declaration order in both frontends', async () => {
  const csharpMethods = [
    'static string F<T>(T x, T y) { return "general"; }',
    'static string F<T>(T x, int y) { return "specific"; }',
  ];
  const vbMethods = [
    'Function F(Of T)(x As T,y As T) As String\nReturn "general"\nEnd Function',
    'Function F(Of T)(x As T,y As Integer) As String\nReturn "specific"\nEnd Function',
  ];
  for (const reverse of [false, true]) {
    const csOrder = reverse ? [...csharpMethods].reverse() : csharpMethods;
    const vbOrder = reverse ? [...vbMethods].reverse() : vbMethods;
    assert.deepEqual(await execute(compileCsharpToPcode(cs(
      `${csOrder.join('\n')} static void Main() { System.Console.WriteLine(F(1,2)); }`
    ))), ['specific']);
    assert.deepEqual(await execute(compileVb11ToPcode(vb(
      `${vbOrder.join('\n')}\nSub Main()\nConsole.WriteLine(F(1,2))\nEnd Sub`
    ))), ['specific']);
  }
});

test('concrete ABI wrappers retain generic helpers across both language directions', async () => {
  const sources = [
    {
      compile: compileVb11ToPcode,
      source: vb('Function Id(Of T)(x As T) As T\nReturn x\nEnd Function\nFunction Copy(x As String) As String\nReturn Id(x)\nEnd Function\nSub Main()\nEnd Sub'),
      method: 'program.copy', generic: 'program.id',
      consume: library => compileCsharpToPcode(cs('static void Main() { System.Console.WriteLine(Provider.Copy("001")); }'), { libraries: [library] })
    },
    {
      compile: compileCsharpToPcode,
      source: cs('public static T Id<T>(T x) { return x; } public static string Copy(string x) { return Id(x); } static void Main() {}'),
      method: 'Program.Copy', generic: 'Program.Id',
      consume: library => compileVb11ToPcode(vb('Sub Main()\nConsole.WriteLine(Provider.Copy("001"))\nEnd Sub'), { libraries: [library] })
    }
  ];
  for (const item of sources) {
    const artifact = item.compile(item.source);
    const library = createScalarLibrary(artifact, { id: 'Provider', version: '1.0.0', exports: { Copy: item.method } });
    assert.deepEqual(await execute(item.consume(library)), ['001']);
    assert.throws(() => createScalarLibrary(artifact, {
      id: 'Provider', version: '1.0.0', exports: { Id: item.generic }
    }), /Generic specializations cannot be exported/);
  }
});

test('both frontends enforce the exact shared specialization capacity', () => {
  const argumentsFor = index => Array.from({ length: 5 }, (_, digit) =>
    ['1', 'true', '"text"'][Math.floor(index / 3 ** digit) % 3]).join(', ');
  const languages = [
    {
      compile: compileCsharpToPcode,
      source: count => cs(`static A First<A,B,C,D,E>(A a,B b,C c,D d,E e) { return a; }
static void Main() { ${Array.from({ length: count }, (_, i) => `First(${argumentsFor(i)});`).join('\n')} }`)
    },
    {
      compile: compileVb11ToPcode,
      source: count => vb(`Function First(Of A,B,C,D,E)(x As A,y As B,z As C,u As D,v As E) As A
Return x
End Function
Sub Main()
${Array.from({ length: count }, (_, i) => `First(${argumentsFor(i)})`).join('\n')}
End Sub`)
    }
  ];
  for (const language of languages) {
    const artifact = language.compile(language.source(127));
    assert.equal(Object.keys(artifact.programMap.procedures).length, 128);
    assert.throws(() => language.compile(language.source(128)), /specialization capacity exceeded \(128 procedures\)/);
  }
});
