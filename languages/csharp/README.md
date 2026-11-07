# Pulse C# to p-code

An original compiler for a deliberately bounded ECMA-334-based C# subset,
targeting the JavaScript p-machine. This is not a full C# implementation,
a .NET CLR, or an ECMA-certified compiler. The shared
[ESP32 hardware tests](../dotnet/README.md#esp32-runtime-validation) validate a
numeric/scalar subset on updated firmware; this is not blanket Arduino
certification, and ESP32 execution is not enabled in the editor.

Requires Node.js 22 or newer and this repository checkout. Run `npm ci` to
install the ANTLR runtime; no .NET SDK is required. Syntax is defined in
[Csharp.g4](grammar/Csharp.g4) and lowered from its generated ANTLR parse tree.
The compiler uses the shared
[System library contract](../dotnet/README.md) and existing p-machine
procedure frames rather than a separate C# interpreter.

The scalar semantic analyzer and p-code emitter now live in
[dotnet](../dotnet/README.md) and are shared with VBish's `vb11` profile.
The optional `libraries` compilation option accepts typed scalar p-code
libraries, including exports compiled from VBish. The shared adapter validates
signatures, explicit versions and target capabilities; it does not load CLR
assemblies. C# defaults to unchecked nonconstant Int32 arithmetic; explicit
checked contexts are preserved by the shared backend.

The API also accepts `target: 'esp32'` for native scalar execution and checks
imported libraries against that target. The CLI and editor still default to
JavaScript. [The GPIO48 LED example](examples/board-led.cs) uses the shared
[device ABI adapter](../dotnet/README.md#esp32-named-device-library), with
three-second on/off intervals in red, green and blue, configurable intensity
(0..255), and explicit off/close cleanup.

## Compile and run

From this directory:

```powershell
npm ci
npm test
npm run compile -- examples\generics.cs build\generics.pcode
node ..\..\virtualMachines\esp32\pmachines\javascript\run.mjs --pcode build\generics.pcode --program-map build\generics.program.json --message ""
npm run validate
```

Grammar changes must be made in [Csharp.g4](grammar/Csharp.g4), then regenerated
with `npm run antlr:generate`. Generation uses Java and the repository's ANTLR
4.13.2 jar through the [shared generator](../dotnet/generate-parser.mjs).
Do not edit generated parser files directly.

The CLI writes p-code and a companion `.program.json` containing procedures,
globals, library requirements and instruction-to-source mappings. Invalid
source produces a diagnostic with file, line and column and a failing exit code.
The legacy aggregator CLI forwards to the same compiler.

```javascript
import { compileCsharpToPcode } from './src/compile-csharp-to-pcode.mjs';
const artifact = compileCsharpToPcode(source, { fileName: 'Program.cs' });
// artifact.pcodeText and artifact.programMap are consumed by the JS p-machine.
```

In VS Code, install the combined Pulse Studio & PMachine Debugger extension,
use **Pulse: New Language Document**, select C#, and save the document as `.cs`.
**Run on PMachine** compiles and executes it; a `pulse-pmachine` launch with
`runtime: "js"` supports source breakpoints, stepping and variable inspection.
The web compiler editor is available at `/csharp`.

## Implemented subset

- ASCII identifiers (including escaped identifiers), comments, decimal Int32
  literals, booleans, regular/verbatim strings and string escapes.
- `using System`, block namespaces and classes containing static methods.
- `sbyte`, `byte`, `short`, `ushort`, `int`, `bool` and `string` locals and
  by-value parameters; `void` or scalar
  method returns; `void Main()` and `int Main()`.
- Typed declarations, assignments, compound assignments, prefix/postfix
  increments, arithmetic, relational/equality operators, string concatenation,
  short-circuit `&&`/`||`, `!`, and `?:`.
- Blocks, `if`/`else`, `while`, `do`/`while`, `for`, `break`, `continue`, and
  `return`; static calls and recursion.
- `System.Console.Write` and `WriteLine` for scalars, with C# boolean display.
- Generic static methods with explicit arguments, exact-type inference,
  forwarding, recursion and cached concrete specializations.
- Scalar static overloads selected by argument count/types and generic arity,
  with accessibility checks, nongeneric/specific-parameter preference and
  explicit ambiguity/duplicate-signature errors.
- Explicit integer casts, scalar identity casts using `(bool)` and `(string)`, and lexical
  `checked`/`unchecked` expressions and blocks.
- Integer widening and fitting Int32 constant conversions in declarations,
  assignments, returns and calls; conversion-aware overload selection.
  Small-width arithmetic promotes to Int32; casts, increments and compound
  assignments narrow using the enclosing checked/unchecked policy.

```csharp
using System;
class Program
{
    static T Identity<T>(T value) { return value; }
    static void Main()
    {
        Console.WriteLine(Identity<int>(42));
        Console.WriteLine(Identity("inferred string"));
    }
}
```

Generic bodies are checked with symbolic type parameters before instantiation:
an unconstrained `T + T` is rejected even if one call happens to use `int`.
Specialization is limited to 128 emitted procedures per compilation. Inference
does not implement the complete C# conversions, overload-resolution or
constraint system.

Nonconstant integer addition, subtraction, multiplication, unary negation,
increments and compound assignments wrap by default and raise overflow faults
inside `checked` expressions/blocks. Nested `unchecked` contexts restore wrapping.
Constant overflow is rejected unless inside an `unchecked` context.
Overflow context is lexical; calling a method from `checked(...)` does not
change the arithmetic policy inside that method.
Division/remainder use explicit System intrinsics: zero divisors fault with
`System.DivideByZeroException`; runtime Int32 minimum divided by -1, or its
remainder by -1, faults with
`System.OverflowException`. These are JS runtime `RangeError`s, not catchable
C# exception objects. An integer Main result is exposed as `CS_EXIT_CODE`.

## Limits and validation

Not implemented: instance objects, fields, generic classes, constraints,
collections/arrays, complete conversion-based overload resolution, UInt32,
64-bit integers, floating point/decimal, noninteger nonidentity casts/conversions,
exceptions, LINQ, async, preprocessing or dynamic
p-code libraries. Unsupported constructs fail rather than silently being
translated into unrelated operations. Definite-assignment/return analysis is
conservative and does not implement all C# true/false flow-state rules.

The [validation suite](validation/README.md) separates supported
positive/negative/runtime tests from unsupported-feature probes. Its persistent
[JS validation report](reports/ecma334-js-validation.json) records exact
results, chapter coverage, resource limits and source/compiler/harness
fingerprints. Passing it is not evidence of full
standard conformance or hardware certification.

Semantics and clause references are based on the committee's
[standard-v7 specification text](https://github.com/dotnet/csharpstandard/tree/standard-v7/standard)
and Microsoft's language-specification mirror. The committee branch describes
its C# 7.0 submission/draft; clause references identify that reference text,
not a claim that every provision of a final ECMA edition is implemented.
