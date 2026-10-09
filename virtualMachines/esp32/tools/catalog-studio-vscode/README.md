# Pulse Studio infrastructure network views

The **Pulse Studio** sidebar has separate **Data Librarian** and **Data Mapper**
views, both visible by default. The extension activates at startup. Data Librarian
loads registered data types directly, without an expandable wrapper node;
Data Mapper loads saved maps and automatically expanded field connections directly
from port 4200, without clicking a command or opening an editor tab. VS Code preserves any view visibility
or collapsed-state customizations you make. Use the librarian view's **Refresh** button or
**Pulse: Refresh Data Librarian** to reload the list. It reads
`/api/librarian/data-types` from `pulse.catalogStudio.apiBase` and falls back to
the Data Librarian service at `http://127.0.0.1:4300`; loading failures are
shown as an error row with details in its tooltip. An empty registry is shown
explicitly. Neither sidebar view requires the frontend dev server. Configure
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
ESP32; **Deploy** therefore reports that limitation and makes no deployment.

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

The extension entry point requires `distributedNetwork.js`; include this file
alongside `extension.js` when packaging or deploying the extension. Reload
the VS Code window after updating an installed extension.
