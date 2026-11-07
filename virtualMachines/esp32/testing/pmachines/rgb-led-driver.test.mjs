import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('RGB LED validates settings, preserves state on failure and emits scaled GRB pulses', async () => {
  const header = await readFile(new URL('../../src/DeviceDriverTemplate.h', import.meta.url), 'utf8');
  const base = header.slice(header.indexOf('class DeviceDriverBase {'), header.indexOf('#define DEVICE_DRIVER_PUBLISH'));
  const driver = header.slice(header.indexOf('class AddressableLedDriver :'), header.indexOf('\n#endif', header.indexOf('class AddressableLedDriver :')));
  const runtime = header.slice(header.indexOf('struct OpenDeviceDescriptor {'));
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pulse-rgb-'));
  try {
    const source = path.join(directory, 'rgb.cpp');
    await writeFile(source, `#include <cassert>
#include <cstdint>
#include <cctype>
#include <string>
#include <map>
#include <vector>
#include <algorithm>
#include <memory>
#include <mutex>
#include <thread>
struct rmt_obj_t {};
struct rmt_data_t { unsigned duration0, level0, duration1, level1; };
constexpr int RMT_TX_MODE = 1, RMT_MEM_64 = 1;
bool initializeOk = true, transmitOk = true;
int tick = 100, writes = 0, releases = 0;
std::vector<rmt_data_t> emitted;
rmt_obj_t transmitter;
rmt_obj_t* rmtInit(int pin, int, int) { assert(pin == 48); return initializeOk ? &transmitter : nullptr; }
int rmtSetTick(rmt_obj_t*, int requested) { assert(requested == 100); return tick; }
bool rmtDeinit(rmt_obj_t*) { ++releases; return true; }
bool rmtWriteBlocking(rmt_obj_t*, rmt_data_t* data, int count) {
    ++writes;
    if (!transmitOk) return false;
    emitted.assign(data, data + count);
    return true;
}
struct SerialMock { void printf(const char*, int) {} } Serial;
${base}
${driver}
struct DigitalOutputConfig { bool activeLow = false, defaultState = false; };
class DigitalOutputDriver : public AddressableLedDriver {
public:
    DigitalOutputDriver(const std::string& id, int pin, const DigitalOutputConfig& = {})
        : AddressableLedDriver(id, pin) {}
};
class AnalogInputDriver : public AddressableLedDriver {
public:
    using AddressableLedDriver::AddressableLedDriver;
};
bool pinAvailable = true;
struct GpioPinSemaphore {
    explicit GpioPinSemaphore(int) {}
    bool acquired() const { return pinAvailable; }
};
bool isGpioOutputCapablePin(int pin) { return pin == 48; }
${runtime}
std::vector<unsigned> channels() {
    assert(emitted.size() == 25);
    assert(emitted[24].level0 == 0 && emitted[24].duration0 == 3000);
    assert(emitted[24].level1 == 0 && emitted[24].duration1 == 1);
    std::vector<unsigned> result(3, 0);
    for (unsigned bit = 0; bit < 24; ++bit) {
        const auto& pulse = emitted[bit];
        assert(pulse.level0 == 1 && pulse.level1 == 0);
        assert((pulse.duration0 == 8 && pulse.duration1 == 4) ||
               (pulse.duration0 == 4 && pulse.duration1 == 8));
        result[bit / 8] = (result[bit / 8] << 1) | (pulse.duration0 == 8);
    }
    return result;
}
int main() {
    {
        AddressableLedDriver led("BoardLed", 48);
        assert(!led.setState("power", "on"));
        assert(led.begin());
        assert(!led.begin());
        assert(led.getSupportedStates() == (std::vector<std::string>{"power", "color", "intensity"}));
        assert(led.getMetadata().at("intensityMax") == "255");
        assert(led.getState("power") == "off");
        assert(led.getState("color") == "#00FF00");
        assert(led.getState("intensity") == "32");
        assert(channels() == (std::vector<unsigned>{0, 0, 0}));
        for (const auto& color : {"", "#123", "FF0000", "#GG0000", "#1234567", " #123456"}) {
            const int before = writes;
            assert(!led.setState("color", color));
            assert(writes == before && led.getState("color") == "#00FF00");
        }
        for (const auto& intensity : {"", "-1", "256", "1000", "1.5", " 32", "+1", "on"}) {
            const int before = writes;
            assert(!led.setState("intensity", intensity));
            assert(writes == before && led.getState("intensity") == "32");
        }
        assert(!led.setState("power", "true"));
        assert(!led.setState("unknown", "1"));
        assert(!led.executeAction("unknown"));
        assert(led.setState("color", "#aB12fF"));
        assert(led.getState("color") == "#AB12FF");
        assert(channels() == (std::vector<unsigned>{0, 0, 0}));
        assert(led.setState("intensity", "255"));
        assert(led.executeAction("turnOn"));
        assert(channels() == (std::vector<unsigned>{18, 171, 255}));
        assert(led.setState("intensity", "128"));
        assert(channels() == (std::vector<unsigned>{9, 86, 128}));
        assert(led.setState("intensity", "0"));
        assert(led.getState("power") == "on");
        assert(channels() == (std::vector<unsigned>{0, 0, 0}));
        assert(led.setState("intensity", "032"));
        assert(led.getState("intensity") == "32");
        assert(led.executeAction("turnOff"));
        assert(led.getState("color") == "#AB12FF" && led.getState("intensity") == "32");
        assert(channels() == (std::vector<unsigned>{0, 0, 0}));
        transmitOk = false;
        assert(!led.setState("power", "on"));
        assert(!led.setState("color", "#FFFFFF"));
        assert(!led.setState("intensity", "255"));
        assert(led.getState("power") == "off");
        assert(led.getState("color") == "#AB12FF" && led.getState("intensity") == "32");
        transmitOk = true;
        assert(led.executeAction("toggle"));
        assert(channels() == (std::vector<unsigned>{2, 21, 32}));
        assert(led.executeAction("toggle"));
        assert(channels() == (std::vector<unsigned>{0, 0, 0}));
    }
    assert(releases == 1);
    initializeOk = false;
    { AddressableLedDriver led("BoardLed", 48); assert(!led.begin()); }
    assert(releases == 1);
    initializeOk = true;
    tick = 99;
    { AddressableLedDriver led("BoardLed", 48); assert(!led.begin()); }
    assert(releases == 2);
    tick = 100;
    transmitOk = false;
    { AddressableLedDriver led("BoardLed", 48); assert(!led.begin()); }
    assert(releases == 3);
    transmitOk = true;
    {
        DeviceRuntime runtime;
        std::string error, result;
        assert(runtime.registerPersistent("BoardLed", "ws2812", 48, error));
        assert(runtime.openedDevices().empty());
        assert(DeviceCapabilityRegistry::instance().findByType("ws2812").size() == 1);
        assert(!runtime.registerPersistent("BoardLed", "ws2812", 48, error));
        assert(runtime.open("WrongName", "ws2812", 48, error) == 0);
        assert(runtime.open("BoardLed", "led", 48, error) == 0);
        assert(runtime.open("BoardLed", "ws2812", 47, error) == 0);
        const int before = writes;
        const int first = runtime.open("BoardLed", "ws2812", 48, error);
        assert(first > 0 && writes == before);
        assert(runtime.open("BoardLed", "ws2812", 48, error) == 0);
        std::vector<std::thread> contenders;
        for (int i = 0; i < 8; ++i) contenders.emplace_back([&runtime] {
            std::string error;
            assert(runtime.open("BoardLed", "ws2812", 48, error) == 0);
        });
        for (auto& thread : contenders) thread.join();
        assert(runtime.operate(first, "write", "color", "#FF8000", result, error));
        assert(runtime.operate(first, "write", "intensity", "128", result, error));
        assert(runtime.operate(first, "write", "power", "on", result, error));
        assert(runtime.close(first));
        assert(!runtime.close(first));
        assert(DeviceCapabilityRegistry::instance().findByType("ws2812").size() == 1);
        pinAvailable = false;
        assert(runtime.open("BoardLed", "ws2812", 48, error) == 0);
        pinAvailable = true;
        const int second = runtime.open("BoardLed", "ws2812", 48, error);
        assert(second > first);
        assert(!runtime.operate(first, "read", "color", "", result, error));
        assert(runtime.operate(second, "read", "color", "", result, error) && result == "#FF8000");
        assert(runtime.operate(second, "read", "intensity", "", result, error) && result == "128");
        assert(runtime.operate(second, "read", "power", "", result, error) && result == "on");
        assert(channels() == (std::vector<unsigned>{64, 128, 0}));
        assert(runtime.operate(second, "write", "power", "off", result, error));
        assert(runtime.close(second));
    }
    {
        DeviceRuntime runtime;
        std::string error;
        const int first = runtime.open("Transient", "ws2812", 48, error);
        assert(first > 0);
        assert(runtime.open("DuplicatePin", "ws2812", 48, error) == 0);
        assert(runtime.close(first));
        const auto devices = DeviceCapabilityRegistry::instance().all();
        assert(std::none_of(devices.begin(), devices.end(),
            [](const DeviceCapabilityDescriptor& item) { return item.id == "Transient"; }));
    }
}
`);
    const executable = path.join(directory, process.platform === 'win32' ? 'rgb.exe' : 'rgb');
    const compiled = spawnSync(process.env.CXX || 'g++', [
      '-std=c++17', '-Wall', '-Wextra', '-Werror', '-DESP32', '-DPULSE_LEAN_PMACHINE', source, '-o', executable,
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
