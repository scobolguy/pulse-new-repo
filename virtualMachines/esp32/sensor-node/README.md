# ESP8266 Pascalish sensor node

This isolated NodeMCU ESP8266 profile runs the shared C++ PMachine without the
ESP32 service host, FreeRTOS workers, TLS server, large tables, or async web
server. It also suits a D1 mini with the same GPIO mapping. It does not replace
the existing ESP32 firmware or the legacy `esp8266` profile.

## Wiring

Disconnect power while wiring. All GPIO signals must be 3.3 V.

| Component | Connection |
| --- | --- |
| DHT11 VCC | 3V3 |
| DHT11 GND | GND |
| DHT11 DATA | GPIO4 / D2 |
| Momentary button | GPIO14 / D5 to GND |

The button uses the internal pull-up and is active-low. A bare DHT11 normally
needs a 4.7-10 kohm pull-up from DATA to 3V3; many modules already include one.
Check the actual sensor/module pin labels rather than assuming their order.

## Pascalish behavior

[esp8266-sensor-node.pas](../src/esp8266-sensor-node.pas) owns the 50 ms debounce,
press-edge detection, five-second DHT11 schedule, error message, and printing.
`writeln('Button pressed')` prints once on each debounced press to the **115200
baud serial console**. Holding or releasing the button does not print again.
A button held during boot is not treated as a new press.

DHT11 readings print temperature in Celsius and relative humidity. A failed
read prints `DHT11 read failed`; later scheduled samples retry normally. The
first read occurs five seconds after startup. Missed samples are coalesced,
not replayed. This is cooperative polling, not an interrupt-based counter:
very short presses, or presses entirely between polls during blocking I/O,
can be missed.

No grammar or opcode extension was needed. The compiler's opt-in
`deviceBindings: true` mode adds typed device calls, lowered to existing
`CALL_EXT` instructions:

| Binding | Contract |
| --- | --- |
| `device.clock()` | Nonnegative 31-bit millisecond clock |
| `device.elapsed(stamp)` | Modular elapsed milliseconds; intervals must be below 2^31 ms |
| `device.gpio_read(pin)` | Raw button level (configured GPIO14 only) |
| `device.dht_read(pin)` | Read configured DHT11 on GPIO4; boolean success |
| `device.dht_temperature()` / `device.dht_humidity()` | Last successful sample as decimal text; error if latest read failed |
| `device.state_get(name)` / `device.state_set(name, value)` | Persistent integer state between ticks; new keys read as zero |

State is RAM-only, bounded to 16 keys of at most 32 bytes. The firmware calls
one finite Pascalish program tick approximately every 10 ms. It supplies
hardware operations, persistent state, serial output, and Wi-Fi/HTTP adapters.
The image remains in flash; only the current instruction is materialized.
Sensor builds use a 64-value VM stack and a 2000-instruction tick limit.
Runtime errors stop the VM and are explicitly logged and reported via HTTP.

## Build and validate

From the repository/project directory:

```powershell
node sensor-node\compile.mjs
node --test testing\pmachines\esp8266-sensor-node.test.mjs
pio run --project-dir sensor-node --environment esp8266_sensor
```

Regenerate after every Pascalish change. The generated
[program.h](../src/sensor_node/program.h) is checked into source control;
`node sensor-node\compile.mjs --check` detects a stale image. The image generator
rejects instructions outside its supported sensor-program subset instead of
silently substituting behavior.

The JavaScript tests execute the compiled Pascalish with simulated hardware.
[esp8266-sensor-native.test.cpp](../testing/pmachines/esp8266-sensor-native.test.cpp)
also exercises the generated image through the actual C++ PMachine using the
repository's host Arduino shim. That PC test is separate from the ESP8266
Xtensa firmware build; its executable must never be uploaded to the board.

Verified ESP8266 build usage: 47,716 bytes static RAM (58.2%) and 664,407 bytes
flash (63.6% of the configured application space). Static RAM figures do not
include all runtime heap and stack allocations.

Upload only to an ESP8266 board (set the correct serial port):

```powershell
pio run --project-dir sensor-node --environment esp8266_sensor --target upload --upload-port COM7
pio device monitor --baud 115200 --port COM7
```

## Optional Wi-Fi and HTTP readings

Sensor sampling and button printing work without Wi-Fi. To enable polling,
send a newline-terminated serial command:

```text
PROVISION {"ssid":"your-network","password":"your-password"}
```

Credentials are saved using the ESP8266 Wi-Fi SDK and reused after reboot.
They are not printed. Serial commands are bounded to 384 bytes. The firmware
logs its IP after connection and automatically reconnects after disconnection.

`GET /status` and `GET /sensor/latest` return node identity, VM health, free heap,
Wi-Fi state, sample validity/age, temperature and humidity. Requests **do not**
force another sensor read. Failed or not-yet-taken samples omit readings and
include `sensorError`; VM failure returns HTTP 503.

HTTP is unauthenticated and unencrypted: use only a trusted LAN. This version
does not publish readings automatically, provide MQTT, advertise UDP discovery,
or execute remotely uploaded programs. An Aggregator/gateway can poll the
endpoint; automatic publishing would be a separate integration.

## Hardware acceptance checks

After upload, verify startup and a valid sample, then press/hold/release the
button and confirm exactly one message per debounced press. Disconnect the
DHT11 and verify failure output and recovery after reconnecting it. Provision
Wi-Fi, poll status, reboot to check saved credentials, and monitor free heap
over repeated reads and button presses. Compilation and simulated VM tests do
not prove wiring, sensor timing, or long-run hardware stability.
