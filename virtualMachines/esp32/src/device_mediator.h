#ifndef DEVICE_MEDIATOR_H
#define DEVICE_MEDIATOR_H

#include <Arduino.h>
#include <map>
#include <string>
#include <vector>
#include "device_registry.h"
#include "abstract_types.h"

/**
 * Device Mediator
 * 
 * Provides a hardware abstraction layer that sits between the P-Machine VM
 * and physical sensors/actuators. Uses the Device Registry for configuration
 * and Abstract Types for polymorphic hardware access.
 * 
 * Key responsibilities:
 * - Initialize hardware from registry configuration
 * - Provide type-safe sensor reading
 * - Provide type-safe actuator control
 * - Manage sensor/actuator lifecycle
 * - Handle calibration and configuration updates
 */
class DeviceMediator {
public:
    DeviceMediator();
    ~DeviceMediator();
    
    // ========================================================================
    // Initialization
    // ========================================================================
    
    /**
     * Initialize all hardware from device registry
     * @param registry Device registry containing configuration
     * @return true if all hardware initialized successfully
     */
    bool initializeHardware(DeviceRegistry& registry);
    
    /**
     * Shutdown all hardware
     */
    void shutdownHardware();
    
    // ========================================================================
    // Sensor Operations
    // ========================================================================
    
    /**
     * Read sensor value by ID
     * @param id Sensor identifier
     * @param value Output parameter for sensor reading
     * @return true if read successful, false if sensor not found or error
     */
    bool readSensor(const char* id, float& value);
    
    /**
     * Calibrate sensor
     * @param id Sensor identifier
     * @param offset Calibration offset
     * @param scale Calibration scale factor
     * @return true if calibration successful
     */
    bool calibrateSensor(const char* id, float offset, float scale);
    
    /**
     * Enable sensor
     * @param id Sensor identifier
     * @return true if successful
     */
    bool enableSensor(const char* id);
    
    /**
     * Disable sensor
     * @param id Sensor identifier
     * @return true if successful
     */
    bool disableSensor(const char* id);
    
    /**
     * Check if sensor is enabled
     * @param id Sensor identifier
     * @return true if sensor is enabled
     */
    bool isSensorEnabled(const char* id) const;
    
    /**
     * Get sensor type
     * @param id Sensor identifier
     * @return Sensor type string, or empty if not found
     */
    std::string getSensorType(const char* id) const;
    
    /**
     * List all sensor IDs
     * @return Vector of sensor identifiers
     */
    std::vector<std::string> listSensors() const;
    
    // ========================================================================
    // Actuator Operations
    // ========================================================================
    
    /**
     * Set actuator value by ID
     * @param id Actuator identifier
     * @param value Value to set
     * @return true if set successful, false if actuator not found or error
     */
    bool setActuator(const char* id, int value);
    
    /**
     * Get actuator current value
     * @param id Actuator identifier
     * @param value Output parameter for current value
     * @return true if get successful
     */
    bool getActuator(const char* id, int& value);
    
    /**
     * Enable actuator
     * @param id Actuator identifier
     * @return true if successful
     */
    bool enableActuator(const char* id);
    
    /**
     * Disable actuator
     * @param id Actuator identifier
     * @return true if successful
     */
    bool disableActuator(const char* id);
    
    /**
     * Check if actuator is enabled
     * @param id Actuator identifier
     * @return true if actuator is enabled
     */
    bool isActuatorEnabled(const char* id) const;
    
    /**
     * Get actuator type
     * @param id Actuator identifier
     * @return Actuator type string, or empty if not found
     */
    std::string getActuatorType(const char* id) const;
    
    /**
     * Get actuator valid range
     * @param id Actuator identifier
     * @param minValue Output parameter for minimum value
     * @param maxValue Output parameter for maximum value
     * @return true if successful
     */
    bool getActuatorRange(const char* id, int& minValue, int& maxValue) const;
    
    /**
     * List all actuator IDs
     * @return Vector of actuator identifiers
     */
    std::vector<std::string> listActuators() const;
    
    // ========================================================================
    // Status and Diagnostics
    // ========================================================================
    
    /**
     * Get number of registered sensors
     * @return Sensor count
     */
    int getSensorCount() const { return sensors.size(); }
    
    /**
     * Get number of registered actuators
     * @return Actuator count
     */
    int getActuatorCount() const { return actuators.size(); }
    
    /**
     * Check if mediator is initialized
     * @return true if initialized
     */
    bool isInitialized() const { return initialized; }
    
    /**
     * Get last error message
     * @return Error message string
     */
    const char* getLastError() const { return lastError.c_str(); }
    
    /**
     * Run diagnostics on all hardware
     * @return true if all hardware is operational
     */
    bool runDiagnostics();
    
private:
    // Sensor management
    std::map<std::string, ISensor*> sensors;
    std::map<std::string, bool> sensorEnabled;
    
    // Actuator management
    std::map<std::string, IActuator*> actuators;
    std::map<std::string, bool> actuatorEnabled;
    
    // State
    bool initialized;
    std::string lastError;
    
    // Helper methods
    void setError(const char* error);
    void clearError();
    bool initializeSensor(const SensorConfig& config);
    bool initializeActuator(const ActuatorConfig& config);
};

// Global mediator instance
extern DeviceMediator* globalDeviceMediator;

// Initialization helper
void initializeDeviceMediator();

#endif // DEVICE_MEDIATOR_H

// Made with Bob
