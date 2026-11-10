# Kotlin to p-code

The ANTLR 4 grammar in [Kotlin.g4](grammar/Kotlin.g4) defines Kotlin syntax.
The frontend lowers a deliberately bounded subset through the shared scalar
compiler to P-code. The initial target is the JavaScript P-machine for local
validation, with generic-native and opt-in ESP32 tests for the same cases.
This is not full Kotlin/Core conformance.

### Conformance architecture

The JetBrains compiler is organized around a frontend and backend split:
current K2/FIR analysis lives under `compiler/fir`, legacy K1 analysis under
`compiler/frontend`, and shared backend IR under `compiler/ir` is lowered for
each target. This project follows the same boundary at a smaller scale:
ANTLR parsing and scalar semantic checks form the frontend, the shared scalar
compiler lowers into target-neutral P-code, and the JavaScript, native, and
ESP32 P-machines are execution targets. The JetBrains compiler's
[`compiler/testData`](https://github.com/JetBrains/kotlin/tree/master/compiler/testData)
is a semantic oracle and regression source, not a promise that every Kotlin
feature can run on this P-code target.

The corpus is deliberately kept outside this repository because upstream
fixtures retain their original JetBrains licensing and bytes. Build the pinned
local corpus and verify its hashes with:

```powershell
Set-Location languages\kotlin
npm ci
npm run fetch:upstream -- C:\kotlin-testData
$env:KOTLIN_CORPUS_ROOT = 'C:\kotlin-testData'
node scripts\test-upstream.mjs --supported
node scripts\inventory-corpus.mjs C:\kotlin-testData C:\reports\kotlin-inventory.json
```

At the pinned revision, all 66 supported cases pass on the JavaScript P-machine;
diagnostic cases are compiler-only. The class/object cases use the bounded
stateless object ABI, and nullable values are erased only for the exercised
non-null receiver path. The supported
`kotlin.test.assertEquals` implementation is backed by a shared runtime
failure binding; it must not print or return success on a mismatch.

The upstream compiler's current FIR/IR architecture is useful guidance, but
the reproducibility source remains the pinned revision in
`tests/upstream-cases.mjs`; `master` is not used for fixture hashes.

Compiled artifacts now carry the additive P-machine ABI descriptor
`pulse.pmachine` version 1, including the opcode-manifest version and feature
set. Existing artifacts without this field remain accepted for compatibility;
artifacts with an unknown ABI version are rejected explicitly by the
JavaScript runtime instead of being executed against an incompatible machine.

Supported constructs currently include top-level functions, scalar `Byte`,
`Short`, `Int`, `Boolean`, and `String` parameters and returns, inferred or explicit local
`val`/`var` declarations, arithmetic and boolean expressions, assignments,
function calls, trailing positional default parameters, `print`/`println`,
string templates, `String.length`, `if`, `while`, `do`/`while`, unlabeled `break` and
`continue`, inclusive and exclusive integer ranges in `for` loops, and `if` expressions whose
branches each contain a single scalar expression. Subject `when` expressions
support scalar equality and integer range conditions, comma-separated
alternatives, and a required final `else`; their subject must be a local value or
literal so evaluation occurs without side-effecting subject expressions or
hidden mutable state. Statement-form `when` supports arbitrary single-evaluation
subjects, subjectless boolean conditions, branch blocks, and an optional final
`else`. Type conditions and branch declarations that require unsupported syntax
remain unsupported. Unsupported syntax or semantics are rejected rather than
silently translated.

Scalar expressions also support Kotlin's null-coalescing Elvis operator
(`left ?: fallback`). The left operand is evaluated once and the fallback is
evaluated only when the left value is zero/null in the current bounded
reference representation.

The non-null assertion operator (`!!`) is lowered through the shared
`system.reference.notnull` intrinsic. A failed assertion is reported as an
explicit `NullPointerException` by both JavaScript and ESP32 runtimes; it is
not silently erased.

`throw` lowers through `system.exception.throw` and reports an explicit
runtime failure. Catchable exception frames and `try`/`catch` unwinding are
not yet implemented; catch blocks with executable bodies are rejected until
the P-machine exception-frame ABI is added. Empty, unreachable catch bodies
are accepted for control-flow compatibility. Throw expressions are treated as
non-returning (`Nothing`-like) for return-path analysis.
They can therefore occupy the non-value branch of a value-producing `if`
expression. Active `finally` blocks are emitted before an uncaught throw;
`return`, `break`, and `continue`; catchable unwinding remains pending.

### Bounded Kotlin standard-library compatibility

The supported scalar APIs retain Kotlin names and behavior:
`Int.MIN_VALUE`/`MAX_VALUE`, integer `toByte()`/`toShort()`/`toInt()`,
scalar `toString()`, and `String.length`. Narrowing keeps the low bits and
`Boolean.toString()` uses lowercase text. String parsing such as `"42".toInt()`
is not implemented; invalid receiver types and unsupported calls are diagnosed.
String length counts UTF-16 code units, not native UTF-8 bytes, through the
stateless `system.string.length` library intrinsic. This subset requires
well-formed Unicode; isolated surrogates and malformed native UTF-8 fail explicitly.

Templates support `$name` and `${expression}`, including nested quoted strings,
using the generated grammar for expression parsing. Escaped dollars stay literal.
Trailing positional defaults may refer to earlier parameters and are evaluated
once, in parameter order, after explicit arguments. They lower to ordinary P-code
overloads; named arguments, non-trailing defaults and signatures colliding with
these generated overloads remain unsupported.

Scalar membership supports `in`/`!in` with `..` and `..<`. Range endpoints are
evaluated once, before the membership value, as Kotlin specifies. Inclusive
`for` loops terminate safely at `Int.MAX_VALUE`, including on `continue`;
exclusive loops use an exclusive upper-bound test and avoid incrementing after
the final `Int.MAX_VALUE - 1` element. Int arithmetic wraps, including
`Int.MIN_VALUE / -1`; division by zero remains an explicit runtime error.
The wrapping division/remainder helpers are library bindings, not Kotlin opcodes.
Reference-typed subjects can also match `null` explicitly in `when` branches.
Nullable locals and parameters (`String?`, `Int?`, and `Boolean?`) may hold
`null` and use Elvis fallback; nullable return types and nullable scalar
operations remain pending the tagged reference-value ABI. Nullable string functions may return
`null`, and callers can consume them with Elvis. Passing `null` to a
non-nullable parameter or returning it from a non-nullable function remains a
compile-time error. Direct `.length` access on a nullable string is rejected;
use `text!!` when the caller has established non-nullness. A direct
`text != null`/`text == null` branch also performs bounded smart-cast
refinement for the protected branch. Known non-null assignments to mutable
nullable locals preserve that refinement; null or unknown nullable assignments
clear it.
Arithmetic and concatenation on nullable values are rejected until a null
check or smart-cast establishes non-nullness.
The P-machine ABI advertises the additive `null.value` and `reference.heap`
features and emits `PUSH_NULL`; legacy integer-zero null artifacts remain
executable for compatibility. `reference.heap` uses the shared tagged-reference
contract: handle zero is null, object/array/callable are distinct reference
kinds, and handles are bounded 16-bit values. Heap-backed references are
bounded by the target's managed-object capacity and are not yet exposed as
general Kotlin stateful classes or collections.

No Kotlin interpreter, scheduler state, persistent buffers or production
concurrency-limit changes are introduced. Defaults use procedure-local storage
and the existing 128-procedure compilation bound. Library operations are
stateless; string length scans the input without allocating a converted copy.

The shared JavaScript scheduler tests run compiled Kotlin, C# and VB programs
on one execution slot, checking instruction-quantum fairness, procedure-state
isolation, cancellation isolation and slot reuse. Run them from the repository
root with `node --test virtualMachines\esp32\testing\pmachines\virtual-scheduler.test.mjs`.
This is host-scheduled program concurrency, not Kotlin `launch`/`async`, C#/VB
task creation or mixed-language shared-memory synchronization. Those APIs are
not implemented by this test, and it does not establish ESP32 scheduling parity.

### Coroutine and process boundary

The first coroutine slice is available through
`import kotlinx.coroutines.yield`: `yield()` releases the current JavaScript
P-machine execution slot and resumes through the scheduler. It is cooperative
and bounded; it is not yet a full Kotlin continuation implementation, and
`launch`, `async`, `await`, `runBlocking`, `CoroutineScope`, channels, and
structured cancellation remain unsupported. On ESP32, the intrinsic calls the
Arduino/FreeRTOS cooperative yield hook so other native tasks can run; it does
not yet create Kotlin continuation objects or provide `launch`/`async`
semantics.

Kotlin/JVM process APIs such as `ProcessBuilder` are intentionally unavailable
on the ESP32 target. A future portable child-execution API must be implemented
as bounded P-machine fibers rather than unrestricted operating-system process
creation. Unknown coroutine or process imports are rejected explicitly.

Not implemented include general stateful objects beyond scalar constructor
properties and generated getters, generic class state,
nullable/reference
types, floating point, multiline strings, exceptions, collections, lambdas,
and Kotlin library or Java interoperability. Kotlin syntax parsing by itself
does not provide language interoperability.

### Generic functions

Top-level generic functions can use unconstrained type parameters in scalar
parameters, return types and local variables. Calls accept explicit type
arguments or infer them from arguments; forwarding and recursion are supported.
For example:

```kotlin
fun <T> identity(value: T): T = value
fun <T> forward(value: T): T = identity<T>(value)
fun main() {
  println(forward(42))
  println(identity<String>("hello"))
}
```

The compiler emits a separate P-code procedure for each concrete combination
of `Byte`, `Short`, `Int`, `Boolean` and `String`, reusing identical specializations. No generic
runtime or P-machine changes are required for this subset. The shared backend
limits a compilation to 128 total specialized and non-generic procedures.
`Byte` and `Short` use signed 8- and 16-bit representations. Integer constants
must fit their declared type, and implicit widening between numeric variables
is rejected. Narrowing arithmetic such as `Byte` increment emits the existing
`system.integer.convert` intrinsic; it is unavailable in hosted services,
which reject programs requiring it.

Type bounds, `where` constraints, variance, reified type parameters, generic
classes, nullable or nested generic types, generic varargs, star projections,
and inference from an expected return type are not supported. Type arguments
must be in scope; inference requires matching types for repeated occurrences of
a type parameter. Generic values can be printed, appended to a string,
and compared for equality when both operands have the same type parameter.
Other operations on an unconstrained type parameter remain unsupported.
Expression-bodied functions may
infer their return type only for the frontend's supported expression forms;
use an explicit return type where inference is unavailable. Generic functions
may be called by service handlers, but a handler itself must not be generic.

## HTTP services

The service subset supports top-level, no-argument `String` handlers
marked with `@HttpGet`, `@HttpPost`, `@HttpPut`, `@HttpPatch`, `@HttpDelete`,
`@HttpHead`, or `@HttpOptions`. Return a **valid JSON document as a string**: the
JavaScript and ESP32 service hosts both serve JSON responses, and arbitrary
plain-text return values are not portable. The handler may call other
supported Kotlin functions. See [http-service.kt](examples/http-service.kt).

`@HttpGet` is recognized by the P-code compiler. Its source-only annotation is
also supplied in [HttpGet.kt](libraries/pulse/http/HttpGet.kt) for projects
that use standard Kotlin tooling. It is not a networking library or a Java
dependency; the P-machine host provides HTTP transport.

Compile a service and its program map:

```powershell
npm run compile -- examples\http-service.kt build\http-service.pcode --target esp32 --service-id kotlin_service
```

Services cannot declare `main`; each handler must take no arguments and return
`String`. Routes must be `/health` or start with `/api/`, and service IDs
must start with a letter or underscore and contain only letters, digits,
underscores, dots, or hyphens. The service ID defaults to the source file's
base name. Duplicate routes and overloaded handlers are rejected. The hosted
runtime does not yet support the scalar `system.int32` library calls used by
division, remainder and integer-to-string conversion, so service programs
requiring those calls are rejected at compile time. Outbound HTTP/HTTPS,
Kotlin's standard networking libraries and coroutines are not yet supported.

Service handlers can import `pulse.http.*` for `requestBody()`,
`requestMethod()`, `requestPath()`, `requestPeer()`, `requestQuery(name)`, and
`requestHeader(name)`. Header names are case-insensitive. Values come from the
current host event. These functions are available only in services. Additional
HTTP methods and headers require firmware built with the corresponding service
host changes; older deployed firmware supports only GET/POST and does not
provide `requestHeader`. ESP32 ingress limits request bodies to 2048 bytes and
requires JSON for nonempty non-GET bodies.

The `pulse.net.*` library exposes `tcpExchange` and `udpExchange` for hosted
services. Both require an explicitly configured IP-and-port `networkPeers`
allowlist, literal IPv4 addresses, a timeout of 1–2000 ms and a response limit
of 1–4096 bytes. Request and response bytes are hexadecimal strings. TCP
uses length-prefixed responses with a 1–4 byte big-endian prefix; its returned
hex includes the prefix. These are bounded exchanges, not general-purpose
socket streams, and do not provide HTTP or TLS.

## Generate, compile, and test

Install the package dependencies once:

```powershell
Set-Location languages\kotlin
npm ci
npm run antlr:generate
npm test
```

ANTLR generation and the grammar smoke tests require Java and the repository's
ANTLR 4.13.2 jar.

Compiler cases link to the relevant Kotlin/Core specification chapters for
expressions, declarations, and control structures. The curated execution
cases cover arithmetic, strings, short-circuit evaluation, functions and
recursion, mutations, and control-flow boundaries; separate rejection cases
cover invalid programs and unsupported features. They test only the
implemented subset and are not the Kotlin project's full PSI/diagnostics suite.
The Kotlin specification's grammar-suite
overview describes those broader parser corpora:
[Kotlin/kotlin-spec grammar tests](https://github.com/Kotlin/kotlin-spec/tree/release/grammar).

### JetBrains compiler corpus

The optional upstream suite uses original files from
[JetBrains/kotlin](https://github.com/JetBrains/kotlin) at commit
`d17db9fd646aae75c55e67745f954c67f2e03e33`. The upstream repository's
[licensing information](https://github.com/JetBrains/kotlin/blob/d17db9fd646aae75c55e67745f954c67f2e03e33/license/README.md)
applies to the downloaded fixtures; they are not redistributed here.
The manifest pins each file's SHA-256. A checkout must retain the original
bytes (including line endings), or the integrity check fails.

To fetch the selected files into a separate directory, then run the supported
regressions:

```powershell
npm run fetch:upstream -- C:\kotlin-testData
$env:KOTLIN_CORPUS_ROOT = 'C:\kotlin-testData'
npm run test:upstream
```

Alternatively, set `KOTLIN_CORPUS_ROOT` to `compiler\testData` inside an
upstream checkout at the pinned revision. With the variable set, `npm test`
also includes the supported upstream cases. Without it, that portion is
explicitly skipped; the remaining tests require no network.

The manifest currently pins 2,047 cases, not a statistically representative
sample or a Kotlin conformance score: the original 47 hand-selected cases
(forty codegen `box()` programs and seven negative diagnostics) plus the first
2,000 unpinned `codegen/box` files in deterministic path order, added by
`scripts/expand-upstream.mjs` and classified honestly (`supported`,
`failing`, `rejected`, or `blocked`). The current classification
(`reports/upstream-reclassified.json`) has 59 supported `box()` programs,
1,665 rejected by the compiler's subset with located diagnostics, and 316
needing multi-file/module harness features.
The runner appends only
an entry point that prints the original `box()` result and requires exactly
`OK`; it strips upstream diagnostic markup while retaining line numbers and
checks the first `VAL_REASSIGNMENT` diagnostic's category and line. It does
not compare later diagnostics, exact spans, warnings, or full Kotlin diagnostic
codes. Fixtures with multiple files, backend directives requiring special
handling, or external dependencies are not adapted.

To run **all** selected cases:

```powershell
npm run audit:upstream
```

The audit verifies every non-blocked classification: supported cases must pass,
and rejected/failing cases must still not pass — a case that now passes is
reported as a pending manifest upgrade and fails the audit until reclassified.
The current certified result is 66 of 66 supported cases on the JavaScript
P-machine. A parser or unsupported feature error is not counted as an expected
diagnostic.

To pin the next batch in deterministic order (listing from the pinned
revision's `codegen/box` tree), classify it, and regenerate the manifest:

```powershell
node scripts\expand-upstream.mjs C:\kotlin-testData C:\kotlin-testData\box-listing.json 2000 reports\upstream-batch-2000.json
```

After a compiler change, re-run classification for every pinned `box()` case
and regenerate statuses and reasons in place:

```powershell
node scripts\expand-upstream.mjs C:\kotlin-testData --reclassify reports\upstream-reclassified.json
```

### Direct-style coroutine subset

The compiler accepts `suspend` function modifiers, `suspend (T...) -> R`
function types on parameters, trailing lambdas with declared parameters bound
from the function type (including the `f<Type> { ... }` single-type-argument
form and `_` placeholders), and the upstream test helpers
`EmptyContinuation`, `handleResultContinuation { ... }` and
`Continuation(context) { ... }`. Functions with function-typed parameters are
compile-time inline templates: each call site is specialized with its lambda
arguments, so lambda bodies execute in the caller's frame and captured locals
(including mutable ones) are ordinary variables. `c.startCoroutine(k)` lowers
direct-style — it runs the suspend body synchronously to completion, then the
continuation body. Receiver function types (`suspend Controller.() -> Unit`)
are supported through the two-argument `c.startCoroutine(receiver,
continuation)` form: the receiver is bound once to a synthetic local, and bare
member references in the lambda body resolve through it. Classes may declare
mutable member properties with scalar literal initializers (or explicit scalar
types); reads lower to synthesized getters and writes — including compound
writes and implicit-receiver writes — lower to synthesized setters.
`run { ... }` blocks inline in statement position. The resume-immediately
intrinsic form
`suspendCoroutineUninterceptedOrReturn { k -> effects; k.resume(v);
COROUTINE_SUSPENDED }` delivers its value before suspending upstream, so it
lowers exactly to the side effects followed by `v`; the continuation must be
resumed immediately and must not escape. `kotlinx.coroutines.yield` remains
the cooperative scheduler release.

This is not a continuation-passing transform: intrinsic lambdas that do not
end in an immediate `resume(value)`/`COROUTINE_SUSPENDED` pair, other
suspension intrinsics (`suspendCoroutine` and related), exception
continuations, receiver lambdas invoked outside `startCoroutine`,
member methods that read their own fields through an implicit `this`,
non-local returns
from lambdas, returns inside loops of inlined builders, recursive builders,
and function-typed return values are all rejected with located diagnostics.
`throw RuntimeException(...)`-style constructors lower to real runtime faults
only outside `try` blocks with catch handlers, because this runtime cannot
intercept faults; inside them they stay unsupported rather than miscompiling.

#### Libraries and P-machine implications

`factorialTest.kt` needs `kotlin.test.assertEquals`. A correct `assertEquals` must report a
failed assertion, including when called inside another function; a library
that prints a message or returns success would not be equivalent. This
compiler currently has no Kotlin exception support, so no partial replacement
is provided. Generic `kotlin.test` and collections still need additional frontend and object
semantics support before ordinary library implementations can be linked.

Templates, trailing defaults, range membership and inclusive-loop boundaries
are implemented in the compiler; UTF-16 length and wrapping division/remainder
use the shared System library. The existing generic library dispatcher is
unchanged. Catchable exceptions and
stack unwinding need runtime support unless an equivalent mechanism is found;
objects, collections, floating point and string operations require checking
the existing JS and ESP32 representations and opcodes for semantic and target
parity before deciding whether further P-machine changes are needed. In particular,
the ESP32 hosted runtime currently lacks the scalar external bindings noted
above. These remaining prerequisites are not implemented by the scalar library.

### Unified inventory and execution reports

```powershell
npm run inventory:upstream -- C:\kotlin-testData C:\reports\kotlin-inventory.json
npm run validate -- js C:\reports\kotlin-js.json
npm run validate -- native C:\reports\kotlin-native.json
$env:PULSE_ESP32_TEST_URL = 'http://192.168.2.83'
npm run validate -- esp32 C:\reports\kotlin-esp32.json
```

Create the report directory first. Inventory scans original files, distinguishes
verified hashes from unverified candidates, and records the first observed
rejection or infrastructure blocker. Compilation candidates are not passes.
Execution reports include spec outputs, pinned upstream hashes, failures and
blocked reasons. Diagnostic cases are explicitly compiler-only on every target.
Known gaps stay visible; a nonzero exit code indicates unexpected validation
failure. Missing corpus configuration is reported as blocked, not as a corpus pass.

Native validation requires `g++` and the generic builder's existing ArduinoJson
headers. It builds the shared native runner once per invocation and cleans up
temporary files. For repeated runs, build once and select that executable:

```powershell
npm run build:native -- C:\reports\kotlin-runner.exe
$env:PULSE_KOTLIN_NATIVE_RUNNER = 'C:\reports\kotlin-runner.exe'
npm run validate -- native C:\reports\kotlin-native.json
```

Rebuild a selected executable after native runtime/library changes. No silent
fallback to JavaScript or stale-binary rebuild is performed.

To run the same positive cases on an accessible ESP32 P-machine:

```powershell
$env:PULSE_ESP32_TEST_URL = 'http://192.168.2.83'
npm run test:esp32
```

The hardware test sends signed P-code and program maps to the device's
`/pmachine/execute_json` endpoint and checks output and runtime errors. It
executes programs on the live node; it does not flash firmware or persist test
files. Select a node where running these tests is appropriate. Signing uses the
repository's standard `PCODE_SIGNING_KEY` and `PCODE_SIGNING_KEY_ID`
environment settings when configured. The ordinary `npm test` does not require
hardware. Device execution is sequential and checks both PMachine and service-host
idle status before and after the run, using bounded, non-persistent HTTP requests
without retrying uncertain writes. It requires firmware containing System 0.3.2.

To install the example service temporarily and test real HTTP requests:

```powershell
$env:PULSE_ESP32_TEST_URL = 'http://192.168.2.83'
npm run test:esp32:service
```

This separate, opt-in test requires an idle ESP32 service host. It uploads
signed paged images for the Kotlin service and an idle Pascalish daemon
(currently required by the ESP32 installation API), starts the host, sends
HTTP requests, then stops the host and removes its test files. It refuses to
replace a running service host. Sufficient free device heap is required.

Compile a source file to P-code and a companion program map:

```powershell
npm run compile -- examples\hello.kt build\hello.pcode
```

The resulting P-code can be run with the JavaScript P-machine.
