import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { compileKotlinToPcode } from '../src/compile-kotlin-to-pcode.mjs';
import { parsePcode } from '../../../virtualMachines/esp32/pmachines/javascript/src/runtime.mjs';
import { requiredHostCapabilities } from '../../../virtualMachines/esp32/pmachines/shared/contracts/host-capabilities.mjs';
import { createNetworkBindings } from '../../../virtualMachines/esp32/pmachines/javascript/src/network-bindings.mjs';

test('Kotlin Bluetooth discovery daemon uses the ESP32 Bluetooth capability', async () => {
  const source = await fs.readFile(new URL('../examples/bluetooth-discovery-daemon.kt', import.meta.url), 'utf8');
  const compiled = compileKotlinToPcode(source, {
    fileName: 'bluetooth-discovery-daemon.kt', target: 'esp32',
    daemonId: 'bluetooth-discovery', daemonRefreshMs: 30000
  });
  assert.deepEqual(requiredHostCapabilities(parsePcode(compiled.pcodeText)), ['bluetooth.discovery']);
  assert.match(compiled.pcodeText, /CALL_EXT host\.bluetooth_scan 1/);
});

test('JavaScript Bluetooth binding reports that scanning is ESP32-only', async () => {
  const scan = createNetworkBindings()['host.bluetooth_scan'];
  await assert.rejects(scan(3), /only supported by the ESP32 host/);
});
