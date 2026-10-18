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

Deploy can validate and preview WFL deployment declarations. Choosing Deploy
opens the separate WFL editor; its confirmed **Deploy to Backend JS** action
builds referenced VFL source and submits workers to the backend-local supervisor.
It does not install code on remote JS nodes or ESP32s. Node Inventory separates
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
that every device was discovered.

## Separate VFL visual and WFL deployment editors

Use **Pulse: New Visual Flow Document** to create a `.vfl` graph,
or open an existing `.vfl` with **Pulse: Open in Flow Designer**. This custom
editor runs entirely inside a VS Code editor tab; it does not need a browser
or the frontend/Vite server. Its left **Palette** starts with **Process**:
drag the rectangular symbol onto the canvas (or choose **Add Node**), move
the box, and use **Link** followed by another node to connect them.
Visual edits share the underlying document's Save and Undo/Redo.
Process boxes use the existing executable `service` kind; assign a source
file before building or deploying them. Existing catalog objects remain
in a separate section below the component palette.

Select a node
and use **Executable Node** to assign its source file, kind and queue symbols.
Pascalish, executable MAPL and WFL workflow sources compile to per-node pcode;
message-broker links become real queue bindings and support fan-out.
**Create WFL Deployment** creates a separate `.wfl` referencing that graph.

Use **Pulse: Open WFL Deployment Editor** to edit deployment source, choose an
environment/defines, open linked graphs, validate, preview, build or submit a
confirmed backend-JS deployment. Preview writes nothing. Build saves artifacts
under `.pulse-build`. The deployment path currently runs on the backend PC;
remote placement/installation and whole-graph debugging are not implemented.
Unsupported transports/steps report errors instead of running as no-ops.

The optional embedded WFL Flow Designer remains available for existing files.
See section 3.2.3, “Executable VFL graphs and separate WFL deployment editor,”
in the Pascalish/WFL/MAPL/P-Code design spec, and the `src/visual-flow-example`
folder for runnable source examples.

Build and package all features together from this extension folder with
`npm run package`; the resulting VSIX is the single installable extension.

## Data Mapper designer

The Data Mapper designer edits MAPL (`*.mapl`) source directly; MAPL is the only
local map format. Opening a `.mapl` file shows the visual designer, and
**Open MAPL text** opens the same document as text beside it. Both views edit
one VS Code document, so they stay synchronized and share Undo/Redo and Save.
A MAPL file holds exactly one `map ... end;` declaration (see
`documentation/compilers/MAPL-BNF.md`).

Run **Pulse Data Mapper: Create Prototype MAPL Map** from the Command Palette and
choose a new `*.mapl` file; the designer opens with sample payment fields. Drag a
source field onto a target field to connect them, or select a source and click a
target (also usable with keyboard Tab and Enter). Select a connection to edit
its conversion rule or remove it, then use **Apply rule**.

Each connection is a top-level MAPL assignment:

```text
target.transfer.id := source.reference;
target.'first name' := source.'given name' using 'output := trim(src);';
```

Visual edits are applied as small text splices: comments, formatting, unknown
directives and statements the designer does not model (conditions, loops,
defaults, function calls, validations) keep their original text. Those
statements are listed under **Other MAPL statements** and are edited in the
MAPL text. New connections are inserted just before the closing `end;`.

To start from real schemas, run **Pulse Data Mapper: Create MAPL Map**, then use
**Map details** to set its ID (header name) and `@name`. **Choose source schema**
and **Choose target schema** load the Librarian catalog through
`pulse-pmachine.backendUrl` (default `http://127.0.0.1:4000`) and record the
choice as `@sourceSchema` / `@targetSchema` directives plus the header type IDs.
Field structures are not stored in the file: the designer loads them from the
Librarian when the map opens or a schema is chosen. Offline, or for schemas that
cannot be loaded, the field lists are inferred from the paths used in the MAPL
rules and the schema label says so. Switching schemas asks before clearing
connections. **Refresh selected schemas** reloads both structures.

**Pulse Data Mapper: Import from Aggregator as MAPL** (also on the designer
toolbar) lists backend maps and writes the chosen map to a new `.mapl` file. It
never overwrites an existing file. **Publish to Aggregator** confirms the
destination and whether it will create or replace a backend map; the MAPL file
remains the source of truth and is not rewritten by publishing. Publication does
not deploy to a PMachine. Existing backend maps are reread after confirmation
to detect intervening edits; the backend API has no atomic conditional write.

The **Test mapping** panel accepts a sample JSON object, or a backend test case
if the sample input is blank. Test cases use the Aggregator's schema-generated
sample data, not the stored test case's actual message. Run executes the exact
published map through `/api/mapper/maps/:id/run` and displays its output and
diagnostics. Local changes must be published first; running never publishes
implicitly. Document or input changes mark previous output stale.

Backend actions require a trusted workspace, have bounded HTTP timeouts, and
report failures in the designer and `Pulse PMachine` output channel. Invalid
MAPL is reported and disables visual editing until it is repaired in the text.

Conversion rules support basic local validation (maximum 1000 characters,
balanced delimiters, and assignment/function/keyword presence). Full execution
validation is performed by the Aggregator's Pascalish routine interpreter.
Unlike types require an explicit conversion routine. Branch-to-leaf links and
duplicate links are rejected.

Build with `npm run compile`, package with `npm run package`, install the VSIX
using **Extensions: Install from VSIX**, then run **Developer: Reload Window**.
Run `node --test test/maplDocument.test.mjs test/dataMapper.test.mjs test/dataMapperBackend.test.mjs`
after compiling for MAPL parsing/splicing (checked against the ANTLR compiler),
model, designer and HTTP regression tests. To exercise real publish/update/run
APIs in PowerShell, set `$env:PULSE_MAPPER_TEST_URL = 'http://127.0.0.1:4000'`
before that test command. The live test creates a uniquely named temporary map
and deletes it afterward.

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

Local `.cob` and `.cobol` debug sessions compile as Tandem COBOL-85, recognize numbered fixed-format cards automatically, and honor `cobolSourceFormat: "fixed"` or `"free"` when detection is not suitable. Local COBOL sessions provide the desktop text, date and intrinsic host functions plus filesystem-backed ISAM storage. By default, file assignments under the COBOL `data` grant persist in `.pulse-debug/cobol-data`; set `cobolDataDirectory` to choose another directory. Breakpoints map to source statements, and COBOL numeric variables display using their PICTURE width and scale.

The `Debug Hanoi on ESP32` launch configuration compiles the current Pascalish source, uploads its P-code and signed program map to `192.168.2.115` through `debugApiUrl: http://127.0.0.1:4000`, and starts a persistent on-device debug session at the program entry. The firmware loads procedure signatures from that map so recursive parameters appear correctly in Locals. Source breakpoints can be added or removed while paused. Step In enters calls; Step Over stays at the current call depth; Step Out returns to the caller. Program output is forwarded to the Debug Console without duplication. The Call Stack view currently shows the active source location, not every historical frame.

Enable `animate` to step through source statements every second and print the current variables in the Debug Console. No graphics panel or Playwright is needed. Build the `esp32_pmachine` firmware and upload it to the board's actual USB port (COM7 for this board), without uploading a filesystem image. Keep only PulseAggregator running for backend discovery, and restart it after changing backend debugger code. After installing an updated extension package, run **Developer: Reload Window** to load the new adapter. Run-to-completion ESP32 launch configurations remain separate from interactive debug sessions.

## Debugger regression tests

From this extension directory, run `npm run compile` followed by `node --test test/debugger.test.mjs`. Tests cover three legal five-disk Hanoi executions (802 instructions each), JS source entry and recursive locals, source stepping, signed map transport, remote breakpoint edits, DAP error responses, and the editor's shared remote runner export, host/port transport, input validation, and HTTP failures. To include the live board test through the backend API in PowerShell, set `$env:PMACHINE_TEST_HOST = '192.168.2.115'` before running the tests. The live test creates and deletes its own debug session.

The adapter keeps language handling separate from runtime control. Pascalish uses `.pas`, Cobolish uses `.cob` or `.cobol`, and VBish uses `.bas`, `.vb`, or `.vbs`; all three compile through the shared source-map contract.

Local JavaScript source breakpoints stop before a statement executes. Breakpoints on blank lines or non-executable keywords relocate to the next mapped statement in that source file; the adapter reports the resolved line to VS Code. Lines beyond the last mapped statement are unverified. Editing or clearing source breakpoints replaces the previous set for that file. A breakpoint on a procedure call stops in the caller; Step In enters the procedure and exposes its parameters in Locals.
