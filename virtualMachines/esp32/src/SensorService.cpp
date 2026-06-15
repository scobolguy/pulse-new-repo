#include "SensorService.h"
#include <Wire.h>
#ifdef ARDUINO_ARCH_ESP32
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>
#else
#include <DHT.h>
#include <Adafruit_BME280.h>
#include <Adafruit_BMP280.h>
#endif

namespace SensorService {

SensorResult readSensor(SensorType type, int pin, String unit) {
    SensorResult result;
    result.unit = unit;
    if (type == SensorType::DHT11 || type == SensorType::DHT21 || type == SensorType::DHT22) {
        uint8_t dhtType = DHT22;
        if (type == SensorType::DHT11) dhtType = DHT11;
        if (type == SensorType::DHT21) dhtType = DHT21;
        DHT dht(pin, dhtType);
        dht.begin();
        delay(100); // Let sensor stabilize
        float temp = dht.readTemperature(unit == "F");
        float hum = dht.readHumidity();
        if (isnan(temp) || isnan(hum)) {
            result.error = "Failed to read from DHT sensor";
            return result;
        }
        result.temperature = temp;
        result.humidity = hum;
        result.valid = true;
        return result;
    }
    if (type == SensorType::BME280 || type == SensorType::BMP280) {
        // I2C address can be 0x76 or 0x77
        Adafruit_BME280 bme;
        Adafruit_BMP280 bmp;
        bool status = false;
        if (type == SensorType::BME280) {
            status = bme.begin(0x76) || bme.begin(0x77);
            if (!status) {
                result.error = "BME280 not found";
                return result;
            }
            float temp = bme.readTemperature();
            float hum = bme.readHumidity();
            float pres = bme.readPressure() / 100.0F;
            if (unit == "F") temp = temp * 9.0 / 5.0 + 32.0;
            result.temperature = temp;
            result.humidity = hum;
            result.pressure = pres;
            result.valid = true;
            return result;
        } else {
            status = bmp.begin(0x76) || bmp.begin(0x77);
            if (!status) {
                result.error = "BMP280 not found";
                return result;
            }
            float temp = bmp.readTemperature();
            float pres = bmp.readPressure() / 100.0F;
            if (unit == "F") temp = temp * 9.0 / 5.0 + 32.0;
            result.temperature = temp;
            result.pressure = pres;
            result.valid = true;
            return result;
        }
    }
    result.error = "Unknown sensor type";
    return result;
}

void resultToJson(const SensorResult& result, String& json) {
    JsonDocument doc;
    doc["valid"] = result.valid;
    if (result.valid) {
        doc["temperature"] = result.temperature;
        doc["unit"] = result.unit;
        if (!isnan(result.humidity)) doc["humidity"] = result.humidity;
        if (!isnan(result.pressure)) doc["pressure"] = result.pressure;
    } else {
        doc["error"] = result.error;
    }
    serializeJson(doc, json);
}

} // namespace SensorService
