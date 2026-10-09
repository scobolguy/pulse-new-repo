# Pulse Studio & PMachine Debugger

This single VS Code extension packages Pulse Studio, Data Librarian, Data Mapper,
Deploy, Node Inventory, and native Run and Debug support for PMachine programs.
Install one `pulse-pmachine-debugger` VSIX to get these panels and commands.

## Data Librarian in Explorer

Run **Pulse Data Librarian: Browse Schemas** from the Command Palette, or expand
**Pulse Data Librarian** in the Explorer sidebar. The dedicated view lists the
Librarian catalog from `pulse-pmachine.backendUrl`; expand a schema to browse its
fields, nested groups, and data types. Click a schema or field to open the schema's
full metadata and structure as a JSON snapshot. Editing or saving that snapshot
does not update the Librarian catalog.

Use the view's refresh button after catalog changes. Backend URL changes and
granting workspace trust also refresh the view. Untrusted workspaces do not
contact the backend. Empty catalogs and schemas without field structures are
shown explicitly; connection or catalog failures appear in the view, a
notification, and the `Pulse PMachine` output channel.

This panel is included in extension version **0.1.13**. After installing the
updated VSIX, run **Developer: Reload Window**. If hidden, use **View: Open View**
and select **Pulse Data Librarian**.

## Pulse Studio panels

The **Pulse Studio** activity-bar container includes Data Librarian, Data Mapper,
Infrastructure, Deploy, and Node Inventory views, plus the VFL editor and
**Pulse: Open Pulse Studio** command. The native PMachine Data Librarian and
Data Mapper views remain available in Explorer alongside the Studio views.

Deploy can validate and preview WFL deployment declarations. The current backend
does not install WFL service or daemon artifacts onto ESP32 nodes, so choosing
Deploy explicitly reports that no deployment occurred. Node Inventory separates
registered services from observed hosted contexts and provides distinct,
confirmed actions for unregistering a service and stopping a hosted context.

Deploy also includes **Deploy Network Cache to local JS PMachine**. In a trusted
ESP32 project workspace, select it to start a managed VS Code task that creates
a local JS PMachine on `4111`, installs signed cache service contexts with the
Kasa, Tuya and SSDP daemons on `4309`, `4307` and `4308`, and serves the native
aggregation API on `4310`. It also installs the Pulse node discovery service and
daemon on the primary context, listening on shared UDP `4210`. The Aggregator
must use a shared discovery socket too; restart older running backends before
installing this collector. It uses `config/federated-device-cache.json` for LAN
interface and peer settings. Existing listeners/collector contexts are not
replaced. The task terminal reports readiness or errors; keep it running to keep
the deployment alive. A fresh process requires redeployment. Cache source
coverage is reported independently; successful installation is not evidence
that every device was discovered. WFL remains validation/preview only.

Build and package all features together from this extension folder with
`npm run package`; the resulting VSIX is the single installable extension.

## Data Mapper designer

Run **Pulse Data Mapper: Create Prototype Map** from the Command Palette, choose
a new `*.pulse-map.json` file, and the visual designer opens with sample payment
schemas. Drag a source field onto a target field to connect them. Alternatively,
select a source and click a target (also usable with keyboard Tab and Enter).
Select a connection in the middle to edit its conversion rule or remove it.
Use **Apply rule** to update the document, then the normal VS Code Save command.
Edits participate in VS Code Undo/Redo and synchronize with JSON text edits.
**Open JSON** opens the text editor beside the designer.

To start with real schemas instead of the example, run **Pulse Data Mapper:
Create Map**, then use **Map details** to set its ID and name.
**Choose source schema** and **Choose target schema** load the Librarian catalog
through `pulse-pmachine.backendUrl` (default `http://127.0.0.1:4000`).
Schema selection embeds the structure, type ID, path and modification time in
the local map, so it remains editable offline. Switching schemas asks before
clearing connections. **Refresh selected schemas** reloads both structures
without removing rules; publication reports any fields removed from the schema.
The source and target search boxes filter large field lists.

**Pulse Data Mapper: Import from Aggregator** (also on the designer toolbar)
lists backend maps and saves the chosen map to a new local file. It never
overwrites an existing local file. **Publish to Aggregator** confirms the
destination and whether it will create or replace a backend map. Publication
does not deploy to a PMachine. Save local metadata changes with Ctrl+S.
Existing backend maps are reread after confirmation to detect intervening edits;
the current backend API has no atomic conditional-write support.

The **Test mapping** panel accepts a sample JSON object, or a backend test case
if the sample input is blank. Test cases use the Aggregator's schema-generated
sample data, not the stored test case's actual message. Run executes the exact
published map through `/api/mapper/maps/:id/run` and displays its output and
diagnostics, including missing-source warnings and conversion information.
Local changes must be published first; running never publishes implicitly.
Document or input changes mark previous output stale.

Backend actions require a trusted workspace, have bounded HTTP timeouts, and
report failures in the designer and `Pulse PMachine` output channel. No backend
connection is required for offline editing. If Librarian reports a catalog error,
schema selection cannot proceed until that backend problem is repaired;
existing embedded schemas remain usable. The Librarian supports zero-padded
ISO schema versions and batches large catalogs within PMachine transport limits.

For an existing single-map JSON object, run **Pulse Data Mapper: Open Designer**
with its text editor active, or use **Reopen Editor With > Pulse Data Mapper**
for `*.pulse-map.json`, `*.mapping.json` or `*.map`. The designer preserves unknown local map
and rule metadata and supports the existing `rules` or legacy `items` arrays.
Embedded `sourceStructure` / `targetStructure` trees use `children`, `name`,
`kind` (`leaf` or `branch`), and `valueType`, matching the Aggregator map format.
Without embedded structures, only field paths already used by rules are shown.
Collections such as `data-mappings.json` are not supported by this editor.
Invalid JSON is reported and disables visual editing until repaired.

Conversion rules support basic local validation (maximum 1000 characters,
characters, balanced delimiters, and assignment/function/keyword presence).
Full execution validation is performed by the existing Aggregator Pascalish
routine interpreter. Unlike types require an explicit conversion routine.
Branch-to-leaf links and duplicate links are rejected. Legacy `from` / `to` /
`conversion` aliases are imported, and clearing an old conversion also clears
the legacy value to prevent it reappearing at runtime.
JSON is formatted when a visual edit is applied. This version does not add
PMachine deployment or transformation-node graphs.

Build with `npm run compile`, package with `npm run package`, install the VSIX
using **Extensions: Install from VSIX**, then run **Developer: Reload Window**.
Run `node --test test/dataMapper.test.mjs test/dataMapperBackend.test.mjs` after
compiling for model, document and HTTP regression tests. To exercise real
publish/update/run APIs in PowerShell, set
`$env:PULSE_MAPPER_TEST_URL = 'http://127.0.0.1:4000'` before that test command.
The live test creates a uniquely named temporary map and deletes it afterward.

## Services in Explorer

Expand **Pulse Services** in the VS Code Explorer sidebar to browse the
Aggregator `/api/services` directory, including configured offerings, runtime
instances, and named Pascalish services registered on discovered PMachine nodes
and configured discovery collectors. The directory includes **Pulse Data Librarian**
and **Pulse Data Mapper** from the service registry. After updating the gateway,
restart it and refresh the view to load the directory route. When a service has multiple instances,
expand its service group to see each instance as a distinct leaf, identified by
node/endpoint and instance ID. A single instance is shown directly as a leaf.
Tooltips show the endpoint, provider, protocol, status, and configuration reference.
**Pulse Servers** separately lists hosting machines and infrastructure such as
RabbitMQ, MSMQ, and MSSQL; these do not appear under Services.
Registered does not mean healthy;
unreachable node registries are shown explicitly rather than silently omitted.
Use the refresh button to reload the directory, and **Open Endpoint** to open a
configured HTTP/HTTPS endpoint in your browser. The view uses
`pulse-pmachine.backendUrl` and refreshes when that setting changes. Request
failures are reported in the view, a notification, and the `Pulse PMachine` output.

## Run from the editor

Open a Pascalish, VBish, WFL, or MAPL source file and select **Run on PMachine** above the source or from the editor title bar. Choose the local JavaScript PMachine, a discovered JavaScript PMachine (for example, `magic-js-pmachine-01`), or a discovered ESP32 PMachine; output appears in the `Pulse PMachine` Output channel. Discovered JavaScript targets run through the Aggregator deployment API using their node ID; their registry addresses are not device API endpoints. Configured direct host:port JavaScript nodes and ESP32 boards use the shared `runPcodeOnEsp32` runner in `aggregator/scripts/run-pascal-on-esp32-node.mjs` to upload compiled pcode and its signed program map via `/ffs/upload`, then run via `/pmachine/execute_file`. The local JavaScript option runs in-process. Set `pulse-pmachine.backendUrl` if the Aggregator is not running at `http://127.0.0.1:4000`.

JavaScript PMachine targets are kept separate from ESP32 upload targets in the picker. To run on the Hanoi board, choose the target whose description contains `192.168.2.115`. Run-to-completion ESP32 uploads omit the editor-only source map to reduce device memory usage; interactive debugging retains source mapping.

The initial configuration debugs `src/towers-of-hanoi-program.pas` on the JavaScript PMachine and stops at the top-level program entry (`begin`, line 18) before executing it. Use the standard VS Code Continue, Step Over, Step In, Step Out, Pause, Stop, Call Stack, and Variables controls.

The `Debug Hanoi on ESP32` launch configuration compiles the current Pascalish source, uploads its P-code and signed program map to `192.168.2.115` through `debugApiUrl: http://127.0.0.1:4000`, and starts a persistent on-device debug session at the program entry. The firmware loads procedure signatures from that map so recursive parameters appear correctly in Locals. Source breakpoints can be added or removed while paused. Step In enters calls; Step Over stays at the current call depth; Step Out returns to the caller. Program output is forwarded to the Debug Console without duplication. The Call Stack view currently shows the active source location, not every historical frame.

Enable `animate` to step through source statements every second and print the current variables in the Debug Console. No graphics panel or Playwright is needed. Build the `esp32_pmachine` firmware and upload it to the board's actual USB port (COM7 for this board), without uploading a filesystem image. Keep only PulseAggregator running for backend discovery, and restart it after changing backend debugger code. After installing an updated extension package, run **Developer: Reload Window** to load the new adapter. Run-to-completion ESP32 launch configurations remain separate from interactive debug sessions.

## Debugger regression tests

From this extension directory, run `npm run compile` followed by `node --test test/debugger.test.mjs`. Tests cover three legal five-disk Hanoi executions (802 instructions each), JS source entry and recursive locals, source stepping, signed map transport, remote breakpoint edits, DAP error responses, and the editor's shared remote runner export, host/port transport, input validation, and HTTP failures. To include the live board test through the backend API in PowerShell, set `$env:PMACHINE_TEST_HOST = '192.168.2.115'` before running the tests. The live test creates and deletes its own debug session.

The adapter keeps language handling separate from runtime control. Pascalish uses `.pas`, Cobolish uses `.cob` or `.cobol`, and VBish uses `.bas`, `.vb`, or `.vbs`; all three compile through the shared source-map contract.

Local JavaScript source breakpoints stop before a statement executes. Breakpoints on blank lines or non-executable keywords relocate to the next mapped statement in that source file; the adapter reports the resolved line to VS Code. Lines beyond the last mapped statement are unverified. Editing or clearing source breakpoints replaces the previous set for that file. A breakpoint on a procedure call stops in the caller; Step In enters the procedure and exposes its parameters in Locals.
