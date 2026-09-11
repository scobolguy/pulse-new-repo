# Communications Interoperability Test Case

This test case defines one mapper service and exercises it through synchronous and asynchronous calls from:

- JavaScript
- Java
- WFL
- COBOLISH
- VBish
- Pascalish

The mapper is a normal HTTP/JSON service. The JavaScript PMachine is the reference runtime for language-generated artifacts, so every language is expected to exchange the same JSON envelope at the service boundary.

## Contract

Mapper service: `mapper-service.mjs`

- `GET /health`
- `POST /map` for synchronous calls
- `POST /map/async` for asynchronous calls
- `GET /jobs/:jobId` to retrieve an asynchronous result

Request:

```json
{
  "mapperId": "communications-normalize",
  "sourceType": "swift-mt103",
  "targetType": "pacs",
  "payload": {
    "reference": "COMM-SYNC-001",
    "amount": "100,25",
    "currency": "USD"
  }
}
```

Response:

```json
{
  "mapperId": "communications-normalize",
  "sourceType": "swift-mt103",
  "targetType": "pacs",
  "mode": "sync",
  "payload": {
    "messageId": "COMM-SYNC-001",
    "amount": 100.25,
    "currency": "USD"
  }
}
```

Asynchronous calls return `202 Accepted` with a `jobId`. The caller polls `GET /jobs/:jobId` until `status` is `completed`.

## Run

From `aggregator`:

```powershell
node testCases/Communications/run-communications-test.mjs
```

Optional service port:

```powershell
$env:COMMUNICATIONS_MAPPER_PORT = '4780'
node testCases/Communications/run-communications-test.mjs
```

The harness starts the mapper service, tests JavaScript sync/async calls, checks Java availability and Java client compilation, compiles the WFL/COBOLISH/VBish/Pascalish fixtures, and reports unsupported compiler capabilities as explicit gaps.

## Acceptance criteria

1. Sync JavaScript call returns HTTP 200 and the normalized PACS payload.
2. Async JavaScript call returns HTTP 202, a job ID, and a completed result.
3. Java client compiles when `javac` is available and uses the same JSON contract.
4. WFL compiles both `CALL SERVICE` and `CALL SERVICE ... ASYNC`.
5. COBOLISH, VBish, and Pascalish fixtures compile to shared PMachine artifacts or produce a named capability gap.
6. Data Librarian and code librarian declarations are present in every language fixture.
7. Mapper and transformer declarations are present in every language fixture.
8. No language-specific payload shape is accepted at the service boundary.

## Expected current gap

WFL has a tested direct sync/async service-call grammar. The other language front ends currently prove shared librarian, mapper, transformer, and PMachine artifact generation, but may not yet lower a direct service call in their native syntax. The harness records that as a capability gap so it becomes a concrete implementation target rather than an undocumented assumption.

## Baseline run

Run date: 2026-09-10

Command:

```powershell
node testCases/Communications/run-communications-test.mjs
```

Result:

- JavaScript sync mapper call: **PASS**
- JavaScript async mapper call and polling: **PASS**
- Java sync and async HTTP client: **PASS**
- WFL sync and async service-call compilation: **PASS**
- Pascalish mapper/librarian fixture compilation: **PASS**
- COBOLISH fixture: **PASS**
- VBish fixture: **PASS**

The COBOLISH and VBish gaps were caused by their lowering layers emitting `import "..." from mapper;` instead of the established `import mapper "..." from mapper;` form. Both lowerings now use the same grammar-aligned vocabulary.

## Test matrix

| Caller | Sync | Async | Data librarian | Code librarian | Mapper | Transformer | Runtime |
|---|---:|---:|---:|---:|---:|---:|---|
| JavaScript | yes | yes | contract | contract | yes | yes | Node / PMachine boundary |
| Java | compile + contract | compile + contract | contract | contract | yes | yes | JVM client boundary |
| WFL | compile | compile | fixture | fixture | fixture | fixture | JavaScript PMachine workflow |
| COBOLISH | compile/gap report | compile/gap report | fixture | fixture | fixture | fixture | JavaScript PMachine |
| VBish | compile/gap report | compile/gap report | fixture | fixture | fixture | fixture | JavaScript PMachine |
| Pascalish | compile/gap report | compile/gap report | fixture | fixture | fixture | fixture | JavaScript PMachine |
