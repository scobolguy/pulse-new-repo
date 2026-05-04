#pragma once
#include <Arduino.h>
#include <ArduinoJson.h>

namespace SensorService {

// Supported sensor types
enum class SensorType {
    DHT11,
    DHT21,
    DHT22,
    BME280,
    BMP280
};

struct SensorResult {
    float temperature = NAN;
    float humidity = NAN;
    float pressure = NAN;
    String unit = "C";
    bool valid = false;
    String error;
};

// Reads the sensor and fills SensorResult
SensorResult readSensor(SensorType type, int pin, String unit = "C");

// Serializes SensorResult to JSON
void resultToJson(const SensorResult& result, String& json);

}
