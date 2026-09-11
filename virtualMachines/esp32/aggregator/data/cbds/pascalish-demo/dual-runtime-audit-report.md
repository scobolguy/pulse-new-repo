# Pascalish MT103 to PACS.008 Deployment Proof

## Audit Status

**Status: FULL PASS**

The Pascalish service compiled successfully and converted the same audit fixture through both the JavaScript PMachine and the ESP32 node named `Display`.

## Service Under Test

- Service: `cbds-converter`
- Source: `data/cbds/pascalish-demo/cbds-converter.pas`
- Source language: Pascalish
- Mapper: `cbds-converter.cbds-mt103-to-pacs008`
- Input queue: `swift.mt103.parsed`
- Output queue: `cbds.pacs.outbound`
- Generated pcode size: 2,509 bytes
- Program map: HMAC-signed

## Test Method

The source was compiled into pcode and a signed program map. The mapper was emitted as native PMachine operations and dispatched through the generated `MAP_*` routine.

The raw MT103 fixture was parsed into the declared `swift.mt103.parsed` queue object shape before execution. This is an explicit service boundary: the mapper consumes parsed MT103 fields, not raw FIN text.

The reproducible command is:

```powershell
Set-Location aggregator
npm run proof:pascalish:mt103-pacs:dual
```

The runner is [prove-pascalish-mt103-pacs-dual-runtime.mjs](../../scripts/prove-pascalish-mt103-pacs-dual-runtime.mjs).

## Input Fixture

```text
MT103
:20:CBDSREF123456
:21:CBDS-E2E-0001
:23B:CRED
:32A:260702CAD12500,45
:33B:CAD12500,45
:50K:/123456789
ALPHA IMPORTS LTD
:52A:ROYCCAT2
:53A:BOFACATT
:56A:CITIUS33
:57A:TDOMCATTTOR
:59:/000987654321
BETA SUPPLIES INC
:70:INV-2026-07-02
:71A:SHA
:71B:15,00
:72:/INS/CBDS ROUTING
```

## JavaScript PMachine Evidence

**Result: PASS**

The JS PMachine produced one delivery on `cbds.pacs.outbound`. The following business fields were asserted:

| PACS.008 field | Result |
|---|---|
| `GrpHdr.MsgId` | `CBDSREF123456` |
| `PmtId.EndToEndId` | `CBDS-E2E-0001` |
| `IntrBkSttlmDt` | `2026-07-02` |
| `IntrBkSttlmAmt` | `12500.45` |
| `Dbtr.Nm` | `ALPHA IMPORTS LTD` |
| `Cdtr.Nm` | `BETA SUPPLIES INC` |
| `ChrgBr` | `SHA` |

Additional mapped output was present for payment type, BICs, remittance information, charges, and next-agent instructions.

The complete machine-readable result is [dual-runtime-proof.json](dual-runtime-proof.json).

## ESP32 Display Evidence

**Result: PASS**

The proof runner used the registered Display address `http://192.168.2.155` and:

1. Uploaded signed pcode to `/display-mt103.pcode`.
2. Uploaded the signed program map to `/display-mt103.map.json`.
3. Executed those FFS-loaded files through the ESP32 PMachine.
4. Asserted the same PACS.008 fields as the JS proof.
5. Recorded the Display URL and remote artifact paths in the evidence JSON.

PowerShell command:

```powershell
$env:DISPLAY_BASE_URL = "http://<Display-IP>"
Set-Location aggregator
npm run proof:pascalish:mt103-pacs:dual
```

The resulting evidence records `display.status` as `passed`.

## Artifact and Runtime Controls

- The Pascalish grammar was not relaxed for this test.
- The mapper routine is present in generated pcode.
- The program map is signed before hardware upload.
- The test uses deterministic fixture data and deterministic `createdAt` value `PROOF-TIMESTAMP`.
- No credentials or Wi-Fi secrets are stored in the proof artifacts.
- The full mapper output is compared by business fields rather than transport-specific JSON formatting.

## Evidence Files

- Source: [cbds-converter.pas](cbds-converter.pas)
- Machine-readable evidence: [dual-runtime-proof.json](dual-runtime-proof.json)
- Proof runner: [prove-pascalish-mt103-pacs-dual-runtime.mjs](../../scripts/prove-pascalish-mt103-pacs-dual-runtime.mjs)
- Generated pcode: [cbds-converter.pcode](cbds-converter.pcode)
- Generated program map: [cbds-converter.program.json](cbds-converter.program.json)

## Auditor Conclusion

The Pascalish service deployment and conversion path are verified on both the JavaScript PMachine and the `Display` ESP32 PMachine. Both runtimes returned the expected PACS.008 business fields from the same MT103 fixture. The evidence supports a **full pass** for this direct FFS-loaded service execution test.
