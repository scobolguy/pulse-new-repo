Import("env")

import json
import os
from pathlib import Path


build_dir = Path(env.subst("$BUILD_DIR"))
build_dir.mkdir(parents=True, exist_ok=True)
trust_header = build_dir / "ota_trust_anchor.h"
public_key_path = os.environ.get("PULSE_OTA_PUBLIC_KEY_FILE")
upload_token = os.environ.get("PULSE_OTA_UPLOAD_TOKEN", "")

env.Append(CPPPATH=[str(build_dir)])

if not public_key_path or not upload_token:
    if trust_header.exists():
        trust_header.unlink()
    print("Pulse OTA disabled: set PULSE_OTA_PUBLIC_KEY_FILE and PULSE_OTA_UPLOAD_TOKEN")
else:
    public_key = Path(public_key_path).read_text(encoding="ascii")
    if "-----BEGIN PUBLIC KEY-----" not in public_key or "-----END PUBLIC KEY-----" not in public_key:
        raise RuntimeError("PULSE_OTA_PUBLIC_KEY_FILE must contain a PEM SubjectPublicKeyInfo public key")
    if not (24 <= len(upload_token) <= 128) or not upload_token.isascii() or not all(
        character.isalnum() or character in "._~-" for character in upload_token
    ):
        raise RuntimeError("PULSE_OTA_UPLOAD_TOKEN must be 24..128 URL-safe ASCII characters")

    trust_header.write_text(
        "#pragma once\n"
        f"static const char pulse_ota_trust_anchor_pem[] = {json.dumps(public_key)};\n"
        "#define PULSE_OTA_TRUST_ANCHOR_PEM pulse_ota_trust_anchor_pem\n"
        f"static const char pulse_ota_upload_token[] = {json.dumps(upload_token)};\n"
        "#define PULSE_OTA_UPLOAD_TOKEN pulse_ota_upload_token\n",
        encoding="ascii",
    )
