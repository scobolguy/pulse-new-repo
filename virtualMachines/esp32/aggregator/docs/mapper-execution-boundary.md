# Data Mapper execution boundary

`POST /api/mapper/maps/:id/run` delegates execution planning and output construction to the hosted Pascalish service in `src/mapper/execution-policy.pas`, through `src/mapper/execution-policy.mjs`.

`POST /api/mapper/maps/:id/auto-shape-map` delegates selected-node structural compatibility checks and matching leaf-pair expansion to the same service.

Schema snapshots are flattened by the Pascalish `/flatten` action as well. The resulting preorder list feeds shape mapping, structure signatures, and synthetic test payload construction.

The Mapper HTTP route groups are dispatched through modular programs under `src/mapper/routes/`. The Pascalish route policy matches map and authoring endpoints, validates required request fields, chooses HTTP status codes, and shapes JSON responses; Express remains responsible for HTTP transport and JavaScript remains responsible for filesystem access, artifact generation, and persistence.

The execution policy owns schema flattening, dotted source-path reads, missing-source diagnostics, direct-move type compatibility checks, target-path writes, recursive shape compatibility and expansion, and the execution-plan/result shapes. A non-standard direct move or shape mismatch returns HTTP 409; missing source values remain warnings and do not prevent other rules from running.

Conversion routines in `conversionRule` are still executed by the existing PL/0 interpreter; this moves HTTP and mapping policy to Pascalish without moving filesystem, artifact, or conversion-runtime responsibilities.
