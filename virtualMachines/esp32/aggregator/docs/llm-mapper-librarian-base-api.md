# LLM Base API for Data Librarian + Data Mapper

This project now exposes a compact discoverability API for LLM-driven map generation.

## Purpose

Allow Copilot (or any LLM) to:
- discover what Data Librarian and Data Mapper do,
- discover callable operations and payload contracts,
- generate a pcode/PL0-runnable map artifact, and
- validate output using mapper runtime endpoints.

## Endpoints

### Data Librarian (default port `4300`)

- `GET /api/librarian/llm/base`
- `GET /api/librarian/llm/actions`
- `GET /api/librarian/llm/actions/:id`

### Data Mapper (default port `4200`)

- `GET /api/mapper/llm/base`
- `GET /api/mapper/llm/actions`
- `GET /api/mapper/llm/actions/:id`
- `GET /api/mapper/llm/pcode-map-template`

## Recommended LLM Flow

1. Read librarian capabilities:
   - `GET /api/librarian/llm/base`
2. Discover schemas and pick source/target contracts:
   - `GET /api/librarian/schemas`
3. Read mapper capabilities:
   - `GET /api/mapper/llm/base`
4. Get template map payload:
   - `GET /api/mapper/llm/pcode-map-template?sourceTypeId=<source>&targetTypeId=<target>&mapId=<id>&name=<name>`
5. Create map:
   - `POST /api/mapper/maps`
6. Validate map against a payload:
   - `POST /api/mapper/maps/:id/run`

## Pcode / PL0 Convention

Mapper runtime uses:
- `runPL0(rule.conversionRule, { src, output })`

Rules should write final value to `output`, for example:

```text
output := trim(src);
```

For direct same-type moves, conversion can be blank.

## Notes

- These endpoints are additive and do not change existing librarian/mapper APIs.
- They can be accessed directly from service ports or through backend proxy routes under the same `/api/librarian/*` and `/api/mapper/*` paths.
