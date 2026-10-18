# Pulse Studio infrastructure network views

The **Pulse Studio** sidebar has separate **Data Librarian** and **Data Mapper**
views, both visible by default. Data Librarian loads registered data types
directly, without an expandable wrapper node;
Data Mapper loads saved maps and automatically expanded field connections directly
from port 4200, without clicking a command or opening an editor tab. VS Code preserves any view visibility
or collapsed-state customizations you make. Use the librarian view's **Refresh** button or
**Pulse: Refresh Data Librarian** to reload the list. It reads
`/api/librarian/data-types` from `pulse.catalogStudio.apiBase`. The extension is
a network client only: it does not start local services or try a second
localhost endpoint when the configured Aggregator is unavailable. Loading
failures are shown as an error row with details in its tooltip. An empty
registry is shown explicitly. Neither sidebar view requires the frontend dev server. Configure
`pulse.catalogStudio.mapperApiBase` to change the mapper origin (default
`http://127.0.0.1:4200`). Mapper errors appear in the tree with details in the
tooltip. Use **Pulse: Refresh Data Mapper** to reload maps and field connections.

The standalone React workbench is no longer served as a browser UI. Vite remains
the local host for the Flow Designer page embedded in a VS Code webview;
that page is loaded only on its `?host=vscode` route. Use
**Pulse: Open Pulse Studio** to open the Flow Designer webview.
**Pulse: Open Data Mapper** focuses the native mapper sidebar. The sidebar
is a mapping browser; editing remains available through the PMachine extension's
native **Pulse Data Mapper: Open Designer** command.

The Infrastructure tree retains its existing **Network** branch, backed by
the Aggregator `/api/nodes` endpoint.

**Deploy** lists workspace `.wfl` files. Right-click a file to validate it with
the Aggregator WFL compiler or preview its declared targets against registered
nodes. The current backend can compile and persist deployment plans, but its
deployment-record API does not install WFL service/daemon artifacts on an
ESP32. **Deploy** opens the separate WFL deployment editor, whose confirmed
**Deploy to Backend JS** action uses the backend-local queue-worker supervisor;
it does not claim to install code on remote nodes.

## Separate VFL and WFL editors

New graphs default to `.vfl`. The visual designer's **Executable Node** inspector
is part of a VS Code custom editor, not a standalone page. Open a `.vfl` with
**Pulse: Open in Flow Designer**. The left **Palette** contains a draggable
rectangular **Process** component with an **Add Node** keyboard alternative.
Move dropped boxes and use **Link**, then click another node, to connect them.
Save and Undo/Redo operate on the VFL document. Process boxes use the existing
`service` node kind and need a source file before building/deploying.
Catalog objects remain available below the component palette. The VFL editor
does not require the frontend/Vite server.

The **Executable Node** inspector
assigns Pascalish/MAPL/WFL source files, workflow ids and queue symbols; it also
edits outgoing link queues and opens node source. **Create WFL Deployment** creates
a separate `.wfl` file referencing the graph. Set its `deploymentTarget` before deploying.

Use **Pulse: Open WFL Deployment Editor** for WFL source/configuration,
environment and defines controls, linked VFL navigation, validation, preview,
artifact building and confirmed backend-JS deployment. **Build Artifacts** writes
per-node pcode/program maps under `.pulse-build`; preview writes nothing.
`message-broker-call` is executable now; file feeds and direct service-call links
fail explicitly rather than silently becoming no-ops. Existing embedded WFL FLOW
blocks remain editable in the optional WFL Flow Designer.

See section 3.2.3, “Executable VFL graphs and separate WFL deployment editor,”
in the Pascalish/WFL/MAPL/P-Code design spec, and the `src/visual-flow-example`
folder for a runnable deployment.

The **Deploy Network Cache to local JS PMachine** recipe is executable now.
It starts a VS Code task using `pmachines/javascript/deploy-network-cache.mjs`:
JS PMachine on `4111`, signed cache service with Kasa/Tuya/SSDP hosted daemons,
plus the Pulse node collector service and daemon on shared UDP `4210`,
and separate native aggregation on `4310`. The collector configuration comes
from `config/federated-device-cache.json`. Existing listeners are never
replaced, partial installs are rolled back, and errors appear in the terminal.
Keep the task running; runtime installation is not persisted across process
restarts. Stop the task before redeploying.

Start a second full collector set in a separate terminal/process with
`node pmachines\javascript\deploy-network-cache.mjs --replica`.
The second JS PMachine uses `4112`, with Kasa/Tuya/SSDP HTTP ports
`4329`/`4327`/`4328` and collector IDs suffixed `-2`. Discovery UDP ports
are shared; observations and boot identities remain separate. The configuration
registers all eight sources with the first process's aggregation on `4310`.
Keep both processes running; restart the first after changing membership.
Matching evidence from different configured collectors is corroborated, not
duplicated. Both processes still share one PC and LAN, so this is not proof
of independent physical failure domains.

The Tuya context listens on all IPv4 interfaces on encrypted discovery UDP
`6667` and legacy plaintext discovery UDP `6666`; its two Pascalish daemons
write into the same cache. HTTP remains loopback-only.
Tuya discovery sockets use shared UDP binds so other compatible broadcast
listeners can coexist; this does not promise duplicate delivery of unicast.
Kasa polls the 1..8 distinct IPv4 addresses in `kasaPeers` using read-only `get_sysinfo` requests,
with a refresh interval that keeps all peers within the observation TTL.
The backend registry also contains configured and HTTP-registered nodes:
those are not evidence of independent UDP discovery and need not appear in
the distributed cache. Successful source synchronization does not prove that
every LAN device announces on the configured discovery ports.

**Node Inventory** queries each registered node's `/api/services` and
`/pmachine/service_host/status` endpoints. Named-service registrations are
shown separately from observed hosted contexts; a registration is not evidence
that the service is executing. Hosted contexts show daemon diagnostics and the
aggregate distributed-table/cache counts currently exposed by firmware. Table
and cache names are not available in the firmware status response yet. Right-click
a named service to unregister it, or a hosted context/daemon to stop its
containing hosted context. Each action is separately confirmed; stopping a
context can discard its transient runtime state.

**Network (Distributed Cache)** is a separate sibling branch. It reads the
distributed device cache's revision-fenced `/api/devices` pages, displaying
`device.name` and `device.address`. No confidence, provisional, or source-current
filter is applied. Incomplete source coverage is shown explicitly without
hiding available cached devices. API/validation failures produce an error row
with details in its tooltip; the view never substitutes legacy discovery data.

Configure `pulse.catalogStudio.distributedCacheApiBase` to change the cache
origin (default `http://127.0.0.1:4310`). Use **Pulse: Refresh Infrastructure
Tree** or the Infrastructure refresh button to reload both branches.

Messaging infrastructure such as MSMQ and RabbitMQ is listed under
**Servers > Message Brokers**, not duplicated under **Services**. Runtime broker
services and collector services remain in **Services**. The tree combines live
broker records with configured broker offerings from
`aggregator/config/service-registry.json`, so configured brokers remain visible
if the live services directory is empty or unavailable.

Database offerings and runtime database instances are listed under
**Servers > Data Bases**, not under **Services**. Configured data stores remain
visible when the live services directory is empty or unavailable.

**Services** lists each registered instance separately, including instances with
the same service name. Repeated names include the instance ID in the label
(for example, `device-cache (tuya-js)`); entries without an instance ID use their
endpoint, node, or directory ID. Instance, node, and endpoint details remain
available in the row description and tooltip. Registry entries with separate
instance IDs, registration IDs, or endpoints retain distinct directory identities.

Run the focused tests from the project directory:

```powershell
node --test testing\aggregator\distributed-network-view.test.mjs
```

This directory is the Pulse Studio source and development manifest. Its runtime
module and resources are copied into the unified Pulse Studio & PMachine Debugger
extension by `extensions/pulse-pmachine-debugger/scripts/sync-pulse-studio.mjs`.
Build and package the installable extension from that directory with
`npm run package`; do not install or distribute a separate Pulse Studio VSIX.
Reload the VS Code window after updating the unified extension.
