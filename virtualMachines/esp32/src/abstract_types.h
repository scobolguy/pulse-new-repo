#ifndef ABSTRACT_TYPES_H
#define ABSTRACT_TYPES_H

#include <Arduino.h>
#include <string>

/**
 * Abstract Sensor Interface
 * 
 * Provides a polymorphic interface for all sensor types.
 * Concrete sensor implementations must inherit from this interface.
 */
class ISensor {
public:
    virtual ~ISensor() {}
    
    /**
     * Read sensor value
     * @param value Output parameter for sensor reading
     * @return true if read successful, false otherwise
     */
    virtual bool read(float& value) = 0;
    
    /**
     * Calibrate sensor with offset and scale
     * @param offset Calibration offset
     * @param scale Calibration scale factor
     * @return true if calibration successful
     */
    virtual bool calibrate(float offset, float scale) = 0;
    
    /**
     * Get sensor type identifier
     * @return Sensor type string (e.g., "temperature", "humidity")
     */
    virtual std::string getType() const = 0;
    
    /**
     * Get sensor ID
     * @return Unique sensor identifier
     */
    virtual std::string getId() const = 0;
    
    /**
     * Initialize sensor hardware
     * @return true if initialization successful
     */
    virtual bool initialize() = 0;
    
    /**
     * Check if sensor is ready
     * @return true if sensor is operational
     */
    virtual bool isReady() const = 0;
};

/**
 * Abstract Actuator Interface
 * 
 * Provides a polymorphic interface for all actuator types.
 * Concrete actuator implementations must inherit from this interface.
 */
class IActuator {
public:
    virtual ~IActuator() {}
    
    /**
     * Set actuator value
     * @param value Value to set (interpretation depends on actuator type)
     * @return true if set successful, false otherwise
     */
    virtual bool set(int value) = 0;
    
    /**
     * Get current actuator value
     * @param value Output parameter for current value
     * @return true if get successful
     */
    virtual bool get(int& value) = 0;
    
    /**
     * Get actuator type identifier
     * @return Actuator type string (e.g., "relay", "servo", "pwm")
     */
    virtual std::string getType() const = 0;
    
    /**
     * Get actuator ID
     * @return Unique actuator identifier
     */
    virtual std::string getId() const = 0;
    
    /**
     * Initialize actuator hardware
     * @return true if initialization successful
     */
    virtual bool initialize() = 0;
    
    /**
     * Check if actuator is ready
     * @return true if actuator is operational
     */
    virtual bool isReady() const = 0;
    
    /**
     * Get valid value range
     * @param minValue Output parameter for minimum value
     * @param maxValue Output parameter for maximum value
     */
    virtual void getRange(int& minValue, int& maxValue) const = 0;
};

// ============================================================================
// Concrete Sensor Implementations
// ============================================================================

/**
 * Temperature Sensor (DHT22, DS18B20, etc.)
 */
class TemperatureSensor : public ISensor {
public:
    TemperatureSensor(const std::string& id, int pin);
    virtual ~TemperatureSensor();
    
    bool read(float& value) override;
    bool calibrate(float offset, float scale) override;
    std::string getType() const override { return "temperature"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    
private:
    std::string id;
    int pin;
    bool ready;
    float calibrationOffset;
    float calibrationScale;
};

/**
 * Humidity Sensor (DHT22, etc.)
 */
class HumiditySensor : public ISensor {
public:
    HumiditySensor(const std::string& id, int pin);
    virtual ~HumiditySensor();
    
    bool read(float& value) override;
    bool calibrate(float offset, float scale) override;
    std::string getType() const override { return "humidity"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    
private:
    std::string id;
    int pin;
    bool ready;
    float calibrationOffset;
    float calibrationScale;
};

/**
 * Pressure Sensor (BMP280, etc.)
 */
class PressureSensor : public ISensor {
public:
    PressureSensor(const std::string& id, int pin);
    virtual ~PressureSensor();
    
    bool read(float& value) override;
    bool calibrate(float offset, float scale) override;
    std::string getType() const override { return "pressure"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    
private:
    std::string id;
    int pin;
    bool ready;
    float calibrationOffset;
    float calibrationScale;
};

/**
 * Analog Sensor (Generic ADC input)
 */
class AnalogSensor : public ISensor {
public:
    AnalogSensor(const std::string& id, int pin);
    virtual ~AnalogSensor();
    
    bool read(float& value) override;
    bool calibrate(float offset, float scale) override;
    std::string getType() const override { return "analog"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    
private:
    std::string id;
    int pin;
    bool ready;
    float calibrationOffset;
    float calibrationScale;
};

// ============================================================================
// Concrete Actuator Implementations
// ============================================================================

/**
 * Relay Actuator (Digital on/off)
 */
class RelayActuator : public IActuator {
public:
    RelayActuator(const std::string& id, int pin);
    virtual ~RelayActuator();
    
    bool set(int value) override;
    bool get(int& value) override;
    std::string getType() const override { return "relay"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    void getRange(int& minValue, int& maxValue) const override;
    
private:
    std::string id;
    int pin;
    bool ready;
    int currentValue;
};

/**
 * Servo Actuator (0-180 degrees)
 */
class ServoActuator : public IActuator {
public:
    ServoActuator(const std::string& id, int pin);
    virtual ~ServoActuator();
    
    bool set(int value) override;
    bool get(int& value) override;
    std::string getType() const override { return "servo"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    void getRange(int& minValue, int& maxValue) const override;
    
private:
    std::string id;
    int pin;
    bool ready;
    int currentValue;
    int minAngle;
    int maxAngle;
};

/**
 * PWM Actuator (0-255 duty cycle)
 */
class PWMActuator : public IActuator {
public:
    PWMActuator(const std::string& id, int pin);
    virtual ~PWMActuator();
    
    bool set(int value) override;
    bool get(int& value) override;
    std::string getType() const override { return "pwm"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    void getRange(int& minValue, int& maxValue) const override;
    
private:
    std::string id;
    int pin;
    bool ready;
    int currentValue;
    int pwmChannel;
};

/**
 * Digital Output Actuator (Generic GPIO)
 */
class DigitalOutputActuator : public IActuator {
public:
    DigitalOutputActuator(const std::string& id, int pin);
    virtual ~DigitalOutputActuator();
    
    bool set(int value) override;
    bool get(int& value) override;
    std::string getType() const override { return "digital"; }
    std::string getId() const override { return id; }
    bool initialize() override;
    bool isReady() const override { return ready; }
    void getRange(int& minValue, int& maxValue) const override;
    
private:
    std::string id;
    int pin;
    bool ready;
    int currentValue;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create sensor instance based on type
 * @param type Sensor type string
 * @param id Sensor identifier
 * @param pin GPIO pin number
 * @return Pointer to ISensor instance, or nullptr if type unknown
 */
ISensor* createSensor(const std::string& type, const std::string& id, int pin);

/**
 * Create actuator instance based on type
 * @param type Actuator type string
 * @param id Actuator identifier
 * @param pin GPIO pin number
 * @return Pointer to IActuator instance, or nullptr if type unknown
 */
IActuator* createActuator(const std::string& type, const std::string& id, int pin);

#endif // ABSTRACT_TYPES_H

// Made with Bob
