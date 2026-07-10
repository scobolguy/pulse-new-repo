#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN="${ROOT_DIR}/build/pulse_pi_node"
CFG="${ROOT_DIR}/config/node.example.json"

if [[ ! -x "${BIN}" ]]; then
  echo "Binary not found, running build first..."
  "${SCRIPT_DIR}/build.sh"
fi

exec "${BIN}" "${CFG}"
