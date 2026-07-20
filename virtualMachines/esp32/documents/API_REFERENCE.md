# API Reference

This workspace now has a canonical API information service inside the Aggregator. Use that service first for model reasoning, operator discovery, and handoff.

## Canonical API Info Service

Base service: Aggregator backend

Primary endpoints:

- `GET /api/platform/apis`
- `GET /api/platform/apis/summary`
- `GET /api/platform/apis/lookup?method=GET&path=/api/nodes`
- `GET /api/platform/apis/actions`
- `GET /api/platform/providers`
- `GET /api/platform/providers/:providerId`
- `GET /api/platform/providers/:providerId/actions/:actionId`
- `GET /api/platform/routes/manifest`

Useful filters on `GET /api/platform/apis`:

- `method`
- `domain`
- `providerId`
- `category`
- `actionId`
- `source` with values like `live-route` or `discovered-device`
- `nodeId`
- `search`

## Why This Is The First Stop

The service merges two sources:

- live route enumeration from registered Express routes
- semantic provider and action metadata from the platform service provider registry
- discovered ESP32 device endpoints synthesized from live node `services/describe` payloads

That means the response is better than raw code search and better than stale prose. It can tell a model:

- method
- path
- permission
- domain
- provider
- action id
- action kind
- description
- path parameters
- tags

## Recommended Query Pattern For Models

1. Call `GET /api/platform/apis/summary` to understand the available surface.
2. Call `GET /api/platform/apis?search=...` or filter by `providerId`, `domain`, `category`, or `method`.
3. Call `GET /api/platform/apis/lookup` for an exact endpoint.
4. Call `GET /api/platform/providers/:providerId/actions/:actionId` for provider-specific semantics.

## Example Queries

List queue-related APIs:

```http
GET /api/platform/apis?providerId=queue
```

List routing APIs:

```http
GET /api/platform/apis?providerId=router
```

Find all write endpoints in topology:

```http
GET /api/platform/apis?domain=topology&method=POST
```

Resolve one exact endpoint:

```http
GET /api/platform/apis/lookup?method=GET&path=/api/nodes
```

List semantic provider actions only:

```http
GET /api/platform/apis/actions
GET /api/platform/apis/actions?providerId=topology
```

List only discovered device APIs:

```http
GET /api/platform/apis?source=discovered-device
```

List only one node's discovered APIs:

```http
GET /api/platform/apis?source=discovered-device&nodeId=esp32-115
```

## Scope Note

This service catalogs Aggregator backend APIs and any ESP32 firmware endpoints that are discoverable from live node metadata today. Device-facing docs and route files are still the deeper reference for firmware specifics, including:

- `documents/FFS_API.md`
- `documents/CAMERA_API.md`
- `documents/DISPLAY_API.md`
- `src/pmachine_routes.cpp`
- `src/ffs/FederatedFileSystemRoutes.cpp`

Only device commands whose `services/describe` metadata exposes an HTTP verb and path are synthesized into the catalog. If a service description omits the concrete route, the endpoint will still require firmware-doc or source lookup.