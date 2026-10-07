# Pulse Studio infrastructure network views

The Infrastructure tree retains its existing **Network** branch, backed by
the Aggregator `/api/nodes` endpoint.

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
