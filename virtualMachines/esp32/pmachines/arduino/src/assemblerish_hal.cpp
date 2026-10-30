#if defined(ESP32)
#include "assemblerish_hal.h"
#include "assemblerish_trigger.h"
#include <Arduino.h>
#include <DHT.h>
#include <driver/gpio.h>
#include <esp_task_wdt.h>
#include <freertos/queue.h>
#include <cmath>
#include <atomic>
#include <cctype>
#include <set>

namespace pmachine {
namespace {
struct Device {
    std::string name, kind, pull;
    int pin = -1, channel = 0, hz = 1000, bits = 8, initial = 0;
    bool activeLow = false;
    std::unique_ptr<DHT> sensor;
};
struct Handler {
    std::string id, target, triggerDevice, edge;
    bool timer = false;
    uint32_t interval = 0, debounce = 50;
    std::vector<Device> devices;
    std::vector<PInstruction> instructions;
    ServiceHost* handlers = nullptr;
};
struct Event {
    std::string name;
    int valid = 0, value = 0, auxiliary = 0;
};

class HardwareHandlers {
    SemaphoreHandle_t mutex = nullptr;
    QueueHandle_t triggers = nullptr;
    TaskHandle_t task = nullptr;
    std::unique_ptr<Handler> handler;
    PMachine machine;
    HostExecutionStorage storage;
    AssemblerishTrigger trigger;
    bool sampled = false, sampleAttempted = false, hasEvent = false, faulted = false;
    int temperature = 0, humidity = 0;
    Event event;
    std::string lastError;
    portMUX_TYPE triggerMux = portMUX_INITIALIZER_UNLOCKED;
    uint32_t dropped = 0;
    std::atomic<uint32_t> runs{0}, failures{0}, delivered{0};
    static void IRAM_ATTR interrupt(void* context) {
        auto* self = static_cast<HardwareHandlers*>(context);
        const TickType_t tick = xTaskGetTickCountFromISR();
        BaseType_t woke = pdFALSE;
        if (xQueueSendFromISR(self->triggers, &tick, &woke) != pdTRUE) {
            portENTER_CRITICAL_ISR(&self->triggerMux);
            ++self->dropped;
            portEXIT_CRITICAL_ISR(&self->triggerMux);
        }
        if (woke) portYIELD_FROM_ISR();
    }
    void fail(const std::string& error) {
        lastError = error;
        faulted = true;
        if (handler) {
            if (!handler->timer) detachInterrupt(device(handler->triggerDevice)->pin);
            for (auto& item : handler->devices) {
                if (item.kind == "relay") digitalWrite(item.pin, item.activeLow ? HIGH : LOW);
                if (item.kind == "pwm") ledcWrite(item.channel, 0);
            }
        }
        ++failures;
        Serial.printf("[ASSEMBLERISH] %s\n", error.c_str());
    }
    Device* device(const std::string& name) {
        for (auto& item : handler->devices) if (item.name == name) return &item;
        return nullptr;
    }
    bool call(const std::string& name, const std::vector<HostValue>& args,
              HostValue& result, std::string& error) {
        const auto invalid = [&](const char* reason) { error = reason; return false; };
        result.isString = false;
        result.integer = 0;
        if (hasEvent) return invalid("No operation may follow the final event");
        if (name == "device.hal_event") {
            if (args.size() != 5 || !args[0].isString || !args[1].isString ||
                args[2].isString || args[3].isString || args[4].isString ||
                args[0].text != handler->target || args[1].text.empty() || args[1].text.size() > 32 ||
                (args[2].integer != 0 && args[2].integer != 1))
                return invalid("Invalid final device event");
            event.name = args[1].text;
            event.valid = sampleAttempted && !sampled ? 0 : args[2].integer;
            event.value = sampleAttempted && !sampled ? 0 : args[3].integer;
            event.auxiliary = sampleAttempted && !sampled ? 0 : args[4].integer;
            hasEvent = true;
            result.integer = 1;
            return true;
        }
        if (name == "device.hal_temperature" || name == "device.hal_humidity") {
            if (!args.empty()) return invalid("Sample accessor takes no arguments");
            result.integer = sampled ? (name == "device.hal_temperature" ? temperature : humidity) : 0;
            return true;
        }
        const bool output = name == "device.hal_write" || name == "device.hal_pwm";
        if (args.size() != (output ? 2u : 1u) || !args[0].isString ||
            (output && args[1].isString)) return invalid("Invalid HAL arguments");
        auto* item = device(args[0].text);
        if (!item) return invalid("Undeclared HAL device");
        if (name == "device.hal_read" && item->kind == "input") result.integer = digitalRead(item->pin);
        else if (name == "device.hal_write" && item->kind == "relay") {
            if (args[1].integer != 0 && args[1].integer != 1) return invalid("Relay value must be 0 or 1");
            digitalWrite(item->pin, (args[1].integer != 0) != item->activeLow ? HIGH : LOW);
            result.integer = 1;
        } else if (name == "device.hal_pwm" && item->kind == "pwm") {
            if (args[1].integer < 0 || args[1].integer >= (1 << item->bits))
                return invalid("PWM duty exceeds configured resolution");
            ledcWrite(item->channel, args[1].integer);
            result.integer = 1;
        } else if (name == "device.hal_dht_read" && item->kind == "dht11") {
            if (sampleAttempted) return invalid("DHT11 already sampled in this invocation");
            sampleAttempted = true;
            const float t = item->sensor->readTemperature(), h = item->sensor->readHumidity();
            sampled = std::isfinite(t) && std::isfinite(h);
            temperature = sampled ? static_cast<int>(std::lround(t * 100)) : 0;
            humidity = sampled ? static_cast<int>(std::lround(h * 100)) : 0;
            result.integer = sampled ? 1 : 0;
            if (!sampled) Serial.println("[ASSEMBLERISH] DHT11 sample failed; event valid=0");
        } else return invalid("HAL operation is not permitted for this device");
        return true;
    }
    void run() {
        hasEvent = false;
        sampled = false;
        sampleAttempted = false;
        machine.setHostCallHook([](const std::string& name, const std::vector<HostValue>& args,
                                  HostValue& result, std::string& error, void* context) {
            return static_cast<HardwareHandlers*>(context)->call(name, args, result, error);
        }, this);
        machine.traceEnabled = false;
        if (esp_task_wdt_add(nullptr) != ESP_OK) {
            fail("Unable to subscribe hardware worker to task watchdog");
            return;
        }
        {
            struct WatchdogLease { ~WatchdogLease() { esp_task_wdt_delete(nullptr); } } watchdog;
            machine.runImage(handler->instructions.size(), [&](size_t index) {
                return handler->instructions[index];
            }, &storage);
        }
        ++runs;
        const auto flow = machine.getFlowStateSnapshot();
        const auto failure = flow.find("__runtime_error");
        if (failure != flow.end() || machine.didLastRunHitStepLimit() || !hasEvent ||
            machine.getLastRunStepCount() != handler->instructions.size()) {
            fail(failure != flow.end() ? failure->second : "Handler did not complete its final event");
            return;
        }
        JsonDocument body;
        body["handler"] = handler->id;
        body["event"] = event.name;
        body["valid"] = event.valid;
        body["value"] = event.value;
        body["auxiliary"] = event.auxiliary;
        String text;
        serializeJson(body, text);
        if (body.overflowed() || text.length() != measureJson(body)) {
            fail("Unable to serialize device event");
            return;
        }
        int status = 0;
        std::string error;
        const uint32_t started = millis();
        std::shared_ptr<ServiceHost::HttpEvent> delivery;
        do {
            delivery = handler->handlers->enqueue("POST", handler->target, text.c_str(),
                                                  "hardware", "", status, error);
            if (delivery || status != 503 || error != "Service host ingress busy or unavailable") break;
            vTaskDelay(1);
        } while (millis() - started < 2000);
        if (!delivery) { fail("Device handler rejected event: " + error); return; }
        struct DeliveryLease {
            const std::shared_ptr<ServiceHost::HttpEvent>& event;
            ~DeliveryLease() { event->abandoned.store(true); }
        } lease{delivery};
        delivery->submitted.store(true);
        while (!delivery->ready.load() && millis() - started < 2000) vTaskDelay(1);
        if (!delivery->ready.load()) {
            fail("Device handler event timed out");
        } else if (!delivery->ok || delivery->status < 200 || delivery->status >= 300) {
            fail("Device handler event failed, status " + std::to_string(delivery->status));
        } else { ++delivered; lastError.clear(); }
    }
    void loop() {
        for (;;) {
            TickType_t tick;
            const bool edge = xQueueReceive(triggers, &tick, pdMS_TO_TICKS(10)) == pdTRUE;
            if (xSemaphoreTake(mutex, pdMS_TO_TICKS(10)) != pdTRUE) continue;
            try {
                if (handler && !faulted) {
                    if (handler->timer) {
                        if (trigger.timer(millis(), handler->interval)) run();
                    } else {
                        auto* input = device(handler->triggerDevice);
                        const bool level = digitalRead(input->pin) != 0;
                        if (trigger.edge(millis(), edge, level, handler->debounce)) {
                            if (handler->edge == "change" ||
                                (level && handler->edge == "rising") ||
                                (!level && handler->edge == "falling")) run();
                        }
                    }
                }
            } catch (const std::bad_alloc&) { fail("Handler allocation failed"); }
            xSemaphoreGive(mutex);
        }
    }
    void release() {
        if (!handler) return;
        if (!handler->timer) detachInterrupt(device(handler->triggerDevice)->pin);
        for (auto& item : handler->devices) {
            if (item.kind == "pwm") { ledcWrite(item.channel, 0); ledcDetachPin(item.pin); }
            if (item.kind == "relay") digitalWrite(item.pin, item.activeLow ? HIGH : LOW);
            pinMode(item.pin, INPUT);
        }
        handler.reset();
        xQueueReset(triggers);
    }
public:
    bool prepare(std::string& error) {
        if (task) return true;
        if (!storage.prepare()) { error = "Unable to reserve handler execution storage"; return false; }
        if (!mutex) mutex = xSemaphoreCreateMutex();
        if (!triggers) triggers = xQueueCreate(16, sizeof(TickType_t));
        if (!mutex || !triggers || xTaskCreate([](void* context) {
                static_cast<HardwareHandlers*>(context)->loop();
            }, "assemblerish", 16384, this, 1, &task) != pdPASS) {
            error = "Unable to reserve assemblerish worker";
            return false;
        }
        return true;
    }
    bool install(std::unique_ptr<Handler> next, std::string& error) {
        if (!prepare(error)) return false;
        if (xSemaphoreTake(mutex, pdMS_TO_TICKS(3000)) != pdTRUE) { error = "Hardware handler busy"; return false; }
        if (handler) {
            xSemaphoreGive(mutex);
            error = "Remove the installed hardware handler before installing another";
            return false;
        }
        handler = std::move(next);
        bool ok = true;
        for (auto& item : handler->devices) {
            if (item.kind == "input") pinMode(item.pin, item.pull == "pullup" ? INPUT_PULLUP :
                                                     item.pull == "pulldown" ? INPUT_PULLDOWN : INPUT);
            else if (item.kind == "relay") {
                digitalWrite(item.pin, (item.initial != 0) != item.activeLow ? HIGH : LOW);
                pinMode(item.pin, OUTPUT);
            } else if (item.kind == "pwm") {
                if (ledcSetup(item.channel, item.hz, item.bits) == 0) {
                    error = "Unable to configure PWM channel"; ok = false; break;
                }
                ledcAttachPin(item.pin, item.channel);
                ledcWrite(item.channel, item.initial);
            } else item.sensor->begin();
        }
        if (!ok) release();
        else {
            faulted = false;
            lastError.clear();
            trigger.reset(millis(), false);
            if (!handler->timer) {
                auto* input = device(handler->triggerDevice);
                trigger.reset(millis(), digitalRead(input->pin) != 0);
                attachInterruptArg(input->pin, interrupt, this, CHANGE);
            }
        }
        xSemaphoreGive(mutex);
        return ok;
    }
    bool stop(std::string& error) {
        if (!mutex) return true;
        if (xSemaphoreTake(mutex, pdMS_TO_TICKS(3000)) != pdTRUE) { error = "Hardware handler busy"; return false; }
        release();
        xSemaphoreGive(mutex);
        return true;
    }
    void status(JsonObject out) {
        out["runs"] = runs.load(); out["failures"] = failures.load();
        out["delivered"] = delivered.load();
        portENTER_CRITICAL(&triggerMux);
        const uint32_t lost = dropped;
        portEXIT_CRITICAL(&triggerMux);
        out["droppedTriggers"] = lost;
        if (!mutex) { out["installed"] = false; return; }
        if (xSemaphoreTake(mutex, 0) != pdTRUE) { out["busy"] = true; return; }
        out["installed"] = static_cast<bool>(handler);
        out["faulted"] = faulted;
        if (handler) { out["id"] = handler->id; out["target"] = handler->target; }
        out["lastError"] = lastError;
        xSemaphoreGive(mutex);
    }
};

HardwareHandlers& hardware() { static HardwareHandlers instance; return instance; }

bool permittedPin(int pin) {
    if (!GPIO_IS_VALID_GPIO(pin)) return false;
#if defined(CONFIG_IDF_TARGET_ESP32S3)
    if ((pin >= 26 && pin <= 37) || pin == 0 || pin == 3 || pin == 19 || pin == 20 ||
        pin == 43 || pin == 44 || pin == 45 || pin == 46) return false;
#else
    if ((pin >= 6 && pin <= 11) || pin == 0 || pin == 1 || pin == 2 || pin == 3 ||
        pin == 12 || pin == 15 || (psramFound() && (pin == 16 || pin == 17))) return false;
#endif
    return true;
}
bool identifier(const std::string& value) {
    if (value.empty() || value.size() > 32 || !std::isalpha(static_cast<unsigned char>(value[0]))) return false;
    for (char c : value) if (!std::isalnum(static_cast<unsigned char>(c)) && c != '_' && c != '-') return false;
    return true;
}
}

bool installAssemblerish(const std::string& pcode, JsonObjectConst config, JsonArrayConst approved,
                        ServiceHost& handlers, std::string& error) {
    const auto fail = [&](const char* reason) { error = reason; return false; };
    if (pcode.empty() || pcode.size() > 16384 || config["version"] != 1 ||
        !config["id"].is<const char*>() || !config["target"].is<const char*>() ||
        !config["devices"].is<JsonArrayConst>() || !config["trigger"].is<JsonObjectConst>())
        return fail("Invalid assemblerish configuration");
    auto next = std::unique_ptr<Handler>(new (std::nothrow) Handler);
    if (!next) return fail("Unable to allocate hardware handler");
    next->id = config["id"].as<const char*>();
    next->target = config["target"].as<const char*>();
    if (!identifier(next->id) || next->target.empty() || next->target.size() > 96 ||
        next->target[0] != '/' || !handlers.handles("POST", next->target))
        return fail("A hosted POST device handler must exist before installation");
    std::set<int> allow, pins, channels;
    std::map<int, std::pair<int, int>> pwmTimers;
    for (auto value : approved) {
        if (!value.is<int>() || !permittedPin(value.as<int>())) return fail("Invalid or reserved allowed pin");
        if (!allow.insert(value.as<int>()).second) return fail("Duplicate allowed pin");
    }
    const auto devices = config["devices"].as<JsonArrayConst>();
    if (devices.size() > 8) return fail("Declare at most 8 devices");
    std::set<std::string> names;
    bool dht = false;
    for (auto object : devices) {
        if (!object["name"].is<const char*>() || !object["kind"].is<const char*>() || !object["pin"].is<int>())
            return fail("Invalid device declaration");
        Device item;
        item.name = object["name"].as<const char*>(); item.kind = object["kind"].as<const char*>();
        item.pin = object["pin"].as<int>();
        if (!identifier(item.name) || !names.insert(item.name).second || !allow.count(item.pin) ||
            !pins.insert(item.pin).second) return fail("Device pins must be unique and explicitly allowed");
        if (item.kind == "input") {
            if (!object["pull"].is<const char*>()) return fail("Input requires an explicit pull mode");
            item.pull = object["pull"].as<const char*>();
            if (item.pull != "pullup" && item.pull != "pulldown" && item.pull != "floating")
                return fail("Invalid input pull mode");
#if !defined(CONFIG_IDF_TARGET_ESP32S3)
            if (item.pin >= 34 && item.pull != "floating")
                return fail("ESP32 GPIO34-39 have no internal pull resistors");
#endif
        } else if (item.kind == "relay" || item.kind == "pwm") {
            if (!GPIO_IS_VALID_OUTPUT_GPIO(item.pin) || !object["initial"].is<int>())
                return fail("Invalid output pin or initial value");
            item.initial = object["initial"].as<int>();
            if (item.kind == "relay") {
                if (!object["activeLow"].is<bool>() || (item.initial != 0 && item.initial != 1))
                    return fail("Invalid relay polarity or initial value");
                item.activeLow = object["activeLow"].as<bool>();
            } else {
                if (!object["channel"].is<int>() || !object["hz"].is<int>() || !object["bits"].is<int>())
                    return fail("PWM requires channel, hz and bits");
                item.channel = object["channel"]; item.hz = object["hz"]; item.bits = object["bits"];
                if (item.channel < 0 || item.channel > 7 || !channels.insert(item.channel).second ||
                    item.hz < 1 || item.hz > 40000 || item.bits < 1 || item.bits > 16 ||
                    item.initial < 0 || item.initial >= (1 << item.bits)) return fail("Invalid PWM configuration");
                const auto timing = std::make_pair(item.hz, item.bits);
                const auto timer = pwmTimers.find(item.channel / 2);
                if (timer != pwmTimers.end() && timer->second != timing)
                    return fail("Paired PWM channels must share frequency and resolution");
                pwmTimers[item.channel / 2] = timing;
            }
        } else if (item.kind == "dht11") {
            if (dht || !GPIO_IS_VALID_OUTPUT_GPIO(item.pin)) return fail("Only one output-capable DHT11 pin is supported");
            dht = true;
            item.sensor.reset(new (std::nothrow) DHT(item.pin, DHT11));
            if (!item.sensor) return fail("Unable to allocate DHT11 driver");
        } else return fail("Unknown device kind");
        next->devices.push_back(std::move(item));
    }
    auto trigger = config["trigger"].as<JsonObjectConst>();
    const std::string kind = trigger["kind"] | "";
    next->timer = kind == "timer";
    if (next->timer) {
        if (!trigger["intervalMs"].is<uint32_t>()) return fail("Timer interval must be an integer");
        next->interval = trigger["intervalMs"];
        if (next->interval < (dht ? 2000u : 50u) || next->interval > 86400000) return fail("Invalid timer interval");
    } else {
        if (kind != "edge" || dht || !trigger["device"].is<const char*>() ||
            !trigger["edge"].is<const char*>() || !trigger["debounceMs"].is<uint32_t>())
            return fail("Invalid edge trigger; DHT11 requires a timer");
        next->triggerDevice = trigger["device"].as<const char*>();
        next->edge = trigger["edge"].as<const char*>();
        next->debounce = trigger["debounceMs"];
        bool found = false;
        for (const auto& item : next->devices)
            if (item.name == next->triggerDevice && item.kind == "input") found = true;
        if (!found || next->debounce < 1 || next->debounce > 2000 ||
            (next->edge != "rising" && next->edge != "falling" && next->edge != "change"))
            return fail("Invalid edge device or debounce");
    }
    next->instructions = loadTextPCode(pcode);
    const auto& code = next->instructions;
    if (code.size() < 4 || code.size() > 256 || code.back().opcode != OP_HALT ||
        code[code.size() - 2].opcode != OP_STORE_NAME ||
        code[code.size() - 3].opcode != OP_CALL_EXT || code[code.size() - 3].strOperand != "device.hal_event")
        return fail("Handler must end with exactly one final event");
    std::map<std::string, std::string> registers;
    std::vector<std::string> stack;
    size_t events = 0, samples = 0;
    const std::string integerType(1, '\0');
    for (size_t pc = 0; pc < code.size(); ++pc) {
        const auto& instruction = code[pc];
        if (instruction.opcode == OP_CALL_EXT) {
            static const std::map<std::string, int> arities = {
                {"device.hal_read", 1}, {"device.hal_write", 2}, {"device.hal_pwm", 2},
                {"device.hal_dht_read", 1}, {"device.hal_temperature", 0}, {"device.hal_humidity", 0},
                {"device.hal_event", 5}
            };
            const auto binding = arities.find(instruction.strOperand);
            if (binding == arities.end() || instruction.value != binding->second)
                return fail("Unapproved HAL call or argument count");
            const auto argc = static_cast<size_t>(binding->second);
            if (stack.size() < argc) return fail("HAL argument stack underflow");
            const size_t base = stack.size() - argc;
            if (instruction.strOperand == "device.hal_event") {
                if (stack[base] != next->target || !identifier(stack[base + 1]) ||
                    stack[base + 2] != integerType || stack[base + 3] != integerType ||
                    stack[base + 4] != integerType || pc != code.size() - 3)
                    return fail("Invalid final event arguments");
                ++events;
            } else if (argc > 0) {
                const Device* declared = nullptr;
                for (const auto& item : next->devices) if (item.name == stack[base]) declared = &item;
                const std::string expected = instruction.strOperand == "device.hal_read" ? "input" :
                    instruction.strOperand == "device.hal_write" ? "relay" :
                    instruction.strOperand == "device.hal_pwm" ? "pwm" : "dht11";
                if (!declared || declared->kind != expected ||
                    (argc == 2 && stack[base + 1] != integerType))
                    return fail("HAL call violates declared device grants");
                if (expected == "dht11" && ++samples > 1) return fail("Sample DHT11 only once per invocation");
            } else if (samples == 0) return fail("Read the DHT11 before accessing its sample");
            stack.resize(base);
            stack.push_back(integerType);
        } else if (instruction.opcode == OP_NOT) {
            if (stack.empty() || stack.back() != integerType) return fail("NOT requires an integer");
        } else if (instruction.opcode == OP_PUSH_INT) stack.push_back(integerType);
        else if (instruction.opcode == OP_PUSH_STR) {
            if (instruction.strOperand.size() > 128 || instruction.strOperand.find('\0') != std::string::npos)
                return fail("Invalid handler string");
            stack.push_back(instruction.strOperand);
        } else if (instruction.opcode == OP_STORE_NAME) {
            if (stack.empty() || instruction.strOperand.empty() || instruction.strOperand.size() > 32)
                return fail("Invalid register store");
            registers[instruction.strOperand] = stack.back();
            stack.pop_back();
        } else if (instruction.opcode == OP_LOAD_NAME) {
            const auto variable = registers.find(instruction.strOperand);
            if (variable == registers.end()) return fail("Register used before initialization");
            stack.push_back(variable->second);
        } else if (instruction.opcode != OP_HALT || pc != code.size() - 1 || !stack.empty())
            return fail("Handler contains an unbounded or unsupported opcode");
    }
    if (events != 1) return fail("Exactly one final event is required");
    next->handlers = &handlers;
    return hardware().install(std::move(next), error);
}
bool stopAssemblerish(std::string& error) { return hardware().stop(error); }
void assemblerishStatus(JsonObject out) { hardware().status(out); }
}
#endif
