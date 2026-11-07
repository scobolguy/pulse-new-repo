# Kotlin to p-code

The ANTLR 4 grammar in [Kotlin.g4](grammar/Kotlin.g4) defines Kotlin syntax.
The frontend lowers a deliberately bounded subset through the shared scalar
compiler to P-code. The initial target is the JavaScript P-machine for local
validation, with an opt-in ESP32 hardware test for the same execution cases.
This is not full Kotlin/Core conformance.

Supported constructs currently include top-level functions, scalar `Byte`,
`Short`, `Int`, `Boolean`, and `String` parameters and returns, inferred or explicit local
`val`/`var` declarations, arithmetic and boolean expressions, assignments,
function calls, `print`/`println`, `if`, `while`, unlabeled `break` and
`continue`, and inclusive integer ranges in `for` loops, and `if` expressions whose branches each contain a single
scalar expression. Unsupported syntax or semantics are rejected rather than
silently translated.

Not implemented include classes and objects, generic classes, nullable/reference
types, floating point, string templates, exceptions, collections, lambdas,
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

The manifest currently selects 25 cases, not a statistically representative
sample or a Kotlin conformance score. Fourteen supported cases comprise seven
codegen `box()` programs and seven negative diagnostics. The runner appends only
an entry point that prints the original `box()` result and requires exactly
`OK`; it strips upstream diagnostic markup while retaining line numbers and
checks the first `VAL_REASSIGNMENT` diagnostic's category and line. It does
not compare later diagnostics, exact spans, warnings, or full Kotlin diagnostic
codes. Fixtures with multiple files, backend directives requiring special
handling, or external dependencies are not adapted.

To run **all** selected cases, including known gaps:

```powershell
npm run audit:upstream
```

The audit returns a nonzero exit code when any case fails; the current
baseline is 14 of 25. The remaining cases exercise, among other things,
string templates, ranges, nullable types, classes,
generic varargs, default arguments and exception handling. A parser or unsupported
feature error is not counted as an expected diagnostic.

#### Libraries and P-machine implications

`factorialTest.kt` needs `kotlin.test.assertEquals`. A correct `assertEquals` must report a
failed assertion, including when called inside another function; a library
that prints a message or returns success would not be equivalent. This
compiler currently has no Kotlin exception support, so no partial replacement
is provided. Generic `kotlin.test`, collections, and ranges also need
additional frontend and object semantics support before ordinary library
implementations can be linked.

Several observed gaps can be addressed in the grammar/compiler or libraries
without necessarily changing the P-machines: multiline control bodies,
conditional expressions, templates, default parameters, loop exits and
scalar range operations. Library implementations should use existing P-code
operations where they preserve Kotlin semantics. Catchable exceptions and
stack unwinding need runtime support unless an equivalent mechanism is found;
objects, collections, floating point and string operations require checking
the existing JS and ESP32 representations and opcodes for semantic and target
parity before deciding whether P-machine changes are needed. In particular,
the ESP32 hosted runtime currently lacks the scalar external bindings noted
above. These are engineering assessments, not evidence that these features
have been implemented or tested on hardware.

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
hardware.

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
