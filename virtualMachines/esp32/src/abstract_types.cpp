#include "abstract_types.h"

// ============================================================================
// Temperature Sensor Implementation
// ============================================================================

TemperatureSensor::TemperatureSensor(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), calibrationOffset(0.0f), calibrationScale(1.0f) {
}

TemperatureSensor::~TemperatureSensor() {
}

bool TemperatureSensor::initialize() {
    pinMode(pin, INPUT);
    ready = true;
    return true;
}

bool TemperatureSensor::read(float& value) {
    if (!ready) return false;
    
    // Read analog value and convert to temperature
    // This is a simplified implementation - real sensors would use specific protocols
    int rawValue = analogRead(pin);
    float voltage = (rawValue / 4095.0f) * 3.3f;
    float temperature = (voltage - 0.5f) * 100.0f; // TMP36 formula
    
    // Apply calibration
    value = (temperature + calibrationOffset) * calibrationScale;
    return true;
}

bool TemperatureSensor::calibrate(float offset, float scale) {
    calibrationOffset = offset;
    calibrationScale = scale;
    return true;
}

// ============================================================================
// Humidity Sensor Implementation
// ============================================================================

HumiditySensor::HumiditySensor(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), calibrationOffset(0.0f), calibrationScale(1.0f) {
}

HumiditySensor::~HumiditySensor() {
}

bool HumiditySensor::initialize() {
    pinMode(pin, INPUT);
    ready = true;
    return true;
}

bool HumiditySensor::read(float& value) {
    if (!ready) return false;
    
    // Read analog value and convert to humidity
    int rawValue = analogRead(pin);
    float humidity = (rawValue / 4095.0f) * 100.0f;
    
    // Apply calibration
    value = (humidity + calibrationOffset) * calibrationScale;
    return true;
}

bool HumiditySensor::calibrate(float offset, float scale) {
    calibrationOffset = offset;
    calibrationScale = scale;
    return true;
}

// ============================================================================
// Pressure Sensor Implementation
// ============================================================================

PressureSensor::PressureSensor(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), calibrationOffset(0.0f), calibrationScale(1.0f) {
}

PressureSensor::~PressureSensor() {
}

bool PressureSensor::initialize() {
    pinMode(pin, INPUT);
    ready = true;
    return true;
}

bool PressureSensor::read(float& value) {
    if (!ready) return false;
    
    // Read analog value and convert to pressure (kPa)
    int rawValue = analogRead(pin);
    float pressure = (rawValue / 4095.0f) * 110.0f + 30.0f; // 30-140 kPa range
    
    // Apply calibration
    value = (pressure + calibrationOffset) * calibrationScale;
    return true;
}

bool PressureSensor::calibrate(float offset, float scale) {
    calibrationOffset = offset;
    calibrationScale = scale;
    return true;
}

// ============================================================================
// Analog Sensor Implementation
// ============================================================================

AnalogSensor::AnalogSensor(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), calibrationOffset(0.0f), calibrationScale(1.0f) {
}

AnalogSensor::~AnalogSensor() {
}

bool AnalogSensor::initialize() {
    pinMode(pin, INPUT);
    ready = true;
    return true;
}

bool AnalogSensor::read(float& value) {
    if (!ready) return false;
    
    // Read raw analog value
    int rawValue = analogRead(pin);
    float voltage = (rawValue / 4095.0f) * 3.3f;
    
    // Apply calibration
    value = (voltage + calibrationOffset) * calibrationScale;
    return true;
}

bool AnalogSensor::calibrate(float offset, float scale) {
    calibrationOffset = offset;
    calibrationScale = scale;
    return true;
}

// ============================================================================
// Relay Actuator Implementation
// ============================================================================

RelayActuator::RelayActuator(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), currentValue(0) {
}

RelayActuator::~RelayActuator() {
}

bool RelayActuator::initialize() {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
    currentValue = 0;
    ready = true;
    return true;
}

bool RelayActuator::set(int value) {
    if (!ready) return false;
    
    // Relay is binary: 0 = OFF, non-zero = ON
    currentValue = (value != 0) ? 1 : 0;
    digitalWrite(pin, currentValue ? HIGH : LOW);
    return true;
}

bool RelayActuator::get(int& value) {
    if (!ready) return false;
    value = currentValue;
    return true;
}

void RelayActuator::getRange(int& minValue, int& maxValue) const {
    minValue = 0;
    maxValue = 1;
}

// ============================================================================
// Servo Actuator Implementation
// ============================================================================

ServoActuator::ServoActuator(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), currentValue(90), minAngle(0), maxAngle(180) {
}

ServoActuator::~ServoActuator() {
}

bool ServoActuator::initialize() {
    pinMode(pin, OUTPUT);
    // Initialize servo to center position
    currentValue = 90;
    ready = true;
    return true;
}

bool ServoActuator::set(int value) {
    if (!ready) return false;
    
    // Clamp value to valid range
    if (value < minAngle) value = minAngle;
    if (value > maxAngle) value = maxAngle;
    
    currentValue = value;
    
    // Convert angle to PWM duty cycle (simplified)
    // Real implementation would use Servo library
    // int dutyCycle = map(value, 0, 180, 1000, 2000);
    // ledcWrite(channel, dutyCycle) or similar for ESP32
    
    return true;
}

bool ServoActuator::get(int& value) {
    if (!ready) return false;
    value = currentValue;
    return true;
}

void ServoActuator::getRange(int& minValue, int& maxValue) const {
    minValue = minAngle;
    maxValue = maxAngle;
}

// ============================================================================
// PWM Actuator Implementation
// ============================================================================

PWMActuator::PWMActuator(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), currentValue(0), pwmChannel(0) {
}

PWMActuator::~PWMActuator() {
}

bool PWMActuator::initialize() {
    // Setup PWM channel for ESP32
    // ledcSetup(pwmChannel, 5000, 8); // 5kHz, 8-bit resolution
    // ledcAttachPin(pin, pwmChannel);
    pinMode(pin, OUTPUT);
    currentValue = 0;
    ready = true;
    return true;
}

bool PWMActuator::set(int value) {
    if (!ready) return false;
    
    // Clamp value to 0-255 range
    if (value < 0) value = 0;
    if (value > 255) value = 255;
    
    currentValue = value;
    
    // Set PWM duty cycle
    // ledcWrite(pwmChannel, value);
    analogWrite(pin, value);
    
    return true;
}

bool PWMActuator::get(int& value) {
    if (!ready) return false;
    value = currentValue;
    return true;
}

void PWMActuator::getRange(int& minValue, int& maxValue) const {
    minValue = 0;
    maxValue = 255;
}

// ============================================================================
// Digital Output Actuator Implementation
// ============================================================================

DigitalOutputActuator::DigitalOutputActuator(const std::string& id, int pin)
    : id(id), pin(pin), ready(false), currentValue(0) {
}

DigitalOutputActuator::~DigitalOutputActuator() {
}

bool DigitalOutputActuator::initialize() {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
    currentValue = 0;
    ready = true;
    return true;
}

bool DigitalOutputActuator::set(int value) {
    if (!ready) return false;
    
    // Digital output is binary: 0 = LOW, non-zero = HIGH
    currentValue = (value != 0) ? 1 : 0;
    digitalWrite(pin, currentValue ? HIGH : LOW);
    return true;
}

bool DigitalOutputActuator::get(int& value) {
    if (!ready) return false;
    value = currentValue;
    return true;
}

void DigitalOutputActuator::getRange(int& minValue, int& maxValue) const {
    minValue = 0;
    maxValue = 1;
}

// ============================================================================
// Factory Functions
// ============================================================================

ISensor* createSensor(const std::string& type, const std::string& id, int pin) {
    if (type == "temperature") {
        return new TemperatureSensor(id, pin);
    } else if (type == "humidity") {
        return new HumiditySensor(id, pin);
    } else if (type == "pressure") {
        return new PressureSensor(id, pin);
    } else if (type == "analog") {
        return new AnalogSensor(id, pin);
    }
    return nullptr;
}

IActuator* createActuator(const std::string& type, const std::string& id, int pin) {
    if (type == "relay") {
        return new RelayActuator(id, pin);
    } else if (type == "servo") {
        return new ServoActuator(id, pin);
    } else if (type == "pwm") {
        return new PWMActuator(id, pin);
    } else if (type == "digital") {
        return new DigitalOutputActuator(id, pin);
    }
    return nullptr;
}

// Made with Bob
