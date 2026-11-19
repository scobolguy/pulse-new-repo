import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('GPIO coordination covers S3 GPIO48 without enabling flash pins or changing classic ESP32 outputs', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-gpio-'));
  try {
    const headers = {
      'soc/soc_caps.h': `#pragma once
#if defined(CONFIG_IDF_TARGET_ESP32S3)
#define SOC_GPIO_PIN_COUNT 49
#else
#define SOC_GPIO_PIN_COUNT 40
#endif
`,
      'driver/gpio.h': `#pragma once
#define GPIO_IS_VALID_OUTPUT_GPIO(pin) (((1ULL << (pin)) & (((1ULL << 22) - 1) | ((1ULL << 46) - (1ULL << 26)) | (3ULL << 47))) != 0)
`,
      'freertos/FreeRTOS.h': `#pragma once
#include <cstdint>
#include <atomic>
#include <chrono>
#include <mutex>
#include <new>
struct StaticSemaphore_t { std::timed_mutex mutex; };
using SemaphoreHandle_t = StaticSemaphore_t*;
using portMUX_TYPE = std::mutex;
constexpr int pdTRUE = 1;
#define pdMS_TO_TICKS(ms) (ms)
#define portMUX_INITIALIZER_UNLOCKED {}
#define portENTER_CRITICAL(mux) (mux)->lock()
#define portEXIT_CRITICAL(mux) (mux)->unlock()
inline std::atomic<int> liveMutexes{0};
inline std::atomic<bool> failNextMutexAllocation{false};
`,
      'freertos/semphr.h': `#pragma once
#include "FreeRTOS.h"
inline SemaphoreHandle_t xSemaphoreCreateMutex() {
    if (failNextMutexAllocation.exchange(false)) return nullptr;
    auto* semaphore = new (std::nothrow) StaticSemaphore_t{};
    if (semaphore != nullptr) ++liveMutexes;
    return semaphore;
}
inline int xSemaphoreTake(SemaphoreHandle_t semaphore, uint32_t) {
    return semaphore->mutex.try_lock() ? pdTRUE : 0;
}
inline void xSemaphoreGive(SemaphoreHandle_t semaphore) {
    semaphore->mutex.unlock();
}
inline void vSemaphoreDelete(SemaphoreHandle_t semaphore) {
    delete semaphore;
    --liveMutexes;
}
`,
    };
    for (const [name, content] of Object.entries(headers)) {
      const file = path.join(directory, ...name.split('/'));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
    }
    const source = path.join(directory, 'probe.cpp');
    await writeFile(source, `#include <cassert>
#include "GpioPinSemaphore.h"
#include <freertos/FreeRTOS.h>
#include <soc/soc_caps.h>
int main() {
    { GpioPinSemaphore before(2, 0); assert(!before.ready()); assert(!before.acquired()); }
    assert(initializeGpioPinSemaphores());
    assert(liveMutexes == 0);
    failNextMutexAllocation = true;
    {
        GpioPinSemaphore failed(2, 0);
        assert(!failed.ready());
        assert(!failed.acquired());
    }
    {
        GpioPinSemaphore first(2, 0);
        assert(first.ready());
        assert(first.acquired());
        GpioPinSemaphore secondPin(3, 0);
        assert(secondPin.ready());
        assert(!secondPin.acquired());
    }
    assert(liveMutexes == 1);
    {
        GpioPinSemaphore retry(3, 0);
        assert(retry.ready());
        assert(retry.acquired());
    }
    for (int pin = -1; pin <= 60; ++pin) {
        GpioPinSemaphore first(pin, 0);
        assert(first.ready() == (pin >= 0 && pin < SOC_GPIO_PIN_COUNT));
        assert(first.acquired() == first.ready());
        if (first.acquired()) {
            GpioPinSemaphore second(pin, 0);
            assert(!second.acquired());
        }
#if defined(CONFIG_IDF_TARGET_ESP32S3)
        const bool output = (pin >= 0 && pin <= 21) || (pin >= 38 && pin <= 45) || pin == 47 || pin == 48;
#else
        const bool output = (pin >= 0 && pin <= 5) || (pin >= 12 && pin <= 19)
            || (pin >= 21 && pin <= 23) || (pin >= 25 && pin <= 27) || pin == 32 || pin == 33;
#endif
        assert(isGpioOutputCapablePin(pin) == output);
    }
    { GpioPinSemaphore again(2, 0); assert(again.acquired()); }
    assert(liveMutexes == 1);
}
`);
    for (const target of ['classic', 's3']) {
      const executable = path.join(directory, `${target}${process.platform === 'win32' ? '.exe' : ''}`);
      const compiled = spawnSync(process.env.CXX || 'g++', [
        '-std=c++17', '-Wall', '-Wextra', '-Werror', '-DESP32',
        ...(target === 's3' ? ['-DCONFIG_IDF_TARGET_ESP32S3'] : []),
        '-I', directory, '-I', path.join(root, 'src'),
        path.join(root, 'src', 'GpioPinSemaphore.cpp'), source, '-o', executable,
      ], { encoding: 'utf8', windowsHide: true });
      assert.ifError(compiled.error);
      assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
      const result = spawnSync(executable, [], { encoding: 'utf8', windowsHide: true });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
