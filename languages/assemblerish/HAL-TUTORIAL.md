# Assemblerish HAL: wiring, simulation, and deployment

Assemblerish compiles a bounded, straight-line handler to PMachine P-code. This
guide covers the four included `.asmish` examples and the runtime contract.
The wiring below is illustrative; no physical GPIO, relay, or sensor test has
been performed.

## Verified execution

The compiler/mock-HAL/native-timing checks pass, as do the editor and extracted
standalone-VSIX checks. The S3 firmware builds and has been flashed.
A pin-free physical test ran a 100 ms timer through the actual ESP32 PMachine,
including `SET`, `NOT` and the final event, into a hosted Pascalish receiver.
It completed more than 20 deliveries without faults, then removed both the
hardware handler and demo service. This tests real event queue submission,
completion and slot reclamation, not GPIO interrupts or sensor wiring.

To repeat that opt-in test once FFS is ready and no existing handlers/services
are running:

```powershell
$env:PULSE_ESP32_TEST_URL = 'http://device-host'
node .\virtualMachines\esp32\testing\pmachines\verify-esp32-assemblerish.mjs
```

The test uses no GPIO grants and deletes only its own uploaded files.

## One-second timer and Pascalish dot receiver

The pin-free [`timer-dot.asmish`](examples/timer-dot.asmish) sends a `tick`
event every 1000 ms to `/api/devices/timer-dot`. The
[`Pascalish service`](examples/timer-dot-service.pas) handles each POST with
`writeln('.')` and returns `{"ok":true}`. No wiring or GPIO grants are needed.

From the repository root, install both on a board running the current firmware:

```powershell
node .\languages\assemblerish\install-timer-dot.mjs --url http://device-host --confirm-install
```

The installer refuses to replace an existing hosted service or hardware
handler. It uploads signed service/daemon artifacts, installs the receiver
before the timer, verifies five additional delivered events, and leaves them
running. Save the returned file names for later cleanup. The companion
maintenance daemon is required by the current hosted-service installer.

Open the serial console at 115200 baud. Each received event prints a separate
`[WRITELN] .` line using the existing firmware output format. This is a
task-context software timer, not a hardware timer ISR or CPU software interrupt:
the worker checks the elapsed time and missed periods coalesce. It is not
hard real-time. GPIO edge interrupts use the separate ISR-to-task queue.

To stop both components:

```powershell
node .\languages\assemblerish\deploy.mjs remove --url http://device-host --confirm-remove
Invoke-RestMethod -Method Post -Uri http://device-host/pmachine/service_host/stop
```

The timer/service installation is volatile and must be repeated after reboot.
The uploaded files remain in FFS; optionally remove only the file names
returned by the installer through `/ffs/delete`.

## 1. Pushbutton with pull-up and relay output

Open [`examples/pushbutton-relay.asmish`](examples/pushbutton-relay.asmish):

```text
HANDLER button_relay
TARGET "/api/devices/button"
TRIGGER EDGE button FALLING DEBOUNCE 30

INPUT button PIN 4 PULLUP
RELAY lamp PIN 16 ACTIVE HIGH INITIAL 0

READ PRESSED button
NOT PRESSED
WRITE lamp PRESSED
EVENT button 1 PRESSED 0
END
```

For a simple button input, connect one contact to **GPIO 4** and the other to
**GND**. `PULLUP` enables the input's internal pull-up: released reads 1 and
pressed reads 0. `NOT` turns that electrical level into a logical
`PRESSED` value. No external pull-up is needed for this simple switch.

`WRITE lamp PRESSED` controls **GPIO 16** as a logical active-high output.
The example's `FALLING` trigger runs only on the press transition. It turns
the relay on when pressed, but does not run on release; therefore the relay
stays active after the button is released. It is a press-to-activate
demonstration, not a momentary relay.

To make the output follow both press and release, change the trigger to
`TRIGGER EDGE button CHANGE DEBOUNCE 30`. Each stable level change then invokes
the handler: the press writes 1 and the release writes 0. For a normally
inactive relay that should activate only while the button is held, use the
`CHANGE` trigger and verify the external driver's electrical polarity and
safe state before installation.

Do not connect a bare relay coil to a GPIO. Use an appropriately rated relay
driver/module, transistor or MOSFET stage, and flyback protection for an
inductive coil; keep load wiring separate from low-voltage signal wiring. Use
only the board's 3.3 V logic level—never apply 5 V to an ESP32 GPIO. Confirm
that your selected board exposes the declared pins and that GPIO 16's output
is suitable for your driver before granting it. At boot and after handler
deletion, HAL drives the output inactive and then floats the pin. A runtime
fault drives outputs inactive without floating them.
Provide an external bias on the driver's control input so the hardware stays
inactive while that pin is floating; do not rely on firmware initialization
alone to keep a load safe.

## 2. Toggle switch with pull-down

Open [`examples/toggle-switch.asmish`](examples/toggle-switch.asmish). Connect
the switch between **GPIO 5** and **3V3**. `PULLDOWN` makes the open switch
read 0; closing it to 3V3 reads 1. The handler copies that level to relay
GPIO 17 and posts the `toggle` event on a stable change. Do not connect this
input to 5 V. Use a board-approved 3.3 V source and common ground.

## 3. DHT11 temperature and humidity

Open [`examples/dht11-report.asmish`](examples/dht11-report.asmish). For a
bare four-pin DHT11, wire **VCC to 3V3**, **GND to GND**, and **DATA to GPIO
18**; leave the unused pin unconnected. Add a roughly **4.7 kΩ pull-up from
DATA to 3V3** unless the sensor breakout already includes one. Check the
specific module's pin order and voltage requirements before powering it.
Never pull DATA up to 5 V.

Some DHT11 variants specify a minimum supply above 3.3 V. Use only a module
whose datasheet explicitly supports 3.3 V for this example; otherwise use a
properly designed level interface rather than applying a higher DATA voltage
to the ESP32.

This handler samples no faster than once per 2000 ms. One `DHT` operation
reads the sensor once per invocation; the status, centi-degrees Celsius, and
centi-percent humidity share that sample. Sensor failure produces an event
with `valid`, `value`, and `auxiliary` all zero. Consumers must use `valid`,
not a zero reading, to determine whether measurements are usable.

## 4. PWM example

[`examples/pwm-level.asmish`](examples/pwm-level.asmish) drives logical duty
512 of 1023 on GPIO 21 at 1 kHz. A PWM-capable external load still needs an
appropriate driver and supply; do not power a motor, lamp, or other load
directly from a GPIO. GPIO 21 is only an example and must be checked against
the actual board pinout. On Arduino-ESP32 2.x, channel pairs 0/1, 2/3, 4/5,
and 6/7 share timers. If two outputs use a paired channel, their frequency
and resolution must match. Reserve the timer pair as well as each output pin
and channel when coordinating with other firmware peripherals.

## Run on the JavaScript PMachine with explicit mock samples

The simulator executes compiled P-code on the existing JavaScript PMachine.
It requires explicit pin grants and explicit samples for every declared input
and DHT11; it does not invent a default reading.

From the repository root, save this as `simulate-assemblerish.mjs` or run it
with `node --input-type=module`:

```js
import { readFile } from 'node:fs/promises';
import { compileAssemblerishToPcode } from './languages/assemblerish/src/compile-assemblerish-to-pcode.mjs';
import { simulateAssemblerish } from './languages/assemblerish/src/simulator.mjs';

const source = await readFile(
  './languages/assemblerish/examples/pushbutton-relay.asmish',
  'utf8'
);
const artifact = compileAssemblerishToPcode(source, {
  fileName: 'pushbutton-relay.asmish'
});
const result = await simulateAssemblerish(artifact, {
  allowedPins: [4, 16],
  inputs: { button: 0 }
});
console.log({ outputs: result.outputs, events: result.events });
```

Expected mock result includes relay logical level 1 and event
`{handler:"button_relay",event:"button",valid:1,value:1,auxiliary:0}`.
For the DHT example, pass explicit mock values, for example:

```js
const climate = await simulateAssemblerish(dhtArtifact, {
  allowedPins: [18],
  dht: { valid: 1, temperature: 2345, humidity: 5678 }
});
```

To simulate a failed sensor read use
`dht: { valid: 0, temperature: 0, humidity: 0 }`. A DHT sample without all
three fields, or an input without its named level in `inputs`, is an error.
Run the compiler and example regressions with:

```sh
npm test --prefix languages/assemblerish
```

Mock results validate compiler/runtime behavior only; they do not prove wiring,
pin availability, electrical safety, or physical sensor readings.

## Existing ServiceHost target and handler installation

`TARGET` is the path of a **real hosted POST receiver**, not a new route created
by the Assemblerish compiler. Before installation, start/use the existing
Pulse ServiceHost that owns that receiver and verify its hosted service is
running **on the same ESP32**. This implementation does not forward events to
a remote JavaScript node. Inspect the board's existing ServiceHost with:

```sh
curl -fsS "$ESP32_PMACHINE_URL/pmachine/service_host/status"
```

The receiver must be reachable at the exact target in the source; for the
button example that is `POST /api/devices/button`. The ESP32 hosted-service
installer restricts ordinary endpoint paths to `/api/`; the examples follow
that policy. The receiver should accept the event JSON
`{ "handler":"button_relay", "event":"button", "valid":1, "value":1,
"auxiliary":0 }` and apply its own validation/authorization. Verify that POST
against the **already-installed hosted service** before installing the device
handler. Do not substitute the PMachine install endpoint for the event
receiver: `/pmachine/assemblerish` installs the handler, while
`/api/devices/button` is where ServiceHost receives its event.

### A minimal receiver for all four examples

The following opt-in script compiles a real Pascalish receiver and its
maintenance daemon, uploads signed artifacts through FFS, and installs them
on the same board. It refuses to replace a running ServiceHost and does not
grant or touch GPIOs. Save it at the repository root as
`install-device-receiver.mjs`, set `ESP32_PMACHINE_URL`, then run it with Node.
The existing FFS backend must be available; do not upload a filesystem image.
Use your deployment's configured P-code signing environment.

```js
import { compilePascalishProgramWithAntlr as compile } from './virtualMachines/esp32/aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { attachPcodeSignature } from './virtualMachines/esp32/aggregator/scripts/pcode-signing.mjs';
import { compactServiceHostProgramMap } from './virtualMachines/esp32/pmachines/shared/contracts/service-host-bindings.mjs';

if (!process.env.ESP32_PMACHINE_URL) throw new Error('Set ESP32_PMACHINE_URL');
const origin = new URL(process.env.ESP32_PMACHINE_URL);
async function request(path, values) {
  const response = await fetch(new URL(path, origin), {
    ...(values ? { method: 'POST', body: new URLSearchParams(values) } : {}),
    signal: AbortSignal.timeout(10000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${text}`);
  return text;
}
const status = JSON.parse(await request('/pmachine/service_host/status'));
if (status.running) throw new Error('Stop or reuse the existing ServiceHost explicitly');
const routes = ['button', 'toggle', 'climate', 'status-led'];
const posts = routes.map(name => `
post '/api/devices/${name}'; begin
  host.table_put('nodes', '${name}', host.event_body(), 60000);
  return '{}'
end`).join('\n');
const service = compile(`service 'device-events';
${posts}
get '/api/devices/last'; begin return host.table_snapshot('nodes', '', 5) end
end.`, { hostServices: true });
service.programMap.hostTables = [{ name: 'nodes', capacity: 4 }];
const daemon = compile(
  "daemon 'device-expiry' every 1 second; begin host.table_expire('nodes') end.",
  { hostServices: true }
);
const prefix = `/device-${Date.now().toString(36)}`;
for (const [name, artifact] of [['service', service], ['daemon', daemon]]) {
  const map = attachPcodeSignature(compactServiceHostProgramMap(artifact.programMap), artifact.pcodeText);
  await request('/ffs/upload', { file: `${prefix}-${name}.pcode`, body: artifact.pcodeText });
  await request('/ffs/upload', { file: `${prefix}-${name}.map.json`, body: JSON.stringify(map) });
}
console.log(await request('/pmachine/service_host/install', {
  serviceFile: `${prefix}-service.pcode`, serviceMap: `${prefix}-service.map.json`,
  collectorId: 'device-events',
  daemons: JSON.stringify([{
    file: `${prefix}-daemon.pcode`, map: `${prefix}-daemon.map.json`, udpPort: 0
  }])
}));
```

The receiver retains the most recent event per example for 60 seconds; inspect
`GET /api/devices/last`. It is an event-consumer demonstration, not load-control
policy or an authenticated public API. Restrict access to the board's control
plane and add application-specific validation/authorization before exposure.
When finished, remove the Assemblerish routine first, then stop this demo
ServiceHost with `POST /pmachine/service_host/stop` and remove its named FFS
artifacts if no longer needed.

On Windows, the corresponding PowerShell setup and install commands are:

```powershell
$env:ESP32_PMACHINE_URL = 'http://device-host' # Replace with the board address.
node .\install-device-receiver.mjs
node .\languages\assemblerish\deploy.mjs install --url $env:ESP32_PMACHINE_URL --source .\languages\assemblerish\examples\pushbutton-relay.asmish --allowed-pins 4,16 --confirm-install
node .\languages\assemblerish\deploy.mjs status --url $env:ESP32_PMACHINE_URL
```

The install command above enables outputs. Run it only after checking the
wiring, pin ownership and inactive output state described earlier.

Install on the ESP32 PMachine endpoint only after the target receiver is up.
Replace the URL with the board's reachable PMachine base URL and grant only
pins approved for the actual board and attached circuit. A pin grant is the
operator's assertion of ownership/permission; the firmware does not discover
other owners or prove that the selected pin is unused:

```sh
node languages/assemblerish/deploy.mjs status --url "$ESP32_PMACHINE_URL"
node languages/assemblerish/deploy.mjs install \
  --url "$ESP32_PMACHINE_URL" \
  --source languages/assemblerish/examples/pushbutton-relay.asmish \
  --allowed-pins 4,16 \
  --confirm-install
```

The installer posts `{pcode, programMapText, allowedPins}` to
`POST /pmachine/assemblerish`; it signs the map using the repository's
`attachPcodeSignature` helper. Signing is the existing P-code integrity
convention, not operator authentication or pin authorization. The running
firmware endpoint enforces the explicit pin grant. The installer uses a
10-second request timeout by default; `--timeout-ms` accepts at most 120
seconds. Check status and remove explicitly when finished:

```sh
node languages/assemblerish/deploy.mjs status --url "$ESP32_PMACHINE_URL"
node languages/assemblerish/deploy.mjs remove \
  --url "$ESP32_PMACHINE_URL" --confirm-remove
```

The HAL handler installation is single-instance and is not persisted across
restart. Deleting it drives outputs inactive and floats the pins. The worker,
bounded trigger queue, and VM storage are persistent runtime resources and
remain allocated for reuse after deletion; uninstall is not worker teardown.
The handler's final event call queues delivery to the existing hosted
ServiceHost; the native ISR only queues plain trigger data, while task-context
code performs debounce, invokes the PMachine, and handles event delivery.
Queue overflow is observable; delivery or runtime failure faults/stops the
handler and drives outputs inactive. Delivery is bounded to two seconds.
