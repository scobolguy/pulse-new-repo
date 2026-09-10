#!/usr/bin/env bash
# Stops, disables, and removes PULSE systemd units previously installed by
# install-services.sh. Only removes units matching deploy/systemd/*.service
# by name, so it won't touch unrelated system services.
#
# Usage: sudo ./uninstall-services.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
UNITS_DIR="$REPO_ROOT/deploy/systemd"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo) — systemd unit removal requires it." >&2
  exit 1
fi

if [ ! -d "$UNITS_DIR" ]; then
  echo "No unit files found in $UNITS_DIR — nothing to uninstall." >&2
  exit 0
fi

for unit_path in "$UNITS_DIR"/*.service; do
  [ -e "$unit_path" ] || continue
  unit_name="$(basename "$unit_path")"
  echo "Removing $unit_name..."
  systemctl stop "$unit_name" 2>/dev/null || true
  systemctl disable "$unit_name" 2>/dev/null || true
  rm -f "/etc/systemd/system/$unit_name"
done

systemctl daemon-reload
echo "Done."
