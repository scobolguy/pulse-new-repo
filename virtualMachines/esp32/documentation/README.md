# Documentation

Maintained documentation belongs here. Keep documents grouped by audience and concern as the migration proceeds:

- `architecture/` for system design and topology.
- `api/` for HTTP and integration contracts.
- `compilers/` for DSL, grammar, and compiler references.
- `pmachines/` for runtime contracts, opcode references, and parity documentation.
- `operations/` for runbooks, deployment, and incident procedures.
- `guides/` for device, integration, and user workflows.

The legacy `documents/` directory has been retired. New maintained documentation belongs in the categorized directories below.

Start operational work with [operations/RUNBOOK.md](operations/RUNBOOK.md) and [operations/REPOSITORY_HYGIENE_PLAN.md](operations/REPOSITORY_HYGIENE_PLAN.md).

The current ownership moves and remaining physical relocation blockers are tracked in [operations/MIGRATION_MANIFEST.json](operations/MIGRATION_MANIFEST.json).

API contracts begin with [api/README.md](api/README.md) and [api/FFS_API.md](api/FFS_API.md). Device workflow guides are collected under [guides/](guides/), including the [camera integration guide](guides/CAMERA_INTEGRATION_GUIDE.md) and [camera testing guide](guides/CAMERA_TESTING_GUIDE.md).

Compiler and language references are collected under [compilers/](compilers/), while flow runtime semantics live under [architecture/](architecture/). Integration and device workflow material is collected under [guides/](guides/).

Architecture references include the [situation-resolution schema](architecture/SITUATION_RESOLUTION_SCHEMA.md) and [JSON serialization approach](architecture/JSON_Approach.md). PMachine follow-up work is tracked in [pmachines/FUTURE_ENHANCEMENTS.md](pmachines/FUTURE_ENHANCEMENTS.md).

PMachine runtime contracts start with [pmachines/PCODE_Compatibility_Contract.md](pmachines/PCODE_Compatibility_Contract.md). Historical parity gaps are recorded in [pmachines/PARITY_MATRIX.md](pmachines/PARITY_MATRIX.md), and evolution planning plus JSON schemas are in [pmachines/EVOLUTION_STRATEGY.md](pmachines/EVOLUTION_STRATEGY.md).