import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildGenericNative(testSource, executable, { hostLibrary = true } = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const names = [
    'scalar_runtime.cpp', 'host_bindings.cpp', 'pmachine.cpp', 'pmachine_opcodes_extended.cpp',
    'pmachine_dynamic_library.cpp', 'pmachine_scheduler.cpp', 'hosted_image.cpp',
    'fortran_runtime.cpp', 'system_runtime.cpp',
  ];
  if (hostLibrary) names.push('cobol_host_library.cpp');
  const sources = names.map(name => path.join(root, 'pmachines', 'arduino', 'src', name));
  sources.push(path.join(root, 'libraries', 'fortran', 'fortran_format.cpp'));
  sources.push(path.join(root, 'libraries', 'fortran', 'fortran_files.cpp'));
  sources.push(path.join(root, 'src', 'StringPool.cpp'));
  const build = spawnSync(process.env.CXX || 'g++', [
    '-std=c++17', '-Wall', '-Wextra', '-DPLATFORM_RPIB=1',
    `-DPULSE_COBOL_HOST_LIBRARY=${Number(hostLibrary)}`,
    ...['raspberry-pi\\include', 'src', 'pmachines\\arduino\\src',
      '.pio\\libdeps\\esp32_s3_pmachine_n8r8\\ArduinoJson\\src']
      .map(directory => '-I' + path.join(root, ...directory.split('\\'))),
    testSource, ...sources, '-o', executable,
  ], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  assert.ifError(build.error);
  assert.equal(build.status, 0, build.stdout + build.stderr);
}
