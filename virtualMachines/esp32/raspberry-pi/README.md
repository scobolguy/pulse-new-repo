# Raspberry Pi Node Skeleton

This folder contains the Raspberry Pi build and runtime skeleton for a Pulse node that can:

- act as a Bluetooth gateway (Pi/BlueZ side) for BLE + Classic profiles
- run Piper text-to-speech with Linux audio playback
- receive and process doorbell/person alert events from ESP nodes
- mirror federated FFS deployment artifacts from the backend

## Federated FFS Client

The runtime now includes a lightweight FFS polling client. It fetches deployment metadata from:

- `/api/fileserver/ffs/services/deployments`

and downloads assigned pcode artifacts from:

- `/api/fileserver/ffs/get?path=...`

Configuration is under `ffs` in `config/node.example.json`:

- `enabled` - enable/disable polling
- `pollIntervalMs` - refresh interval
- `cachePath` - local path where mirrored artifacts are stored

## Queue Manager + PMachine Bridge

The runtime now includes a queue-to-pmachine bridge:

- polls queue manager `/dequeue` on `alertQueue`
- resolves PMachine service target via backend `/api/pmachine/route/pmachine`
- invokes C++ PMachine endpoint on target node: `/pmachine/pcode_router_run`

The Pi node also now exposes ESP32-compatible node APIs:

- `GET /status`
- `GET /services/describe`
- `GET|POST /pmachine/pcode_router_run`

and publishes itself to backend runtime routing via:

- `POST /api/pmachine/announce`
- `POST /api/registry/service-instances/heartbeat`

This allows frontend/runtime routing to discover and select the Pi node as a `pmachine` service instance.

Config sections:

- `queue.pollIntervalMs`
- `pmachine.pcodeFile`
- `pmachine.programMap`
- `http.enabled`
- `http.port`

When pcode runs successfully, logs include:

- `[pmachine-cpp] ran pcode file=... publishedCount=... target=...`
- optional first VM stdout line via `[pmachine-cpp] stdout[0]: ...`

## Bluetooth + Audio/TTS + HID

The Pi runtime now performs concrete Linux integration steps when `bluetooth.enabled=true`:

- powers on and enables pairable/discoverable state via `bluetoothctl`
- attempts trust/connect for `bluetooth.autoConnectMacsCsv`
- keeps mode flags in config for `bleEnabled`, `classicEnabled`, and `hidEnabled`
- optionally executes `bluetooth.hidCommand` for routed alerts (`{event}` token replacement)

Piper integration now:

- invokes configured `piper.binaryPath` with `piper.modelPath`
- synthesizes to `/tmp/pulse_tts_output.wav`
- optionally sets PulseAudio sink from `piper.outputDevice`
- plays audio via `aplay`

## Structure

- `CMakeLists.txt` - local native build entrypoint
- `config/node.example.json` - runtime config template
- `systemd/pulse-pi-node.service` - service unit template

## Discovery Listener

Use this utility to verify LAN announcements from `pulse_pi_node`.

Build:

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

Run listener (defaults to UDP ports `4210,4211,4101`):

```bash
./build/pulse_discovery_listener
```

Run listener on one custom port:

```bash
./build/pulse_discovery_listener 4101
```

Run listener on multiple ports:

```bash
./build/pulse_discovery_listener 4210,4211,4101
```
- `scripts/build.sh` - build helper
- `scripts/run.sh` - local run helper
- `src/` - implementation stubs
- `include/` - interfaces and shared types

## Build

```bash
cd raspberry-pi
chmod +x scripts/build.sh scripts/run.sh
./scripts/build.sh
```

## Run

```bash
./scripts/run.sh
```

## Notes

- BlueZ/Piper command execution is Linux-oriented and assumes `bluetoothctl`, `pactl` (optional), and `aplay` are available.
- `bluetooth.hidCommand` is intentionally operator-defined so you can plug in your preferred HID stack/tooling.
- Event payloads should align with the existing ESP alert schema (`doorbellAlert`, `person`, etc.).
