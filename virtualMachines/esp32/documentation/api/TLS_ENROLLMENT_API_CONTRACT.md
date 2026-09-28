# TLS Enrollment API Contract (v1)

Status: Draft for implementation
Scope: Device enrollment and certificate lifecycle for ESP32 and ESP8266

## 1. Goals

- Replace LAN-password trust with certificate-based device identity.
- Keep endpoint contract identical across ESP32 and ESP8266.
- Keep runtime implementation separate per platform.
- Allow phased migration from current password flow.

## 2. Security Model

- Discovery is unauthenticated and untrusted (mDNS/UDP/scan only).
- Enrollment is authenticated with a short-lived bootstrap secret.
- Operational control uses TLS device identity.
- Long term target is mTLS (device cert + controller cert).

## 3. Identity Model

Every device has a stable identity tuple:

- deviceId: firmware-level unique ID (string)
- hardware: esp32 | esp8266
- mac: device MAC string
- serial: optional manufacturing serial

Certificate identity requirements:

- Subject CN: deviceId
- SAN contains at least one of:
  - URI:urn:pulse:device:{deviceId}
  - DNS:{deviceId}
  - IP:{current_lan_ip} (optional, not primary)

## 4. Endpoint Contract (Shared)

Base path: /tls
Content type: application/json unless noted

### 4.1 GET /tls/status

Purpose: health and state of TLS materials and listener.

Response 200:

{
  "httpsRunning": true,
  "bundledFallback": false,
  "certPresent": true,
  "keyPresent": true,
  "caPresent": true,
  "mtlsRequired": false,
  "enrollmentState": "enrolled",
  "deviceId": "esp32-5e6c5c",
  "certFingerprintSha256": "AB:CD:...",
  "certNotAfter": "2030-08-01T00:00:00Z",
  "contractVersion": "v1"
}

### 4.2 POST /tls/enroll/start

Purpose: begin enrollment session with one-time secret.

Request:

{
  "bootstrapSecret": "<short-lived secret>",
  "nonce": "<client nonce>"
}

Response 200:

{
  "sessionId": "enr_01J...",
  "expiresAt": "2026-08-04T18:00:00Z",
  "deviceId": "esp32-5e6c5c",
  "hardware": "esp32",
  "mac": "b8:d6:1a:5e:6c:5c"
}

Errors:

- 401 invalid bootstrapSecret
- 429 too many attempts

### 4.3 POST /tls/enroll/csr

Purpose: return CSR generated on-device private key.

Request:

{
  "sessionId": "enr_01J..."
}

Response 200:

{
  "csrPem": "-----BEGIN CERTIFICATE REQUEST-----...",
  "keyAlgorithm": "RSA-2048",
  "deviceId": "esp32-5e6c5c"
}

Errors:

- 401 invalid session
- 410 expired session

### 4.4 POST /tls/enroll/commit

Purpose: install signed cert chain after CA signs CSR.

Request:

{
  "sessionId": "enr_01J...",
  "certPem": "-----BEGIN CERTIFICATE-----...",
  "caPem": "-----BEGIN CERTIFICATE-----...",
  "requireMtls": false
}

Response 200:

{
  "installed": true,
  "httpsRunning": true,
  "bundledFallback": false,
  "enrollmentState": "enrolled"
}

Errors:

- 400 invalid cert/chain
- 401 invalid session
- 422 cert identity mismatch

### 4.5 POST /tls/rotate

Purpose: rotate cert before expiry.

Auth: mTLS or existing authenticated control channel.

Request:

{
  "certPem": "-----BEGIN CERTIFICATE-----...",
  "caPem": "-----BEGIN CERTIFICATE-----..."
}

Response 200:

{
  "rotated": true,
  "certNotAfter": "2030-09-01T00:00:00Z"
}

### 4.6 POST /tls/revoke

Purpose: mark cert locally revoked and disable sensitive ops until re-enrolled.

Auth: mTLS admin or recovery physical action token.

Request:

{
  "reason": "key_compromise"
}

Response 200:

{
  "revoked": true,
  "enrollmentState": "revoked"
}

### 4.7 POST /tls/recovery/reset

Purpose: wipe TLS materials and return to bootstrap mode.

Auth: physical-presence gate (button hold) plus bootstrapSecret.

Request:

{
  "bootstrapSecret": "<short-lived secret>",
  "confirm": "ERASE_TLS"
}

Response 200:

{
  "reset": true,
  "enrollmentState": "bootstrap"
}

## 5. File Layout on Device (Shared)

- /tls/key.pem        (private key, device-generated)
- /tls/cert.pem       (leaf cert)
- /tls/ca.pem         (CA cert or chain root)
- /tls/state.json     (enrollment state metadata)
- /tls/bootstrap.json (rate limit counters, optional)

## 6. Enrollment States (Shared)

- bootstrap: no trusted cert chain installed
- pending: enrollment session active
- enrolled: signed cert installed and valid
- rotating: in certificate rotation flow
- revoked: certificate revoked locally

## 7. Auth Rules by State

- bootstrap:
  - allow /tls/status, /tls/enroll/start, /tls/enroll/csr, /tls/enroll/commit
  - deny sensitive control routes unless legacy mode explicitly enabled
- enrolled:
  - deny /tls/enroll/start by default
  - allow /tls/rotate
  - require TLS-authenticated client for sensitive routes

## 8. Platform Separation Requirements

Keep implementations separate in different files while preserving contract.

ESP32 implementation files:

- src/https_core.cpp
- src/https_service.cpp

ESP8266 implementation files:

- src/https_core_esp8266.cpp
- src/https_service_esp8266.cpp

Shared declarations only:

- src/https_service.h

No platform-specific include leakage between ESP32 and ESP8266 runtime files.

## 9. Backward Compatibility Plan

Phase 0 (current):

- existing LAN-password discovery/control still works
- cert upload routes exist

Phase 1:

- add enrollment endpoints above
- keep LAN password only for bootstrap routes

Phase 2:

- require certificate identity for operational routes
- disable LAN-password auth for normal control

Phase 3:

- mTLS required for sensitive and write operations
- LAN password removed except recovery mode

## 10. Error Contract (Shared)

All non-2xx responses use:

{
  "error": "short_code",
  "message": "human readable",
  "status": 401,
  "requestId": "req_..."
}

Standard error codes:

- invalid_secret
- session_expired
- cert_invalid
- cert_identity_mismatch
- tls_not_ready
- physical_presence_required
- rate_limited

## 11. Minimum Validation Checklist

Device-side checks on commit/rotate:

- PEM parse successful
- cert chains to installed CA
- cert identity matches deviceId/mac policy
- key matches cert public key
- not expired (with tolerance)

## 12. Recommended Next Implementation Steps

1. Implement /tls/enroll/start and /tls/enroll/csr first (both platforms).
2. Add /tls/enroll/commit with identity checks.
3. Add /tls/state.json tracking and status fields.
4. Gate sensitive routes based on enrollmentState.
5. Add rotate/recovery endpoints.
