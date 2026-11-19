import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('BLE-disabled ESP32 builds without NimBLE and reports discovery unavailable', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-no-ble-'));
  try {
    const source = path.join(directory, 'probe.cpp');
    await writeFile(source, `#include <cassert>
#include "bluetooth_discovery.h"
int main() {
    std::string result, error;
    assert(!pmachine::scanBluetoothDevices(1, result, error));
    assert(error == "Bluetooth discovery is disabled in this firmware profile");
}
`);
    const executable = path.join(directory, `probe${process.platform === 'win32' ? '.exe' : ''}`);
    const compiled = spawnSync(process.env.CXX || 'g++', [
      '-std=c++17', '-Wall', '-Wextra', '-Werror', '-DESP32', '-DPULSE_DISABLE_BLE_DISCOVERY',
      '-I', path.join(root, 'pmachines', 'arduino', 'src'),
      path.join(root, 'pmachines', 'arduino', 'src', 'bluetooth_discovery.cpp'),
      source, '-o', executable,
    ], { encoding: 'utf8', windowsHide: true });
    assert.ifError(compiled.error);
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    const result = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
