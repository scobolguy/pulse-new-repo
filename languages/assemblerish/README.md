# Assemblerish

Assemblerish is a small, straight-line device-handler language. It compiles to
the existing Pulse PMachine P-code and targets both the JavaScript and ESP32
PMachines. It does not expose arbitrary GPIO operations, branches, loops, or
raw host calls. The source extension is `.asmish`.

```js
import { compileAssemblerish } from './compile.mjs';

const artifact = compileAssemblerish(sourceText, { fileName: 'handler.asmish' });
// artifact.pcodeText and artifact.programMap are ready for a PMachine.
```

Or compile a file to a JSON artifact:

```sh
node languages/assemblerish/compile.mjs --source handler.asmish --out handler.json
```

## Source format

Keywords and opcodes are conventionally uppercase. Blank lines and `#` or `;`
comments are ignored. A file has exactly one handler header, target, trigger,
zero or more device declarations, and one final `EVENT`. `END` is optional;
when present, it must be the last non-comment line.

```text
HANDLER button_relay
TARGET "/api/devices/button"
TRIGGER EDGE button FALLING DEBOUNCE 30
INPUT button PIN 4 PULLUP
RELAY lamp PIN 16 ACTIVE HIGH INITIAL 0
READ RAW button
NOT RAW
WRITE lamp RAW
EVENT button 1 RAW 0
END
```

Handler IDs match `[A-Za-z][A-Za-z0-9_-]{0,31}`. Targets are quoted paths
starting with `/`, at most 96 characters. Device and register names match
`[A-Za-z][A-Za-z0-9_]{0,31}`. Registers are inferred: `SET`, `READ`, and `DHT`
initialize them; use before initialization is a compile error. Operands that
take a value accept either a signed 32-bit integer or an initialized register.
`NOT register` replaces that register with its logical negation (0 or 1).
`HANDLER id` is the canonical declaration. `HEADER HANDLER id` remains
accepted as an alias for older drafts.

### Triggers and devices

```text
TRIGGER EDGE device FALLING|RISING|CHANGE DEBOUNCE milliseconds
TRIGGER TIMER milliseconds

INPUT name PIN n PULLUP|PULLDOWN|FLOATING
RELAY name PIN n ACTIVE HIGH|LOW INITIAL 0|1
PWMOUT name PIN n CHANNEL n HZ n BITS n INITIAL duty
DHT11 name PIN n
```

Pins are 0–48 and cannot be shared. ESP32-S3 reserved GPIOs 0, 3, 19, 20,
26–37, and 43–46 are rejected. At most eight devices may be declared.
Timer intervals are 50–86400000 ms. Debounce intervals are 1–2000 ms.
DHT11 is timer-only, permits at most one sensor/read per handler invocation,
and requires a period of at least 2000 ms. PWM channels
are unique and range from 0–7; frequencies are 1–40000 Hz; resolution is
1–16 bits. On ESP32, adjacent channel pairs share a timer; paired channels
must use matching frequency and resolution. Reserve both the output pins and
the shared PWM timer/channel pair before assigning outputs. Initial and
written duty must fit `0..(2^bits - 1)`.

### Instructions

```text
SET register integer
READ register input
NOT register
WRITE relay value
PWM pwmout duty
DHT valid_register temperature_register humidity_register sensor
EVENT event_name valid value auxiliary
```

`READ` returns the sampled electrical input level (0 or 1). `WRITE` takes a
logical relay level (0 inactive, 1 active); `ACTIVE LOW` is applied by the
device layer. `PWM` writes a statically range-checked duty. `DHT` puts the
`hal_dht_read` status in its first register and reads centi-degrees Celsius
and centi-percent into the other two. If a DHT11 is declared, its status
register must be passed as the final event's `valid` field.

The compiler emits `CALL_EXT device.*` operations using the shared device
binding contract. Every write and the final event discards its integer return
through `STORE_NAME __discard`. The last three P-code instructions are always
`CALL_EXT device.hal_event 5`, `STORE_NAME __discard`, `HALT`. A handler must
contain exactly one final `EVENT`; the compiler rejects all other/unknown
instructions, uninitialized registers, invalid device references, bad ranges,
and programs exceeding 256 generated P-code instructions. Source is limited
to 16 KiB.

`simulateAssemblerish(artifact, { allowedPins, inputs, dht })` runs the artifact
on the repository's existing JavaScript PMachine with a mock HAL. `allowedPins`
is mandatory and every declared GPIO must be explicitly granted. Each input
device needs an explicit `inputs` sample. A DHT11 requires an explicit
`dht: { valid, temperature, humidity }` sample (all values are centi-units);
failed samples deliver zeroed values. The mock rejects missing samples,
undeclared devices, out-of-range values, unknown bindings, and event delivery
failure instead of silently simulating success.

## Examples

See `examples/` for a pull-up pushbutton and relay, a change-triggered toggle,
a DHT11 timer event, and a bounded PWM output. Execute every example on the
real JavaScript PMachine and the mock device ABI with:

```sh
cd languages/assemblerish
npm test
```

## ESP32 deployment client

For a complete pin-free one-second timer that sends events to a Pascalish
service printing dots on serial, see the
[timer-dot tutorial](HAL-TUTORIAL.md#one-second-timer-and-pascalish-dot-receiver).
The installer leaves the demo running until explicitly stopped or rebooted.

`deploy.mjs` expects the PMachine host's `/pmachine/assemblerish` endpoint:

```sh
node languages/assemblerish/deploy.mjs install \
  --url http://device-host --source languages/assemblerish/examples/pushbutton-relay.asmish \
  --allowed-pins 4,16 --confirm-install
node languages/assemblerish/deploy.mjs status --url http://device-host
node languages/assemblerish/deploy.mjs remove --url http://device-host --confirm-remove
```

The client signs the program map with the repository's `attachPcodeSignature`
helper and posts `{pcode, programMapText, allowedPins}`. Deployment omits debugger
source maps to avoid retaining duplicated source text on the board. Install requires an
explicit confirmation flag and a grant for every declared pin. This client
accepts `--allowed-pins none` for a timer handler that declares no devices. It
does not persist programs or claim that any example has been physically wired
or tested. Signing follows the existing P-code integrity convention; this
client does not claim that a signature authenticates the installer or grants
authorization. A hosted POST ServiceHost target must exist before installation.
The host endpoint accepts at most 48 KiB of request data and 16 KiB of P-code.
Requests use a bounded 10-second timeout by default (`--timeout-ms` can raise
it to at most 120 seconds).

The runtime contract, scheduling model, queue behavior, and hardware safety
notes are in [HAL-TUTORIAL.md](HAL-TUTORIAL.md).
