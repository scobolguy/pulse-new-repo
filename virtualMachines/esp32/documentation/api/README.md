# API Reference

This workspace has a canonical API information service inside the Aggregator. Use that service first for model reasoning, operator discovery, and handoff.

## Canonical API Info Service

Base service: Aggregator backend.

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
- `source` with values such as `live-route` or `discovered-device`
- `nodeId`
- `search`

## Why This Is The First Stop

The service merges three sources:

- live route enumeration from registered Express routes
- semantic provider and action metadata from the platform service provider registry
- discovered ESP32 device endpoints synthesized from live node `services/describe` payloads

That means the response is better than raw code search and better than stale prose. It can describe methods, paths, permissions, domains, providers, action IDs and kinds, descriptions, path parameters, and tags.

## Recommended Query Pattern

1. Call `GET /api/platform/apis/summary` to understand the available surface.
2. Call `GET /api/platform/apis?search=...` or filter by `providerId`, `domain`, `category`, or `method`.
3. Call `GET /api/platform/apis/lookup` for an exact endpoint.
4. Call `GET /api/platform/providers/:providerId/actions/:actionId` for provider-specific semantics.

## Example Queries

```http
GET /api/platform/apis?providerId=queue
GET /api/platform/apis?providerId=router
GET /api/platform/apis?domain=topology&method=POST
GET /api/platform/apis/lookup?method=GET&path=/api/nodes
GET /api/platform/apis/actions
GET /api/platform/apis/actions?providerId=topology
GET /api/platform/apis?source=discovered-device
GET /api/platform/apis?source=discovered-device&nodeId=esp32-115
```

## Scope Note

The service catalogs Aggregator backend APIs and ESP32 firmware endpoints discoverable from live node metadata. Device-facing docs and route files remain the deeper reference for firmware specifics, including:

- [FFS_API.md](FFS_API.md)
- [CAMERA_API.md](CAMERA_API.md)
- [DISPLAY_API.md](DISPLAY_API.md)
- [TLS_ENROLLMENT_API_CONTRACT.md](TLS_ENROLLMENT_API_CONTRACT.md)
- `src/pmachine_routes.cpp`
- `src/ffs/FederatedFileSystemRoutes.cpp`

Only device commands whose `services/describe` metadata exposes an HTTP verb and path are synthesized into the catalog. If a service description omits the concrete route, use firmware documentation or source lookup.