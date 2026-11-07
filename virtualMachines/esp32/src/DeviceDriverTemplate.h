#pragma once

#include <Arduino.h>
#include <cctype>
#include <cstdlib>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>
#include <algorithm>
#include "GpioPinSemaphore.h"
#if !defined(PULSE_LEAN_PMACHINE) && __has_include(<DHT.h>)
#include <DHT.h>
#endif
#include "EventScheduler.h"
#if defined(ESP32)
#include <esp32-hal-rmt.h>
#endif

// Generic device-driver base that matches the repository's hardware abstraction pattern.
class DeviceDriverBase {
public:
    virtual ~DeviceDriverBase() = default;
    virtual bool begin() = 0;
    virtual bool update() = 0;
    virtual bool isHealthy() const = 0;
    virtual std::string getId() const = 0;
    virtual std::string getDeviceType() const {
        return "device";
    }
    virtual std::string getDriverType() const {
        return "driver";
    }
    virtual std::map<std::string, std::string> getMetadata() const {
        return {};
    }

    // Standardized DSL-facing state/action contract.
    // This allows a language layer to pass symbolic names like "on"/"off"
    // and "turnOn"/"toggle" without hardcoding device-specific logic.

    // DSL-facing state/action contract.
    // These allow a language layer to pass symbolic names like "on"/"off"
    // or "turnOn"/"toggle" without per-device custom glue.
    virtual std::vector<std::string> getSupportedStates() const {
        return {};
    }

    virtual std::vector<std::string> getSupportedActions() const {
        return {};
    }

    virtual bool setState(const std::string& stateName, const std::string& value) {
        (void)stateName;
        (void)value;
        return false;
    }

    virtual std::string getState(const std::string& stateName) const {
        (void)stateName;
        return {};
    }

    virtual bool executeAction(
        const std::string& actionName,
        const std::map<std::string, std::string>& arguments = {}) {
        (void)actionName;
        (void)arguments;
        return false;
    }
};

struct DeviceCapabilityDescriptor {
    std::string id;
    std::string deviceType = "device";
    std::string driverType = "driver";
    int pin = -1;
    std::string nodeId;
    std::string nodeIp;
    std::vector<std::string> states;
    std::vector<std::string> actions;
    std::map<std::string, std::string> metadata;
};

class DeviceCapabilityRegistry {
public:
    static DeviceCapabilityRegistry& instance() {
        static DeviceCapabilityRegistry registry;
        return registry;
    }

    void registerDevice(
        const std::string& id,
        const std::string& deviceType,
        const DeviceDriverBase* driver,
        const std::string& nodeId = "",
        const std::string& nodeIp = "",
        int pin = -1) {
        if (driver == nullptr) {
            return;
        }

        const std::string resolvedId = id.empty() ? driver->getId() : id;
        DeviceCapabilityDescriptor entry;
        entry.id = resolvedId;
        entry.deviceType = normalizeType(deviceType.empty() ? driver->getDeviceType() : deviceType);
        entry.driverType = normalizeType(driver->getDriverType());
        entry.pin = pin;
        entry.nodeId = nodeId;
        entry.nodeIp = nodeIp;
        entry.states = driver->getSupportedStates();
        entry.actions = driver->getSupportedActions();
        entry.metadata = driver->getMetadata();
        devices_[resolvedId] = entry;
    }

    void unregisterDevice(const std::string& id) {
        devices_.erase(id);
    }

    std::vector<DeviceCapabilityDescriptor> all() const {
        std::vector<DeviceCapabilityDescriptor> result;
        result.reserve(devices_.size());
        for (const auto& pair : devices_) {
            result.push_back(pair.second);
        }
        return result;
    }

    std::vector<DeviceCapabilityDescriptor> findByType(const std::string& wantedType) const {
        const std::string normalizedQuery = normalizeType(wantedType);
        std::vector<DeviceCapabilityDescriptor> result;
        for (const auto& pair : devices_) {
            const DeviceCapabilityDescriptor& candidate = pair.second;
            if (matches(candidate.deviceType, normalizedQuery) ||
                matches(candidate.driverType, normalizedQuery) ||
                matchesAny(candidate.states, normalizedQuery) ||
                matchesAny(candidate.actions, normalizedQuery) ||
                matchesMetadata(candidate.metadata, normalizedQuery)) {
                result.push_back(candidate);
            }
        }
        return result;
    }

private:
    std::map<std::string, DeviceCapabilityDescriptor> devices_;

    static std::string normalizeType(const std::string& value) {
        std::string normalized = value;
        std::transform(normalized.begin(), normalized.end(), normalized.begin(), [](unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });
        while (!normalized.empty() && normalized.front() == ' ') {
            normalized.erase(normalized.begin());
        }
        while (!normalized.empty() && normalized.back() == ' ') {
            normalized.pop_back();
        }
        return normalized;
    }

    static bool matches(const std::string& candidate, const std::string& query) {
        if (query.empty()) {
            return true;
        }
        const std::string normalizedCandidate = normalizeType(candidate);
        return normalizedCandidate == query || normalizedCandidate.find(query) != std::string::npos;
    }

    static bool matchesAny(const std::vector<std::string>& values, const std::string& query) {
        if (query.empty()) {
            return true;
        }
        for (const auto& value : values) {
            if (matches(value, query)) {
                return true;
            }
        }
        return false;
    }

    static bool matchesMetadata(const std::map<std::string, std::string>& metadata, const std::string& query) {
        if (query.empty()) {
            return true;
        }
        for (const auto& pair : metadata) {
            if (matches(pair.first, query) || matches(pair.second, query)) {
                return true;
            }
        }
        return false;
    }
};

#define DEVICE_DRIVER_PUBLISH(driver, deviceId, deviceType, nodeId, nodeIp) \
    do { \
        if ((driver) != nullptr) { \
            DeviceCapabilityRegistry::instance().registerDevice((deviceId), (deviceType), (driver), (nodeId), (nodeIp)); \
        } \
    } while (0)

// Convenience macros for connecting DSL/state/action names to device drivers.
// The low-level GPIO, I2C, SPI, and sensor logic still lives in C++.
#define DEVICE_DRIVER_STATE(driver, stateName, initialValue) \
    do { \
        if ((driver) != nullptr) { \
            (driver)->registerState(stateName, initialValue); \
        } \
    } while (0)

#define DEVICE_DRIVER_ACTION(driver, actionName, actionLambda) \
    do { \
        if ((driver) != nullptr) { \
            (driver)->registerAction(actionName, actionLambda); \
        } \
    } while (0)

#define DEVICE_DRIVER_EVENT_BRIDGE(driver, eventTypeName, schedulerPtr) \
    do { \
        if ((driver) != nullptr && (schedulerPtr) != nullptr) { \
            (schedulerPtr)->setEventExecutor([driver](const ScheduledEvent& event) -> bool { \
                if (!event.deviceType.equalsIgnoreCase(eventTypeName)) { \
                    return false; \
                } \
                return (driver)->executeAction(event.action); \
            }); \
        } \
    } while (0)

// Template-based driver implementation for common ESP32 device patterns.
// DeviceType is the hardware handle or pin value, ConfigType holds driver settings.
template <typename DeviceType, typename ConfigType>
class DeviceDriverTemplate : public DeviceDriverBase {
public:
    using InitFn = bool (*)(DeviceType&, const ConfigType&);
    using UpdateFn = bool (*)(DeviceType&, const ConfigType&);
    using HealthFn = bool (*)(const DeviceType&, const ConfigType&);
    using ActionHandler = std::function<bool(const std::map<std::string, std::string>&, std::string&)>;

    DeviceDriverTemplate(
        const std::string& id,
        DeviceType device,
        const ConfigType& config,
        InitFn initFn,
        UpdateFn updateFn,
        HealthFn healthFn)
        : id_(id),
          device_(device),
          config_(config),
          initFn_(initFn),
          updateFn_(updateFn),
          healthFn_(healthFn) {
    }

    bool begin() override {
        if (!initFn_) {
            return false;
        }
        initialized_ = initFn_(device_, config_);
        return initialized_;
    }

    bool update() override {
        if (!initialized_ || !updateFn_) {
            return false;
        }
        return updateFn_(device_, config_);
    }

    bool isHealthy() const override {
        if (!initialized_ || !healthFn_) {
            return false;
        }
        return healthFn_(device_, config_);
    }

    std::string getId() const override {
        return id_;
    }

    std::vector<std::string> getSupportedStates() const override {
        std::vector<std::string> names;
        names.reserve(stateValues_.size());
        for (const auto& entry : stateValues_) {
            names.push_back(entry.first);
        }
        return names;
    }

    std::vector<std::string> getSupportedActions() const override {
        std::vector<std::string> names;
        names.reserve(actionHandlers_.size());
        for (const auto& entry : actionHandlers_) {
            names.push_back(entry.first);
        }
        return names;
    }

    bool setState(const std::string& stateName, const std::string& value) override {
        auto it = stateValues_.find(stateName);
        if (it == stateValues_.end()) {
            return false;
        }

        if (!stateAllowed(stateName, value)) {
            return false;
        }

        it->second = value;
        if (setStateFn_) {
            std::string result;
            return setStateFn_(stateName, value, result);
        }
        return true;
    }

    std::string getDeviceType() const override {
        return "generic";
    }

    std::string getDriverType() const override {
        return "generic";
    }

    std::map<std::string, std::string> getMetadata() const override {
        return {};
    }

    std::string getState(const std::string& stateName) const override {
        const auto it = stateValues_.find(stateName);
        if (it == stateValues_.end()) {
            return {};
        }
        return it->second;
    }

    bool executeAction(
        const std::string& actionName,
        const std::map<std::string, std::string>& arguments = {}) override {
        const auto it = actionHandlers_.find(actionName);
        if (it == actionHandlers_.end()) {
            return false;
        }

        std::string nextState;
        return it->second(arguments, nextState);
    }

    void registerState(const std::string& stateName, const std::string& initialValue = "") {
        stateValues_[stateName] = initialValue;
    }

    void registerStateValues(const std::string& stateName, const std::vector<std::string>& allowedValues) {
        stateAllowedValues_[stateName] = allowedValues;
        if (stateValues_.find(stateName) == stateValues_.end()) {
            stateValues_[stateName] = allowedValues.empty() ? "" : allowedValues.front();
        }
    }

    void registerAction(
        const std::string& actionName,
        const ActionHandler& handler) {
        actionHandlers_[actionName] = handler;
    }

    void setStateBinder(
        const std::function<bool(const std::string&, const std::string&, std::string&)>& binder) {
        setStateFn_ = binder;
    }

    DeviceType& device() {
        return device_;
    }

    const DeviceType& device() const {
        return device_;
    }

    const ConfigType& config() const {
        return config_;
    }

protected:
    bool stateAllowed(const std::string& stateName, const std::string& value) const {
        const auto it = stateAllowedValues_.find(stateName);
        if (it == stateAllowedValues_.end() || it->second.empty()) {
            return true;
        }

        for (const auto& allowed : it->second) {
            if (allowed == value) {
                return true;
            }
        }
        return false;
    }

    std::string id_;
    DeviceType device_;
    ConfigType config_;
    bool initialized_ = false;
    InitFn initFn_ = nullptr;
    UpdateFn updateFn_ = nullptr;
    HealthFn healthFn_ = nullptr;
    std::map<std::string, std::string> stateValues_;
    std::map<std::string, std::vector<std::string>> stateAllowedValues_;
    std::map<std::string, ActionHandler> actionHandlers_;
    std::function<bool(const std::string&, const std::string&, std::string&)> setStateFn_;
};

struct DigitalOutputConfig {
    bool activeLow = true;
    bool defaultState = false;
};

class DigitalOutputDriver : public DeviceDriverTemplate<int, DigitalOutputConfig> {
public:
    std::string getDeviceType() const override {
        return "switch";
    }

    std::string getDriverType() const override {
        return "digital-output";
    }

    std::map<std::string, std::string> getMetadata() const override {
        std::map<std::string, std::string> metadata;
        metadata["kind"] = "actuator";
        metadata["unit"] = "binary";
        return metadata;
    }

    DigitalOutputDriver(const std::string& id, int pin, const DigitalOutputConfig& config = {})
        : DeviceDriverTemplate<int, DigitalOutputConfig>(
              id,
              pin,
              config,
              [](int& pinValue, const DigitalOutputConfig& cfg) {
                  pinMode(pinValue, OUTPUT);
                  const bool state = cfg.defaultState;
                  digitalWrite(pinValue, state ? (cfg.activeLow ? LOW : HIGH) : (cfg.activeLow ? HIGH : LOW));
                  return true;
              },
              [](int& pinValue, const DigitalOutputConfig& cfg) {
                  (void)pinValue;
                  (void)cfg;
                  return true;
              },
              [](const int& pinValue, const DigitalOutputConfig& cfg) {
                  (void)pinValue;
                  (void)cfg;
                  return true;
              }) {
        registerState("power", config.defaultState ? "on" : "off");
        registerStateValues("power", {"off", "on"});
        registerAction("turnOn", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const bool ok = set(true);
            nextState = currentState_ ? "on" : "off";
            return ok;
        });
        registerAction("turnOff", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const bool ok = set(false);
            nextState = currentState_ ? "on" : "off";
            return ok;
        });
        registerAction("toggle", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const bool ok = toggle();
            nextState = currentState_ ? "on" : "off";
            return ok;
        });
        setStateBinder([this](const std::string& stateName, const std::string& value, std::string& result) {
            if (stateName != "power") {
                result = "unsupported";
                return false;
            }
            if (value == "on") {
                const bool ok = set(true);
                result = ok ? "on" : "error";
                return ok;
            }
            if (value == "off") {
                const bool ok = set(false);
                result = ok ? "off" : "error";
                return ok;
            }
            result = "unsupported";
            return false;
        });
    }

    bool set(bool on) {
        if (!initialized_) {
            return false;
        }

        const bool active = on ^ (config_.activeLow ? 1 : 0);
        digitalWrite(device_, active ? HIGH : LOW);
        currentState_ = on;
        stateValues_["power"] = on ? "on" : "off";
        return true;
    }

    bool get() const {
        return currentState_;
    }

    bool toggle() {
        return set(!currentState_);
    }

private:
    bool currentState_ = false;
};

#if defined(ESP32)
class AddressableLedDriver : public DeviceDriverBase {
public:
    AddressableLedDriver(const std::string& id, int pin) : id_(id), pin_(pin) {}
    ~AddressableLedDriver() override {
        if (transmitter_ && !rmtDeinit(transmitter_)) {
            Serial.printf("[DEVICE] Failed to release RGB LED transmitter on GPIO%d\n", pin_);
        }
    }

    bool begin() override {
        if (transmitter_) return false;
        transmitter_ = rmtInit(pin_, RMT_TX_MODE, RMT_MEM_64);
        if (!transmitter_) return false;
        if (rmtSetTick(transmitter_, 100) != 100) return false;
        return write(false, color_, intensity_);
    }
    bool update() override { return isHealthy(); }
    bool isHealthy() const override { return transmitter_ != nullptr; }
    std::string getId() const override { return id_; }
    std::string getDeviceType() const override { return "led"; }
    std::string getDriverType() const override { return "ws2812"; }
    std::map<std::string, std::string> getMetadata() const override {
        return {{"kind", "actuator"}, {"protocol", "ws2812-grb"},
                {"colorFormat", "#RRGGBB"}, {"intensityMin", "0"}, {"intensityMax", "255"}};
    }
    std::vector<std::string> getSupportedStates() const override { return {"power", "color", "intensity"}; }
    std::vector<std::string> getSupportedActions() const override { return {"turnOn", "turnOff", "toggle"}; }
    std::string getState(const std::string& state) const override {
        if (state == "power") return on_ ? "on" : "off";
        if (state == "color") return color_;
        if (state == "intensity") return std::to_string(intensity_);
        return "";
    }
    bool setState(const std::string& state, const std::string& value) override {
        if (state == "power" && (value == "on" || value == "off")) {
            return write(value == "on", color_, intensity_);
        }
        if (state == "color") {
            if (value.size() != 7 || value[0] != '#') return false;
            std::string color = value;
            for (size_t i = 1; i < color.size(); ++i) {
                if (hexDigit(color[i]) < 0) return false;
                color[i] = static_cast<char>(std::toupper(static_cast<unsigned char>(color[i])));
            }
            return write(on_, color, intensity_);
        }
        if (state == "intensity") {
            if (value.empty() || value.size() > 3) return false;
            unsigned intensity = 0;
            for (char digit : value) {
                if (digit < '0' || digit > '9') return false;
                intensity = intensity * 10 + static_cast<unsigned>(digit - '0');
            }
            if (intensity > 255) return false;
            return write(on_, color_, static_cast<uint8_t>(intensity));
        }
        return false;
    }
    bool executeAction(const std::string& action,
                       const std::map<std::string, std::string>& = {}) override {
        if (action == "turnOn") return write(true, color_, intensity_);
        if (action == "turnOff") return write(false, color_, intensity_);
        if (action == "toggle") return write(!on_, color_, intensity_);
        return false;
    }

private:
    static int hexDigit(char digit) {
        if (digit >= '0' && digit <= '9') return digit - '0';
        if (digit >= 'a' && digit <= 'f') return digit - 'a' + 10;
        if (digit >= 'A' && digit <= 'F') return digit - 'A' + 10;
        return -1;
    }

    bool write(bool on, const std::string& color, uint8_t intensity) {
        if (!transmitter_) return false;
        rmt_data_t signal[25] = {};
        const auto channel = [&](size_t offset) -> uint8_t {
            const unsigned component = hexDigit(color[offset]) * 16 + hexDigit(color[offset + 1]);
            return on ? static_cast<uint8_t>((component * intensity + 127) / 255) : 0;
        };
        const uint8_t grb[] = {channel(3), channel(1), channel(5)};
        for (int bit = 0; bit < 24; ++bit) {
            const bool high = (grb[bit / 8] & (0x80 >> (bit % 8))) != 0;
            signal[bit].level0 = 1;
            signal[bit].duration0 = high ? 8 : 4;
            signal[bit].level1 = 0;
            signal[bit].duration1 = high ? 4 : 8;
        }
        // A 300us low reset also accommodates newer WS2812 variants.
        signal[24].duration0 = 3000;
        signal[24].duration1 = 1;
        if (!rmtWriteBlocking(transmitter_, signal, 25)) return false;
        on_ = on;
        color_ = color;
        intensity_ = intensity;
        return true;
    }

    std::string id_;
    int pin_;
    rmt_obj_t* transmitter_ = nullptr;
    bool on_ = false;
    std::string color_ = "#00FF00";
    uint8_t intensity_ = 32;
};
#endif

struct AnalogInputConfig {
    float minVoltage = 0.0f;
    float maxVoltage = 3.3f;
    float calibrationOffset = 0.0f;
    float calibrationScale = 1.0f;
};

class AnalogInputDriver : public DeviceDriverTemplate<int, AnalogInputConfig> {
public:
    std::string getDeviceType() const override {
        return "sensor";
    }

    std::string getDriverType() const override {
        return "analog-input";
    }

    std::map<std::string, std::string> getMetadata() const override {
        std::map<std::string, std::string> metadata;
        metadata["kind"] = "sensor";
        metadata["unit"] = "voltage";
        return metadata;
    }

    AnalogInputDriver(const std::string& id, int pin, const AnalogInputConfig& config = {})
        : DeviceDriverTemplate<int, AnalogInputConfig>(
              id,
              pin,
              config,
              [](int& pinValue, const AnalogInputConfig& cfg) {
                  (void)cfg;
                  pinMode(pinValue, INPUT);
                  return true;
              },
              [](int& pinValue, const AnalogInputConfig& cfg) {
                  (void)pinValue;
                  (void)cfg;
                  return true;
              },
              [](const int& pinValue, const AnalogInputConfig& cfg) {
                  (void)pinValue;
                  (void)cfg;
                  return true;
              }) {
        registerState("voltage", "0.0");
        registerAction("readVoltage", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const float volts = readVoltage();
            nextState = String(volts, 3).c_str();
            stateValues_["voltage"] = nextState;
            return true;
        });
    }

    float readVoltage() {
        if (!initialized_) {
            return 0.0f;
        }

        const int raw = analogRead(device_);
        const float normalized = static_cast<float>(raw) / 4095.0f;
        float voltage = normalized * (config_.maxVoltage - config_.minVoltage) + config_.minVoltage;
        voltage = (voltage + config_.calibrationOffset) * config_.calibrationScale;
        stateValues_["voltage"] = String(voltage, 3).c_str();
        return voltage;
    }
};

#if !defined(PULSE_LEAN_PMACHINE) && __has_include(<DHT.h>)
struct DHT11Config {
    int dataPin = 4;
    int powerPin = -1;
    bool enablePowerPin = false;
    bool useInternalPullup = true;
    float temperatureOffset = 0.0f;
    float humidityOffset = 0.0f;
    uint32_t readIntervalMs = 2000;
};

class DHT11Driver : public DeviceDriverTemplate<int, DHT11Config> {
public:
    std::string getDeviceType() const override {
        return "temperature";
    }

    std::string getDriverType() const override {
        return "dht11";
    }

    std::map<std::string, std::string> getMetadata() const override {
        std::map<std::string, std::string> metadata;
        metadata["kind"] = "temperature-sensor";
        metadata["unit"] = "celsius";
        metadata["supportsHumidity"] = "true";
        return metadata;
    }

    DHT11Driver(const std::string& id, int pin, const DHT11Config& config = {})
        : DeviceDriverTemplate<int, DHT11Config>(
              id,
              pin,
              config,
              [](int& pinValue, const DHT11Config& cfg) {
                  if (cfg.enablePowerPin && cfg.powerPin >= 0) {
                      pinMode(cfg.powerPin, OUTPUT);
                      digitalWrite(cfg.powerPin, HIGH);
                  }
                  if (cfg.useInternalPullup) {
                      pinMode(pinValue, INPUT_PULLUP);
                  } else {
                      pinMode(pinValue, INPUT);
                  }
                  return true;
              },
              [](int& pinValue, const DHT11Config& cfg) {
                  (void)pinValue;
                  (void)cfg;
                  return true;
              },
              [](const int& pinValue, const DHT11Config& cfg) {
                  (void)pinValue;
                  (void)cfg;
                  return true;
              }) {
        dht_ = new DHT(device_, DHT11);
        if (dht_ != nullptr) {
            dht_->begin();
        }

        registerState("temperature", "0.0");
        registerState("humidity", "0.0");
        registerStateValues("temperature", {"0.0"});
        registerStateValues("humidity", {"0.0"});

        registerAction("read", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const bool ok = readSample();
            nextState = ok ? "ok" : "error";
            return ok;
        });

        registerAction("readTemperature", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const bool ok = readSample();
            nextState = String(temperature_, 2).c_str();
            stateValues_["temperature"] = nextState;
            return ok;
        });

        registerAction("readHumidity", [this](const std::map<std::string, std::string>&, std::string& nextState) {
            const bool ok = readSample();
            nextState = String(humidity_, 2).c_str();
            stateValues_["humidity"] = nextState;
            return ok;
        });

        setStateBinder([this](const std::string& stateName, const std::string& value, std::string& result) {
            if (stateName == "temperature") {
                const float parsed = std::atof(value.c_str());
                temperature_ = parsed;
                stateValues_["temperature"] = value;
                result = value;
                return true;
            }
            if (stateName == "humidity") {
                const float parsed = std::atof(value.c_str());
                humidity_ = parsed;
                stateValues_["humidity"] = value;
                result = value;
                return true;
            }
            result = "unsupported";
            return false;
        });
    }

    ~DHT11Driver() {
        delete dht_;
        dht_ = nullptr;
    }

    bool setPin(int pin) {
        device_ = pin;
        if (dht_ != nullptr) {
            delete dht_;
        }
        dht_ = new DHT(pin, DHT11);
        if (dht_ == nullptr) {
            return false;
        }
        dht_->begin();
        return true;
    }

    void setPowerPin(int powerPin, bool enabled) {
        config_.powerPin = powerPin;
        config_.enablePowerPin = enabled;
        if (enabled && powerPin >= 0) {
            pinMode(powerPin, OUTPUT);
            digitalWrite(powerPin, HIGH);
        }
    }

    bool readSample() {
        if (!initialized_ || dht_ == nullptr) {
            return false;
        }

        const unsigned long now = millis();
        if (now - lastReadMs_ < config_.readIntervalMs && lastReadMs_ != 0) {
            return true;
        }

        float temp = dht_->readTemperature();
        float humidity = dht_->readHumidity();
        if (isnan(temp) || isnan(humidity)) {
            return false;
        }

        temperature_ = temp + config_.temperatureOffset;
        humidity_ = humidity + config_.humidityOffset;
        stateValues_["temperature"] = String(temperature_, 2).c_str();
        stateValues_["humidity"] = String(humidity_, 2).c_str();
        lastReadMs_ = now;
        return true;
    }

    float temperature() const {
        return temperature_;
    }

    float humidity() const {
        return humidity_;
    }

    bool begin() override {
        if (config_.enablePowerPin && config_.powerPin >= 0) {
            pinMode(config_.powerPin, OUTPUT);
            digitalWrite(config_.powerPin, HIGH);
        }
        if (dht_ == nullptr) {
            dht_ = new DHT(device_, DHT11);
            if (dht_ == nullptr) {
                return false;
            }
        }
        dht_->begin();
        initialized_ = true;
        return true;
    }

    bool update() override {
        return readSample();
    }

    bool isHealthy() const override {
        return initialized_ && dht_ != nullptr && !isnan(temperature_) && !isnan(humidity_);
    }

private:
    DHT* dht_ = nullptr;
    float temperature_ = 0.0f;
    float humidity_ = 0.0f;
    uint32_t lastReadMs_ = 0;
};
#endif

struct OpenDeviceDescriptor {
    int handle = 0;
    std::string name;
    std::string type;
    std::string driver;
    int pin = -1;
};

class DeviceRuntime {
public:
    bool registerPersistent(const std::string& name, const std::string& type, int pin, std::string& error) {
        std::lock_guard<std::recursive_mutex> lock(mutex_);
        if (registrations_.find(name) != registrations_.end()) {
            error = "device is already registered";
            return false;
        }
        const int handle = open(name, type, pin, error);
        if (handle == 0) return false;
        registrations_[name] = descriptors_.at(handle);
        return close(handle);
    }

    int open(const std::string& name, const std::string& type, int pin, std::string& error) {
        std::lock_guard<std::recursive_mutex> lock(mutex_);
        if (name.empty() || type.empty() || pin < 0) {
            error = "device name, type, and non-negative pin are required";
            return 0;
        }
        if (handlesByName_.find(name) != handlesByName_.end()) {
            error = "device is already open";
            return 0;
        }

        const auto registration = registrations_.find(name);
        if (registration != registrations_.end() &&
            (registration->second.type != type || registration->second.pin != pin)) {
            error = "device configuration does not match registered hardware";
            return 0;
        }
        for (const auto& entry : descriptors_) {
            if (entry.second.pin == pin) {
                error = "GPIO pin belongs to another open device";
                return 0;
            }
        }
        for (const auto& entry : registrations_) {
            if (entry.first != name && entry.second.pin == pin) {
                error = "GPIO pin belongs to a registered device";
                return 0;
            }
        }
        const int handle = allocateHandle();
        if (handle == 0) {
            error = "device handle table is full";
            return 0;
        }
        GpioPinSemaphore pinSemaphore(pin);
        if (!pinSemaphore.acquired()) {
            error = "GPIO pin is busy";
            return 0;
        }
        std::unique_ptr<DeviceDriverBase> driver;
        auto idle = idleDevices_.find(name);
        if (idle != idleDevices_.end()) {
            driver = std::move(idle->second);
            idleDevices_.erase(idle);
        } else {
            driver = createDriver(name, type, pin);
            if (!driver) {
                error = "unsupported device type: " + type;
                return 0;
            }
            if (!driver->begin()) {
                error = "device initialization failed";
                return 0;
            }
        }
        const std::string driverType = driver->getDriverType();
        DeviceCapabilityRegistry::instance().registerDevice(name, type, driver.get(), "", "", pin);
        handlesByName_[name] = handle;
        devices_.emplace(handle, std::move(driver));
        OpenDeviceDescriptor descriptor;
        descriptor.handle = handle;
        descriptor.name = name;
        descriptor.type = type;
        descriptor.driver = driverType;
        descriptor.pin = pin;
        descriptors_.emplace(handle, descriptor);
        error.clear();
        return handle;
    }

    bool operate(int handle, const std::string& operation, const std::string& state,
                 const std::string& value, std::string& result, std::string& error) {
        std::lock_guard<std::recursive_mutex> lock(mutex_);
        auto found = devices_.find(handle);
        if (found == devices_.end()) {
            error = "invalid device handle";
            return false;
        }
        const auto descriptor = descriptors_.find(handle);
        if (descriptor == descriptors_.end()) {
            error = "device descriptor is unavailable";
            return false;
        }
        GpioPinSemaphore pinSemaphore(descriptor->second.pin);
        if (!pinSemaphore.acquired()) {
            error = "GPIO pin is busy";
            return false;
        }
        DeviceDriverBase& driver = *found->second;
        std::string normalizedOperation = operation;
        std::transform(normalizedOperation.begin(), normalizedOperation.end(), normalizedOperation.begin(), [](unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });
        bool ok = false;
        if (normalizedOperation == "read") {
            if (!driver.update()) {
                error = "device update failed";
                return false;
            }
            result = driver.getState(state);
            ok = !result.empty();
        } else if (normalizedOperation == "write") {
            ok = driver.setState(state, value);
            if (ok) result = driver.getState(state);
        } else if (normalizedOperation == "action") {
            ok = driver.executeAction(state);
            if (ok) result = "ok";
        } else {
            error = "unsupported device operation: " + operation;
            return false;
        }
        if (!ok) {
            error = "device operation failed: " + state;
            return false;
        }
        error.clear();
        return true;
    }

    bool close(int handle) {
        std::lock_guard<std::recursive_mutex> lock(mutex_);
        auto found = devices_.find(handle);
        if (found == devices_.end()) return false;
        const auto descriptor = descriptors_.find(handle);
        if (descriptor != descriptors_.end()) {
            handlesByName_.erase(descriptor->second.name);
            if (registrations_.find(descriptor->second.name) != registrations_.end()) {
                idleDevices_[descriptor->second.name] = std::move(found->second);
            } else {
                DeviceCapabilityRegistry::instance().unregisterDevice(descriptor->second.name);
            }
            descriptors_.erase(descriptor);
        }
        devices_.erase(found);
        return true;
    }

    std::vector<OpenDeviceDescriptor> openedDevices() const {
        std::lock_guard<std::recursive_mutex> lock(mutex_);
        std::vector<OpenDeviceDescriptor> result;
        result.reserve(descriptors_.size());
        for (const auto& entry : descriptors_) result.push_back(entry.second);
        return result;
    }

private:
    mutable std::recursive_mutex mutex_;
    std::map<int, std::unique_ptr<DeviceDriverBase>> devices_;
    std::map<std::string, int> handlesByName_;
    std::map<int, OpenDeviceDescriptor> descriptors_;
    std::map<std::string, OpenDeviceDescriptor> registrations_;
    std::map<std::string, std::unique_ptr<DeviceDriverBase>> idleDevices_;
    int nextHandle_ = 1;

    int allocateHandle() {
        while (nextHandle_ > 0 && devices_.find(nextHandle_) != devices_.end()) ++nextHandle_;
        return nextHandle_ > 0 ? nextHandle_++ : 0;
    }

    static std::unique_ptr<DeviceDriverBase> createDriver(
        const std::string& name, const std::string& type, int pin) {
        std::string normalized = type;
        std::transform(normalized.begin(), normalized.end(), normalized.begin(), [](unsigned char ch) {
            return static_cast<char>(std::tolower(ch));
        });
#if defined(ESP32)
        if (normalized == "ws2812" || normalized == "rgb-led") {
            if (!isGpioOutputCapablePin(pin)) return nullptr;
            return std::unique_ptr<DeviceDriverBase>(new AddressableLedDriver(name, pin));
        }
#endif
        if (normalized == "led") {
            if (!isGpioOutputCapablePin(pin)) return nullptr;
            DigitalOutputConfig config;
            config.activeLow = false;
            config.defaultState = false;
            return std::unique_ptr<DeviceDriverBase>(new DigitalOutputDriver(name, pin, config));
        }
        if (normalized == "switch" || normalized == "relay" || normalized == "digital-output") {
            if (!isGpioOutputCapablePin(pin)) return nullptr;
            return std::unique_ptr<DeviceDriverBase>(new DigitalOutputDriver(name, pin));
        }
        if (normalized == "sensor" || normalized == "analog" || normalized == "analog-input") {
            return std::unique_ptr<DeviceDriverBase>(new AnalogInputDriver(name, pin));
        }
#if !defined(PULSE_LEAN_PMACHINE) && __has_include(<DHT.h>)
        if (normalized == "temperature" || normalized == "dht11") {
            return std::unique_ptr<DeviceDriverBase>(new DHT11Driver(name, pin));
        }
#endif
        return nullptr;
    }
};

inline DeviceRuntime& deviceRuntime() {
    static DeviceRuntime runtime;
    return runtime;
}
