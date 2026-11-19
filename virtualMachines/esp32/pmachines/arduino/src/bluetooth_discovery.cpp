#include "bluetooth_discovery.h"

#if defined(ESP32) && !defined(PULSE_DISABLE_BLE_DISCOVERY)
#include <NimBLEDevice.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <algorithm>
#include <cctype>
#include <vector>
#include <ArduinoJson.h>

namespace pmachine {
namespace {
constexpr size_t MAX_DEVICES = 32;
struct Device {
    std::string address;
    std::string name;
    std::string serviceUuid;
    std::string manufacturerData;
    int rssi = 0;
};

SemaphoreHandle_t scanMutex;
SemaphoreHandle_t devicesMutex;
NimBLEScan* scanner;
std::vector<Device> devices;
bool initialized;

std::string hex(const std::string& data, size_t limit) {
    constexpr char digits[] = "0123456789ABCDEF";
    std::string result;
    const size_t count = std::min(data.size(), limit);
    result.reserve(count * 2);
    for (size_t index = 0; index < count; ++index) {
        const uint8_t value = static_cast<uint8_t>(data[index]);
        result.push_back(digits[value >> 4]);
        result.push_back(digits[value & 15]);
    }
    return result;
}

bool initialize(std::string& error) {
    if (initialized) return true;
    if (!scanMutex) scanMutex = xSemaphoreCreateMutex();
    if (!devicesMutex) devicesMutex = xSemaphoreCreateMutex();
    if (!scanMutex || !devicesMutex) {
        error = "Unable to allocate Bluetooth scanner locks";
        return false;
    }
    NimBLEDevice::init("Pulse");
    scanner = NimBLEDevice::getScan();
    if (!scanner) {
        error = "Unable to initialize the NimBLE scanner";
        return false;
    }
    scanner->setActiveScan(true);
    scanner->setInterval(100);
    scanner->setWindow(99);
    initialized = true;
    return true;
}

class DiscoveryCallbacks final : public NimBLEAdvertisedDeviceCallbacks {
public:
    void onResult(NimBLEAdvertisedDevice* advertised) override {
        Device incoming;
        incoming.address = advertised->getAddress().toString();
        incoming.name = advertised->haveName() ? advertised->getName() : "";
        incoming.rssi = advertised->getRSSI();
        if (advertised->haveServiceUUID())
            incoming.serviceUuid = advertised->getServiceUUID().toString();
        if (advertised->haveManufacturerData())
            incoming.manufacturerData = hex(advertised->getManufacturerData(), 32);

        if (xSemaphoreTake(devicesMutex, portMAX_DELAY) != pdTRUE) return;
        auto found = std::find_if(devices.begin(), devices.end(), [&](const Device& device) {
            return device.address == incoming.address;
        });
        if (found != devices.end()) {
            if (!incoming.name.empty()) found->name = std::move(incoming.name);
            if (!incoming.serviceUuid.empty()) found->serviceUuid = std::move(incoming.serviceUuid);
            if (!incoming.manufacturerData.empty()) found->manufacturerData = std::move(incoming.manufacturerData);
            found->rssi = incoming.rssi;
        } else if (devices.size() < MAX_DEVICES) {
            devices.push_back(std::move(incoming));
        }
        xSemaphoreGive(devicesMutex);
    }
};

DiscoveryCallbacks callbacks;

std::string classify(const std::string& name) {
    std::string normalized = name;
    std::transform(normalized.begin(), normalized.end(), normalized.begin(),
        [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (normalized.find("light") != std::string::npos ||
        normalized.find("bulb") != std::string::npos ||
        normalized.find("lamp") != std::string::npos) return "possible-light-bulb";
    return "unknown";
}
}

bool scanBluetoothDevices(int seconds, std::string& result, std::string& error) {
    if (seconds < 1 || seconds > 10) {
        error = "Bluetooth scan duration must be between 1 and 10 seconds";
        return false;
    }
    if (!initialize(error) || xSemaphoreTake(scanMutex, portMAX_DELAY) != pdTRUE) {
        if (error.empty()) error = "Unable to acquire the Bluetooth scanner";
        return false;
    }

    if (xSemaphoreTake(devicesMutex, portMAX_DELAY) == pdTRUE) {
        devices.clear();
        xSemaphoreGive(devicesMutex);
    }
    scanner->setAdvertisedDeviceCallbacks(&callbacks);
    if (!scanner->start(seconds, [](NimBLEScanResults) {}, false)) {
        xSemaphoreGive(scanMutex);
        error = "NimBLE scan could not be started";
        return false;
    }
    vTaskDelay(pdMS_TO_TICKS(seconds * 1000));
    if (scanner->isScanning()) scanner->stop();

    JsonDocument document;
    JsonArray output = document.to<JsonArray>();
    if (xSemaphoreTake(devicesMutex, portMAX_DELAY) != pdTRUE) {
        xSemaphoreGive(scanMutex);
        error = "Unable to read Bluetooth scan results";
        return false;
    }
    for (const auto& device : devices) {
        JsonObject item = output.add<JsonObject>();
        item["address"] = device.address;
        item["name"] = device.name.empty() ? "Unnamed Bluetooth device" : device.name;
        item["rssi"] = std::to_string(device.rssi);
        item["serviceUuid"] = device.serviceUuid;
        item["manufacturerData"] = device.manufacturerData;
        const std::string type = classify(device.name);
        item["deviceType"] = type;
        item["classificationReason"] = type == "unknown" ? "" : "advertised-name";
    }
    xSemaphoreGive(devicesMutex);
    serializeJson(document, result);
    xSemaphoreGive(scanMutex);
    return true;
}
}
#elif defined(ESP32)
namespace pmachine {
bool scanBluetoothDevices(int, std::string&, std::string& error) {
    error = "Bluetooth discovery is disabled in this firmware profile";
    return false;
}
}
#endif
