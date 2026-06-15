# Phase 7: Registry-Driven Configuration System

**Version:** 1.0  
**Date:** June 11, 2026  
**Status:** Implementation Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [JSON Schema](#json-schema)
5. [Device Registry API](#device-registry-api)
6. [Abstract Type System](#abstract-type-system)
7. [Device Mediator](#device-mediator)
8. [Usage Examples](#usage-examples)
9. [Integration Guide](#integration-guide)
10. [Best Practices](#best-practices)

---

## Overview

The Registry-Driven Configuration System provides a schema-based approach to device configuration, replacing ad-hoc JSON parsing with type-safe, validated configuration management. The system consists of three main components:

1. **Device Registry** - Configuration loading and validation
2. **Abstract Type System** - Polymorphic hardware interfaces
3. **Device Mediator** - Hardware abstraction layer

### Key Features

- ✅ JSON Schema validation (Draft-07)
- ✅ Type-safe configuration structures
- ✅ Polymorphic sensor/actuator interfaces
- ✅ Hardware abstraction layer
- ✅ Dynamic configuration updates
- ✅ SPIFFS-based persistence
- ✅ Calibration support
- ✅ Enable/disable control

### Benefits

- **Type Safety:** Compile-time type checking for all configuration
- **Validation:** Schema-based validation at load time
- **Flexibility:** Easy to add new sensor/actuator types
- **Testability:** Mock hardware for unit testing
- **Maintainability:** Clear separation of concerns

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│              (P-Machine VM, User Code)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Device Mediator                         │
│         (Hardware Abstraction Layer)                     │
│  • readSensor()  • setActuator()                        │
│  • calibrateSensor()  • getActuator()                   │
│  • enableSensor()  • enableActuator()                   │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Abstract Types  │    │ Device Registry  │
│                  │    │                  │
│  • ISensor       │    │  • loadConfig()  │
│  • IActuator     │    │  • validate()    │
│  • Concrete      │    │  • getters()     │
│    Implementations│    │  • setters()     │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Physical        │    │  JSON Schema     │
│  Hardware        │    │  Configuration   │
│  (GPIO, ADC,     │    │  (SPIFFS)        │
│   PWM, etc.)     │    │                  │
└──────────────────┘    └──────────────────┘
```

---

## Components

### 1. Device Registry

**Files:**
- `device_registry.h` (283 lines)
- `device_registry.cpp` (428 lines)

**Purpose:** Load, validate, and provide type-safe access to device configuration.

**Key Classes:**
```cpp
class DeviceRegistry {
    bool loadConfig(const char* configPath);
    bool validateConfig();
    
    DeviceInfo getDeviceInfo() const;
    std::vector<SensorConfig> getSensors() const;
    std::vector<ActuatorConfig> getActuators() const;
    NetworkConfig getNetworkConfig() const;
    BrokerConfig getBrokerConfig() const;
    StorageConfig getStorageConfig() const;
    SchedulerConfig getSchedulerConfig() const;
    
    bool updateSensor(const char* id, const SensorConfig& config);
    bool updateActuator(const char* id, const ActuatorConfig& config);
};
```

### 2. Abstract Type System

**Files:**
- `abstract_types.h` (308 lines)
- `abstract_types.cpp` (348 lines)

**Purpose:** Provide polymorphic interfaces for sensors and actuators.

**Interfaces:**
```cpp
class ISensor {
    virtual bool read(float& value) = 0;
    virtual bool calibrate(float offset, float scale) = 0;
    virtual std::string getType() const = 0;
    virtual bool initialize() = 0;
};

class IActuator {
    virtual bool set(int value) = 0;
    virtual bool get(int& value) = 0;
    virtual std::string getType() const = 0;
    virtual bool initialize() = 0;
};
```

**Concrete Implementations:**

**Sensors:**
- `TemperatureSensor` - Temperature measurement
- `HumiditySensor` - Humidity measurement
- `PressureSensor` - Pressure measurement
- `AnalogSensor` - Generic ADC input

**Actuators:**
- `RelayActuator` - Digital on/off control
- `ServoActuator` - Servo motor control (0-180°)
- `PWMActuator` - PWM output (0-255)
- `DigitalOutputActuator` - Generic GPIO output

### 3. Device Mediator

**Files:**
- `device_mediator.h` (213 lines)
- `device_mediator.cpp` (318 lines)

**Purpose:** Hardware abstraction layer between VM and physical devices.

**Key Methods:**
```cpp
class DeviceMediator {
    bool initializeHardware(DeviceRegistry& registry);
    
    // Sensor operations
    bool readSensor(const char* id, float& value);
    bool calibrateSensor(const char* id, float offset, float scale);
    bool enableSensor(const char* id);
    bool disableSensor(const char* id);
    
    // Actuator operations
    bool setActuator(const char* id, int value);
    bool getActuator(const char* id, int& value);
    bool enableActuator(const char* id);
    bool disableActuator(const char* id);
    
    // Diagnostics
    bool runDiagnostics();
};
```

---

## JSON Schema

**File:** `config/device-config.schema.json` (329 lines)

### Schema Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["device"],
  "properties": {
    "device": { ... },
    "hardware": { ... },
    "network": { ... },
    "broker": { ... },
    "storage": { ... },
    "scheduler": { ... },
    "libraries": { ... },
    "logging": { ... }
  }
}
```

### Device Section

```json
{
  "device": {
    "id": "esp32-backend-01",
    "name": "Backend Processing Node",
    "role": "backend",
    "version": "1.0.0"
  }
}
```

**Fields:**
- `id` (required): Unique device identifier (pattern: `^[a-z0-9-]+$`)
- `name` (required): Human-readable device name
- `role` (required): Device role (enum: `frontend`, `backend`, `gateway`)
- `version` (optional): Firmware version

### Hardware Section

```json
{
  "hardware": {
    "sensors": [
      {
        "id": "temp-01",
        "type": "temperature",
        "pin": 34,
        "enabled": true,
        "sampleRate": 1000,
        "calibration": {
          "offset": 0.0,
          "scale": 1.0
        }
      }
    ],
    "actuators": [
      {
        "id": "relay-01",
        "type": "relay",
        "pin": 25,
        "enabled": true,
        "defaultValue": 0,
        "minValue": 0,
        "maxValue": 1
      }
    ]
  }
}
```

**Sensor Types:**
- `temperature` - Temperature sensor
- `humidity` - Humidity sensor
- `pressure` - Pressure sensor
- `analog` - Generic analog input

**Actuator Types:**
- `relay` - Digital relay (0/1)
- `servo` - Servo motor (0-180)
- `pwm` - PWM output (0-255)
- `digital` - Digital output (0/1)

### Network Section

```json
{
  "network": {
    "wifi": {
      "ssid": "MyNetwork",
      "password": "MyPassword",
      "enabled": true,
      "reconnectInterval": 5000
    },
    "mqtt": {
      "broker": "mqtt.example.com",
      "port": 1883,
      "username": "user",
      "password": "pass",
      "enabled": false
    },
    "http": {
      "port": 80,
      "enabled": true
    }
  }
}
```

### Broker Section

```json
{
  "broker": {
    "url": "http://192.168.1.100",
    "port": 5000,
    "discoveryEnabled": true,
    "discoveryInterval": 30000,
    "queues": [
      {
        "name": "incoming",
        "maxSize": 100,
        "persistent": true
      }
    ]
  }
}
```

### Storage Section

```json
{
  "storage": {
    "sdCard": {
      "csPin": 5,
      "chunkSize": 512,
      "wearLevelingEnabled": true
    },
    "spiffs": {
      "enabled": true,
      "maxFiles": 10
    }
  }
}
```

### Scheduler Section

```json
{
  "scheduler": {
    "quantum": 10,
    "maxContexts": 8,
    "priorityLevels": 4
  }
}
```

### Libraries Section

```json
{
  "libraries": [
    {
      "name": "crypto-utils",
      "path": "/libraries/crypto-utils.manifest.json",
      "autoLoad": true
    }
  ]
}
```

### Logging Section

```json
{
  "logging": {
    "level": "INFO",
    "serialEnabled": true,
    "fileEnabled": false,
    "filePath": "/logs/system.log"
  }
}
```

---

## Device Registry API

### Initialization

```cpp
#include "device_registry.h"

// Initialize global registry
initializeDeviceRegistry();

// Load configuration from SPIFFS
bool success = globalDeviceRegistry->loadConfig("/config/device-config.json");
if (!success) {
    Serial.println(globalDeviceRegistry->getLastError());
}
```

### Loading from String

```cpp
const char* jsonConfig = R"({
  "device": {
    "id": "test-device",
    "role": "backend"
  }
})";

globalDeviceRegistry->loadConfigFromString(jsonConfig);
```

### Accessing Configuration

```cpp
// Get device info
DeviceInfo info = globalDeviceRegistry->getDeviceInfo();
Serial.println(info.id.c_str());
Serial.println(info.role.c_str());

// Get sensors
std::vector<SensorConfig> sensors = globalDeviceRegistry->getSensors();
for (const auto& sensor : sensors) {
    Serial.printf("Sensor: %s, Type: %s, Pin: %d\n",
                  sensor.id.c_str(), sensor.type.c_str(), sensor.pin);
}

// Get actuators
std::vector<ActuatorConfig> actuators = globalDeviceRegistry->getActuators();
for (const auto& actuator : actuators) {
    Serial.printf("Actuator: %s, Type: %s, Pin: %d\n",
                  actuator.id.c_str(), actuator.type.c_str(), actuator.pin);
}

// Get network config
NetworkConfig network = globalDeviceRegistry->getNetworkConfig();
Serial.println(network.wifi.ssid.c_str());

// Get scheduler config
SchedulerConfig sched = globalDeviceRegistry->getSchedulerConfig();
Serial.printf("Quantum: %d, Max Contexts: %d\n",
              sched.quantum, sched.maxContexts);
```

### Dynamic Updates

```cpp
// Update sensor configuration
SensorConfig sensor = globalDeviceRegistry->getSensor("temp-01");
sensor.calibrationOffset = 2.5f;
sensor.calibrationScale = 1.1f;
globalDeviceRegistry->updateSensor("temp-01", sensor);

// Save updated configuration
globalDeviceRegistry->saveConfig("/config/device-config.json");
```

---

## Abstract Type System

### Factory Functions

```cpp
#include "abstract_types.h"

// Create sensor
ISensor* tempSensor = createSensor("temperature", "temp-01", 34);
if (tempSensor != nullptr) {
    tempSensor->initialize();
}

// Create actuator
IActuator* relay = createActuator("relay", "relay-01", 25);
if (relay != nullptr) {
    relay->initialize();
}
```

### Using Sensors

```cpp
// Read sensor value
float temperature;
if (tempSensor->read(temperature)) {
    Serial.printf("Temperature: %.2f°C\n", temperature);
}

// Calibrate sensor
tempSensor->calibrate(2.0f, 1.05f);

// Check sensor status
if (tempSensor->isReady()) {
    Serial.println("Sensor ready");
}
```

### Using Actuators

```cpp
// Set actuator value
relay->set(1); // Turn on

// Get actuator value
int value;
relay->get(value);
Serial.printf("Relay state: %d\n", value);

// Get valid range
int minVal, maxVal;
relay->getRange(minVal, maxVal);
Serial.printf("Range: %d-%d\n", minVal, maxVal);
```

### Custom Sensor Implementation

```cpp
class CustomSensor : public ISensor {
public:
    CustomSensor(const std::string& id, int pin)
        : id(id), pin(pin), ready(false) {}
    
    bool initialize() override {
        pinMode(pin, INPUT);
        ready = true;
        return true;
    }
    
    bool read(float& value) override {
        if (!ready) return false;
        // Custom reading logic
        value = analogRead(pin) * 0.1f;
        return true;
    }
    
    bool calibrate(float offset, float scale) override {
        // Custom calibration logic
        return true;
    }
    
    std::string getType() const override { return "custom"; }
    std::string getId() const override { return id; }
    bool isReady() const override { return ready; }
    
private:
    std::string id;
    int pin;
    bool ready;
};
```

---

## Device Mediator

### Initialization

```cpp
#include "device_mediator.h"
#include "device_registry.h"

// Initialize mediator
initializeDeviceMediator();

// Initialize hardware from registry
bool success = globalDeviceMediator->initializeHardware(*globalDeviceRegistry);
if (!success) {
    Serial.println(globalDeviceMediator->getLastError());
}
```

### Reading Sensors

```cpp
// Read sensor by ID
float temperature;
if (globalDeviceMediator->readSensor("temp-01", temperature)) {
    Serial.printf("Temperature: %.2f°C\n", temperature);
} else {
    Serial.println(globalDeviceMediator->getLastError());
}

// List all sensors
std::vector<std::string> sensors = globalDeviceMediator->listSensors();
for (const auto& id : sensors) {
    float value;
    if (globalDeviceMediator->readSensor(id.c_str(), value)) {
        std::string type = globalDeviceMediator->getSensorType(id.c_str());
        Serial.printf("%s (%s): %.2f\n", id.c_str(), type.c_str(), value);
    }
}
```

### Controlling Actuators

```cpp
// Set actuator by ID
if (globalDeviceMediator->setActuator("relay-01", 1)) {
    Serial.println("Relay turned on");
} else {
    Serial.println(globalDeviceMediator->getLastError());
}

// Get actuator state
int state;
if (globalDeviceMediator->getActuator("relay-01", state)) {
    Serial.printf("Relay state: %d\n", state);
}

// List all actuators
std::vector<std::string> actuators = globalDeviceMediator->listActuators();
for (const auto& id : actuators) {
    int value;
    if (globalDeviceMediator->getActuator(id.c_str(), value)) {
        std::string type = globalDeviceMediator->getActuatorType(id.c_str());
        Serial.printf("%s (%s): %d\n", id.c_str(), type.c_str(), value);
    }
}
```

### Calibration

```cpp
// Calibrate sensor
globalDeviceMediator->calibrateSensor("temp-01", 2.5f, 1.05f);
```

### Enable/Disable Control

```cpp
// Disable sensor
globalDeviceMediator->disableSensor("temp-01");

// Check if enabled
if (globalDeviceMediator->isSensorEnabled("temp-01")) {
    Serial.println("Sensor enabled");
}

// Re-enable sensor
globalDeviceMediator->enableSensor("temp-01");
```

### Diagnostics

```cpp
// Run diagnostics on all hardware
if (globalDeviceMediator->runDiagnostics()) {
    Serial.println("All hardware operational");
} else {
    Serial.println("Hardware issues detected");
    Serial.println(globalDeviceMediator->getLastError());
}

// Get counts
Serial.printf("Sensors: %d\n", globalDeviceMediator->getSensorCount());
Serial.printf("Actuators: %d\n", globalDeviceMediator->getActuatorCount());
```

---

## Usage Examples

### Complete Initialization

```cpp
void setup() {
    Serial.begin(115200);
    
    // Initialize SPIFFS
    if (!SPIFFS.begin(true)) {
        Serial.println("SPIFFS mount failed");
        return;
    }
    
    // Initialize registry
    initializeDeviceRegistry();
    if (!globalDeviceRegistry->loadConfig("/config/device-config.json")) {
        Serial.println("Config load failed");
        return;
    }
    
    // Initialize mediator
    initializeDeviceMediator();
    if (!globalDeviceMediator->initializeHardware(*globalDeviceRegistry)) {
        Serial.println("Hardware init failed");
        return;
    }
    
    Serial.println("System initialized");
}
```

### Periodic Sensor Reading

```cpp
void loop() {
    static unsigned long lastRead = 0;
    unsigned long now = millis();
    
    if (now - lastRead >= 1000) {
        lastRead = now;
        
        // Read all sensors
        std::vector<std::string> sensors = globalDeviceMediator->listSensors();
        for (const auto& id : sensors) {
            if (globalDeviceMediator->isSensorEnabled(id.c_str())) {
                float value;
                if (globalDeviceMediator->readSensor(id.c_str(), value)) {
                    Serial.printf("%s: %.2f\n", id.c_str(), value);
                }
            }
        }
    }
}
```

### Actuator Control Based on Sensor

```cpp
void controlLoop() {
    float temperature;
    if (globalDeviceMediator->readSensor("temp-01", temperature)) {
        // Turn on fan if temperature > 30°C
        if (temperature > 30.0f) {
            globalDeviceMediator->setActuator("fan-01", 255); // Full speed
        } else if (temperature > 25.0f) {
            globalDeviceMediator->setActuator("fan-01", 128); // Half speed
        } else {
            globalDeviceMediator->setActuator("fan-01", 0); // Off
        }
    }
}
```

---

## Integration Guide

### With P-Machine VM

```cpp
// In main.cpp
#include "device_registry.h"
#include "device_mediator.h"
#include "pmachine.h"

void setup() {
    // Initialize configuration system
    initializeDeviceRegistry();
    globalDeviceRegistry->loadConfig("/config/device-config.json");
    
    // Initialize hardware
    initializeDeviceMediator();
    globalDeviceMediator->initializeHardware(*globalDeviceRegistry);
    
    // Initialize VM with scheduler config
    SchedulerConfig sched = globalDeviceRegistry->getSchedulerConfig();
    initializePMachineScheduler(sched.quantum, sched.maxContexts);
    
    // Load and run P-code
    // ...
}
```

### With Scheduler

```cpp
// Apply scheduler configuration from registry
SchedulerConfig sched = globalDeviceRegistry->getSchedulerConfig();
globalScheduler->setQuantum(sched.quantum);
globalScheduler->setMaxContexts(sched.maxContexts);
globalScheduler->setPriorityLevels(sched.priorityLevels);
```

### With Dynamic Library Loader

```cpp
// Auto-load libraries from registry
std::vector<LibraryConfig> libraries = globalDeviceRegistry->getLibraries();
for (const auto& lib : libraries) {
    if (lib.autoLoad) {
        // Load library manifest
        File file = SPIFFS.open(lib.path.c_str(), "r");
        String manifest = file.readString();
        file.close();
        
        globalLibraryLoader->loadLibraryFromJSON(manifest.c_str(), 0);
    }
}
```

---

## Best Practices

### Configuration Management

1. **Version Control:** Keep configuration files in version control
2. **Validation:** Always validate configuration after loading
3. **Defaults:** Provide sensible defaults for optional fields
4. **Documentation:** Document all configuration options

### Hardware Abstraction

1. **Use Mediator:** Always access hardware through the mediator
2. **Check Enabled:** Check if sensor/actuator is enabled before use
3. **Error Handling:** Always check return values
4. **Calibration:** Calibrate sensors during initialization

### Type Safety

1. **Use Interfaces:** Program to interfaces (ISensor, IActuator)
2. **Factory Pattern:** Use factory functions for object creation
3. **RAII:** Use constructors/destructors for resource management
4. **Const Correctness:** Use const for read-only operations

### Performance

1. **Cache Config:** Cache frequently accessed configuration
2. **Batch Operations:** Batch sensor readings when possible
3. **Lazy Initialization:** Initialize hardware only when needed
4. **Resource Cleanup:** Clean up resources in destructors

### Testing

1. **Mock Hardware:** Create mock implementations for testing
2. **Unit Tests:** Test each component independently
3. **Integration Tests:** Test complete system integration
4. **Configuration Tests:** Test with various configurations

---

## Summary

The Registry-Driven Configuration System provides a robust, type-safe foundation for device configuration and hardware management. Key achievements:

- ✅ **2,497 lines of production code** across 8 files
- ✅ **Complete JSON schema** with validation
- ✅ **Polymorphic hardware interfaces** for extensibility
- ✅ **Hardware abstraction layer** for testability
- ✅ **Type-safe configuration** structures
- ✅ **Dynamic updates** and persistence

The system is production-ready and provides a solid foundation for Phase 8 (Broker API & SD Chunkstore) and beyond.

---

**Last Updated:** June 11, 2026  
**Document Version:** 1.0  
**Author:** Bob (AI Software Engineer)