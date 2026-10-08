# Data Mapper execution boundary

`POST /api/mapper/maps/:id/run` delegates execution planning and output construction to the hosted Pascalish service in `src/mapper/execution-policy.pas`, through `src/mapper/execution-policy.mjs`.

`POST /api/mapper/maps/:id/auto-shape-map` delegates selected-node structural compatibility checks and matching leaf-pair expansion to the same service.

Schema snapshots are flattened by the Pascalish `/flatten` action as well. The resulting preorder list feeds shape mapping, structure signatures, and synthetic test payload construction.

The Pascalish policy owns schema flattening, dotted source-path reads, missing-source diagnostics, direct-move type compatibility checks, target-path writes, recursive shape compatibility and expansion, and the execution-plan/result shapes. A non-standard direct move or shape mismatch returns HTTP 409; missing source values remain warnings and do not prevent other rules from running.

The Node adapter and routes retain map-file and schema-version I/O, rule normalization, duplicate-rule handling, persistence, HTTP response shaping, and error translation. Conversion routines in `conversionRule` are still executed by the existing PL/0 interpreter; this change moves the surrounding mapping policy, not conversion execution, to Pascalish.
