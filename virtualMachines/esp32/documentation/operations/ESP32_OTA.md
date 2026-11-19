# ESP32 PMachine OTA

The OTA profiles provide two native-app slots, two read-only boot filesystem
slots, and the existing mutable LittleFS partition (`spiffs`). Boot image
updates never target the mutable filesystem or NVS. A new boot image is staged
only in the inactive `boot_a`/`boot_b` partition. The active image is treated
as immutable by boot/access discipline; Arduino LittleFS mounts it read/write,
so the filesystem API does not enforce read-only access.

OTA partition profiles are explicit additions:

| Profile | Native app slots | BootFS slots | Mutable `spiffs` |
| --- | ---: | ---: | ---: |
| `esp32_s3_pmachine_ota_n8r8` | 2 × `0x2F0000` | 2 × `0x50000` | `0x160000` |
| `esp32_s3_pmachine_ota_n16r8` | 2 × `0x500000` | 2 × `0x100000` | `0x3E0000` |

The 8 MB app slots are 3,080,192 bytes each. A release must be built and
measured against the selected profile; OTA rejects an app image larger than
its inactive slot. The 16 MB layout is for a different physical flash size,
not a drop-in expansion for an 8 MB device.

The N8R8 PMachine profiles currently omit `ENABLE_HTTPS`. The N8R8 OTA
profile defines `PULSE_OTA_BOOTFS_ONLY`: native firmware uploads and commits
are disabled, while signed BootFS uploads still use the inactive data slot
and trial rollback. Sign BootFS-only releases with the currently installed
pair ID. Use serial flashing for native firmware, and keep the existing
partition layout when upgrading an installed device. N16R8 behavior is
unchanged.

## Trust and build configuration

Release envelopes use RSA-2048/SHA-256. Generate and protect an operator key
outside the repository:

```powershell
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out release-private.pem
openssl pkey -in release-private.pem -pubout -out ota-public.pem
```

Keep `release-private.pem` offline. Before building, set
`PULSE_OTA_PUBLIC_KEY_FILE` to the public PEM and `PULSE_OTA_UPLOAD_TOKEN` to a
random token of at least 24 characters. The PlatformIO pre-script embeds the
public key and token only in that build's ignored `.pio` output. If either is
missing, OTA writes are disabled and status reports `enabled: false`; there
is no development or unsigned fallback. The token is a local provisioning
capability, not transport encryption. Keep the device on a trusted LAN and do
not expose the OTA routes to the public internet.

Build the selected profile with PlatformIO, for example:

```powershell
pio run -e esp32_s3_pmachine_ota_n8r8
```

ESP32-S3 PMachine builds use a 16 KiB Arduino loop-task stack. The boot
supervisor runs P-code on that task, and the framework's 8 KiB default caused
a stack-canary failure during interpreter execution.

The generated firmware is in `.pio/build/<profile>/firmware.bin`. Record the
actual image size and compare it with the profile's app slot before releasing.

## Create and sign a paired release

For a BootFS-only profile, skip the firmware signing and upload commands.

The boot filesystem build includes only:

* `data/boot/pmachine-boot` as `/boot/pmachine-boot`;
* `data/boot/pmachine-provisioning` as `/boot/pmachine-provisioning`;
* optional `data/boot/program.map` as `/boot/program.map`;
* `data/web/provisioning.html` as `/web/provisioning.html`;
* the release pair ID as `/boot/ota-pair-id`.

The two required P-code programs are built from the Kotlin sources by
`node languages/kotlin/scripts/build-boot-supervisor.mjs`. The provisioning
controller runs before FFS startup; native code remains responsible for
Wi-Fi operations, and encrypted credential persistence. The image does not
package the legacy `data` tree or mutable node files.

```powershell
node scripts/buildbootfs.mjs --profile n8 --pair-id rel42 --out .pio/bootfs-rel42.bin
node scripts/ota-sign-release.mjs --kind firmware --board esp32s3-pm-n8 --abi pm-abi-1 --pair-id rel42 --version 42 --image .pio/build/esp32_s3_pmachine_ota_n8r8/firmware.bin --private-key C:\release\release-private.pem --out .pio/firmware-rel42.pota
node scripts/ota-sign-release.mjs --kind bootfs --board esp32s3-pm-n8 --abi pm-abi-1 --pair-id rel42 --version 42 --image .pio/bootfs-rel42.bin --private-key C:\release\release-private.pem --out .pio/bootfs-rel42.pota
```

Use the corresponding `n16` board ID and profile for 16 MB devices. Board,
runtime ABI, pair ID, version, image length, and SHA-256 are signed together.
Pair IDs are ASCII identifiers of at most 15 bytes. Firmware and BootFS
envelopes for one coordinated trial must use the same pair ID and signing key.
Each image version must be newer than the committed and previously staged
version of that kind.

## Stage and commit

Send each binary envelope as the request body; no path or destination is
accepted from the client. The configured token is required for every write:

```powershell
curl.exe -X POST -H "X-Pulse-OTA-Token: $env:PULSE_OTA_UPLOAD_TOKEN" -H "Content-Type: application/octet-stream" --data-binary "@.pio/bootfs-rel42.pota" http://DEVICE/api/ota/upload
curl.exe -X POST -H "X-Pulse-OTA-Token: $env:PULSE_OTA_UPLOAD_TOKEN" -H "Content-Type: application/octet-stream" --data-binary "@.pio/firmware-rel42.pota" http://DEVICE/api/ota/upload
curl.exe http://DEVICE/api/ota/status
curl.exe -X POST -H "X-Pulse-OTA-Token: $env:PULSE_OTA_UPLOAD_TOKEN" http://DEVICE/api/ota/commit
```

On first wired-factory boot, the selected BootFS `/boot/ota-pair-id` marker
seeds the durable active firmware/BootFS compatibility pair. The marker must
be a valid 1..15-byte identifier; subsequent boots validate it against metadata.
For BootFS-only updates, keep this pair ID unchanged and increase the BootFS
version. Upload only the signed BootFS envelope, then commit: no firmware
upload or bootloader rollback support is needed. A different pair requires
both images and firmware rollback support. `/api/ota/abort` clears staged
metadata; partial or invalid data is never selected. Upload validation checks
the signature before flash writes, streams and checks the payload digest,
validates the native app image or mounts the inactive BootFS without formatting
it, and rejects a BootFS missing its required local boot files or pair marker.

Commit records one pending firmware/BootFS pair and restarts into a trial.
The native supervisor must call `pulse::ota::confirmBoot()` only after its
local health decision succeeds (the provisioned AP or a connected station is
enough; Wi-Fi and FFS are not prerequisites). On local runtime failure it
should call `pulse::ota::rejectBoot(reason)`, which restores the previous pair
and reboots. BootFS mount failure also rejects the trial. A disconnected device
can therefore complete local boot health and remain in provisioning mode.

## Firmware rollback limitation

The current Arduino framework's precompiled bootloader normally has app
rollback disabled. A C++ compile definition cannot add rollback to a
precompiled bootloader. Runtime status exposes
`firmwareRollbackConfigured` and `firmwareUpdatesEnabled`; when rollback is
not configured, firmware envelopes are rejected. BootFS-only OTA remains
available. Supporting firmware trials requires an operator-built and wired-
flashed bootloader/partition deployment with ESP-IDF app rollback enabled;
do not treat a PlatformIO application rebuild alone as enabling it.

## First migration and recovery

The existing single-app `huge_app.csv` layout cannot perform A/B updates. OTA
profiles do not repartition devices automatically. The first migration is a
wired-flash operation: verify the board's physical flash size, back up NVS and
the existing mutable `spiffs` image, install the matching partition table and
firmware, then write the same initial BootFS image to both boot slots:

| Profile | `boot_a` offset | `boot_b` offset |
| --- | ---: | ---: |
| 8 MB | `0x600000` | `0x650000` |
| 16 MB | `0xA20000` | `0xB20000` |

Restore mutable data only using the verified layout and backup procedure for
that device. Do not use a blanket erase when preserving credentials is
required. The firmware does not auto-format either BootFS slot or the mutable
`spiffs` filesystem on mount failure; use the wired recovery path if both boot
copies fail. Never use an 8 MB partition table on a 16 MB board or vice versa.

Build the P-code programs first, then generate the initial wired-installed
BootFS with `buildbootfs.mjs --pair-id <factory-pair>` and match it to the
firmware it accompanies. This physically
installed marker establishes the initial compatibility identity; it is not
downloaded from an unauthenticated source. Both factory copies need the same
marker. OTA never changes the active firmware identity for a BootFS-only trial.

On startup, a running app that disagrees with durable, non-pending OTA metadata
is never silently adopted: the device selects the recorded app and restarts
before mounting any BootFS, or fails closed if selection fails. This also
recovers a power cut between rollback metadata persistence and bootloader slot
selection. Wired app-only rewrites must respect the recorded firmware/BootFS
pair; a deliberate factory reinstallation must reset the OTA metadata with the
matching wired-installed pair rather than expecting automatic app adoption.

Confirmation publishes slot reuse only after metadata persistence succeeds.
A failed metadata write retains the durable pending trial for retry.
`confirmBoot()` and `rejectBoot()` take the same nonblocking transaction lock
as OTA routes: `false` with `lastError()` equal to
`OTA transaction is busy; retry` means retry later, not a local-health failure.
No native log is emitted for contention; callers should avoid repeated busy logs.
