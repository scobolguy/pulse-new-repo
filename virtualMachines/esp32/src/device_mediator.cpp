#include "device_mediator.h"

// Global mediator instance
DeviceMediator* globalDeviceMediator = nullptr;

void initializeDeviceMediator() {
    if (globalDeviceMediator == nullptr) {
        globalDeviceMediator = new DeviceMediator();
    }
}

DeviceMediator::DeviceMediator() : initialized(false) {
    clearError();
}

DeviceMediator::~DeviceMediator() {
    shutdownHardware();
}

bool DeviceMediator::initializeHardware(DeviceRegistry& registry) {
    clearError();
    
    if (!registry.isLoaded() || !registry.isValidated()) {
        setError("Registry not loaded or validated");
        return false;
    }
    
    // Initialize sensors
    std::vector<SensorConfig> sensorConfigs = registry.getSensors();
    for (const auto& config : sensorConfigs) {
        if (!initializeSensor(config)) {
            setError("Failed to initialize sensor");
            return false;
        }
    }
    
    // Initialize actuators
    std::vector<ActuatorConfig> actuatorConfigs = registry.getActuators();
    for (const auto& config : actuatorConfigs) {
        if (!initializeActuator(config)) {
            setError("Failed to initialize actuator");
            return false;
        }
    }
    
    initialized = true;
    return true;
}

void DeviceMediator::shutdownHardware() {
    // Clean up sensors
    for (auto& pair : sensors) {
        delete pair.second;
    }
    sensors.clear();
    sensorEnabled.clear();
    
    // Clean up actuators
    for (auto& pair : actuators) {
        delete pair.second;
    }
    actuators.clear();
    actuatorEnabled.clear();
    
    initialized = false;
}

bool DeviceMediator::initializeSensor(const SensorConfig& config) {
    // Create sensor instance using factory
    ISensor* sensor = createSensor(config.type, config.id, config.pin);
    if (sensor == nullptr) {
        return false;
    }
    
    // Initialize hardware
    if (!sensor->initialize()) {
        delete sensor;
        return false;
    }
    
    // Apply calibration
    sensor->calibrate(config.calibrationOffset, config.calibrationScale);
    
    // Register sensor
    sensors[config.id] = sensor;
    sensorEnabled[config.id] = config.enabled;
    
    return true;
}

bool DeviceMediator::initializeActuator(const ActuatorConfig& config) {
    // Create actuator instance using factory
    IActuator* actuator = createActuator(config.type, config.id, config.pin);
    if (actuator == nullptr) {
        return false;
    }
    
    // Initialize hardware
    if (!actuator->initialize()) {
        delete actuator;
        return false;
    }
    
    // Set default value
    actuator->set(config.defaultValue);
    
    // Register actuator
    actuators[config.id] = actuator;
    actuatorEnabled[config.id] = config.enabled;
    
    return true;
}

// ============================================================================
// Sensor Operations
// ============================================================================

bool DeviceMediator::readSensor(const char* id, float& value) {
    clearError();
    
    auto it = sensors.find(id);
    if (it == sensors.end()) {
        setError("Sensor not found");
        return false;
    }
    
    if (!sensorEnabled[id]) {
        setError("Sensor disabled");
        return false;
    }
    
    return it->second->read(value);
}

bool DeviceMediator::calibrateSensor(const char* id, float offset, float scale) {
    clearError();
    
    auto it = sensors.find(id);
    if (it == sensors.end()) {
        setError("Sensor not found");
        return false;
    }
    
    return it->second->calibrate(offset, scale);
}

bool DeviceMediator::enableSensor(const char* id) {
    clearError();
    
    auto it = sensors.find(id);
    if (it == sensors.end()) {
        setError("Sensor not found");
        return false;
    }
    
    sensorEnabled[id] = true;
    return true;
}

bool DeviceMediator::disableSensor(const char* id) {
    clearError();
    
    auto it = sensors.find(id);
    if (it == sensors.end()) {
        setError("Sensor not found");
        return false;
    }
    
    sensorEnabled[id] = false;
    return true;
}

bool DeviceMediator::isSensorEnabled(const char* id) const {
    auto it = sensorEnabled.find(id);
    if (it == sensorEnabled.end()) {
        return false;
    }
    return it->second;
}

std::string DeviceMediator::getSensorType(const char* id) const {
    auto it = sensors.find(id);
    if (it == sensors.end()) {
        return "";
    }
    return it->second->getType();
}

std::vector<std::string> DeviceMediator::listSensors() const {
    std::vector<std::string> ids;
    for (const auto& pair : sensors) {
        ids.push_back(pair.first);
    }
    return ids;
}

// ============================================================================
// Actuator Operations
// ============================================================================

bool DeviceMediator::setActuator(const char* id, int value) {
    clearError();
    
    auto it = actuators.find(id);
    if (it == actuators.end()) {
        setError("Actuator not found");
        return false;
    }
    
    if (!actuatorEnabled[id]) {
        setError("Actuator disabled");
        return false;
    }
    
    return it->second->set(value);
}

bool DeviceMediator::getActuator(const char* id, int& value) {
    clearError();
    
    auto it = actuators.find(id);
    if (it == actuators.end()) {
        setError("Actuator not found");
        return false;
    }
    
    return it->second->get(value);
}

bool DeviceMediator::enableActuator(const char* id) {
    clearError();
    
    auto it = actuators.find(id);
    if (it == actuators.end()) {
        setError("Actuator not found");
        return false;
    }
    
    actuatorEnabled[id] = true;
    return true;
}

bool DeviceMediator::disableActuator(const char* id) {
    clearError();
    
    auto it = actuators.find(id);
    if (it == actuators.end()) {
        setError("Actuator not found");
        return false;
    }
    
    actuatorEnabled[id] = false;
    return true;
}

bool DeviceMediator::isActuatorEnabled(const char* id) const {
    auto it = actuatorEnabled.find(id);
    if (it == actuatorEnabled.end()) {
        return false;
    }
    return it->second;
}

std::string DeviceMediator::getActuatorType(const char* id) const {
    auto it = actuators.find(id);
    if (it == actuators.end()) {
        return "";
    }
    return it->second->getType();
}

bool DeviceMediator::getActuatorRange(const char* id, int& minValue, int& maxValue) const {
    auto it = actuators.find(id);
    if (it == actuators.end()) {
        return false;
    }
    
    it->second->getRange(minValue, maxValue);
    return true;
}

std::vector<std::string> DeviceMediator::listActuators() const {
    std::vector<std::string> ids;
    for (const auto& pair : actuators) {
        ids.push_back(pair.first);
    }
    return ids;
}

// ============================================================================
// Status and Diagnostics
// ============================================================================

bool DeviceMediator::runDiagnostics() {
    clearError();
    
    bool allOk = true;
    
    // Check all sensors
    for (const auto& pair : sensors) {
        if (!pair.second->isReady()) {
            setError("Sensor not ready");
            allOk = false;
        }
    }
    
    // Check all actuators
    for (const auto& pair : actuators) {
        if (!pair.second->isReady()) {
            setError("Actuator not ready");
            allOk = false;
        }
    }
    
    return allOk;
}

// ============================================================================
// Helper Methods
// ============================================================================

void DeviceMediator::setError(const char* error) {
    lastError = error;
}

void DeviceMediator::clearError() {
    lastError = "";
}

// Made with Bob
