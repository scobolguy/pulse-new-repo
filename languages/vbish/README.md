# VBish

Canonical home of Pulse's VB-like p-code compiler.

- `src/`: ANTLR frontend and p-code compiler.
- `grammar/Vbish.g4`: source grammar; `grammar/generated/`: checked-in JavaScript parser.
- `examples/`: small source programs.
- `tests/`: compiler metadata and JavaScript p-machine execution regressions.
- `scripts/`: parser generation.

From this directory:

```powershell
npm ci
npm test
npm run antlr:generate
```

Parser regeneration requires Java and the existing ANTLR 4.13.2 jar under
`virtualMachines/esp32/aggregator/tools` at the repository root.

```javascript
import { compileVbishToPcode } from './src/compile-vbish-to-pcode.mjs';
const artifact = compileVbishToPcode(source, { fileName: 'hello.vbs' });
```

The compiler still uses the aggregator's shared source-map helper. Full application
artifact integration remains in `aggregator/scripts/compile-interoperable-language.mjs`;
the JavaScript runtime remains in its current location pending runtime consolidation.
This is a repository-local package, not a standalone published compiler.

Aggregator integrations import the compiler here directly. The old aggregator
compiler and generated-parser entrypoints have been removed; legacy regression
script entrypoints still forward to the language tests.
No VBish syntax or runtime semantics were changed by this relocation.

The compiler records the same versioned
[System library identity](../dotnet/README.md) as the C# compiler in
`programMap.libraries`. This establishes a shared contract boundary; it does
not add .NET framework compatibility or change existing VBish `Print` semantics.

## Microsoft VB specification profile

The opt-in `vb11` profile uses Microsoft's published
[Visual Basic 11 specification](https://learn.microsoft.com/en-us/dotnet/visual-basic/reference/language-specification/)
as its reference. It is currently a scalar subset, **not full VB conformance**.
The default `pulse` profile remains backward compatible with existing Pulse
declarations, routing, systems and legacy `Print` behavior.

```javascript
const artifact = compileVbishToPcode(source, {
  fileName: 'Program.vb',
  profile: 'vb11',
  libraries: [] // Optional typed p-code libraries, not CLR assemblies.
});
```

Use standard modules, `Sub Main()`, typed Integer/Boolean/String locals and
value parameters, functions, multiline If/ElseIf, While, Do/Loop and For/Next.
`Imports System` enables Console shorthand. VB strings use doubled quotes,
not backslash escapes; identifiers are case-insensitive and may be bracketed.
`AndAlso`/`OrElse` short-circuit; Boolean `And`/`Or`/`Xor` are eager.
Int32 runtime arithmetic is checked. `&` concatenates scalar displays.
Explicit `CInt`, `CBool` and `CStr` conversions support identity conversions,
Boolean to Int32 (`True` becomes -1, `False` becomes 0), Int32 to Boolean
(nonzero becomes `True`), and Int32/Boolean to String. String parsing and
other numeric types are not yet supported. Conversions are defined in the
shared backend, with distinct integer types in the scalar ABI.

The scalar profile also supports `SByte`, `Byte`, `Short` and `UShort`, with
`CSByte`, `CByte`, `CShort` and `CUShort` checked conversions. Integer widening
and fitting constant conversions apply to declarations, assignments, returns
and calls. Small-width arithmetic retains VB's result-type and checked-overflow
rules, rather than inheriting C#'s Int32 promotion. Under the strict profile,
compound assignments reject implicitly narrowing result types; same-width
arithmetic checks overflow. Boolean conversions to unsigned types produce the maximum
value for `True`, and 0 for `False`. These types have distinct scalar ABI
signatures; values remain exact numeric values, not serialized strings.
`Print`/`Display` are explicitly retained Pulse extensions, not standard .NET
Console APIs.

Generic methods use the same symbolic checking and specialization backend as
C#: `Function Id(Of T)(value As T) As T`, with explicit calls such as
`Id(Of Integer)(42)` or exact inference such as `Id("text")`. Generic Subs,
forwarding, recursion, multiple type parameters and cached specializations
are supported. The shared limit is 128 emitted procedures, including Main.
Generic classes, constraints, full conversion-based inference and generic ABI
exports remain unsupported. Generic functions must explicitly return on every
path; default-initialized type-parameter locals and `Exit Function` returning
an implicit generic default are rejected rather than assigned a wrong value.
Scalar procedure overloads share C#'s resolver, while retaining VB
case-insensitive names and VB generic-specificity rules. They currently use
identity and enabled integer widening/constant conversions, with numeric
specificity rules, not the complete VB widening/narrowing system.

C# and this profile now share the semantic analyzer, p-code emitter, System
intrinsics, typed scalar library adapter and validation harness under
[dotnet](../dotnet/README.md). C# and VBish can call each other's exported scalar
procedures without translating values to strings. These artifacts currently
declare only JavaScript target support. The shared
[ESP32 hardware tests](../dotnet/README.md#esp32-runtime-validation) additionally
validate a numeric/scalar subset on updated firmware; this is not blanket
ESP32 certification or editor target enablement. Mono/CLR execution remains
uncertified.

Run the [specification validation suite](validation/README.md):

```powershell
npm run validate -- --jobs 4
```

All syntax changes must be made in [Vbish.g4](grammar/Vbish.g4), followed by
parser regeneration. The [shared work list](../dotnet/README.md#conformance-and-integration-work-remaining)
tracks full C# 7 and VB language conformance, all-language ABI adoption and
host Mono integration separately.
