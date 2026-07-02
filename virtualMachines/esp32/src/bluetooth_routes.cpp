#ifdef ENABLE_BLUETOOTH_DEVICES

#include "bluetooth_routes.h"

#include <ArduinoJson.h>

namespace {

String deviceTypeToString(BLEDeviceType type) {
    switch (type) {
        case BLEDeviceType::LIGHTBULB: return "lightbulb";
        case BLEDeviceType::OUTLET: return "outlet";
        case BLEDeviceType::WATER_CONTROLLER: return "water_controller";
        case BLEDeviceType::WATCH: return "watch";
        case BLEDeviceType::SENSOR: return "sensor";
        case BLEDeviceType::SPEAKER: return "speaker";
        case BLEDeviceType::OTHER: return "other";
        default: return "unknown";
    }
}

bool parseBoolValue(const String& value) {
    return value == "1" || value.equalsIgnoreCase("true") || value.equalsIgnoreCase("yes") || value.equalsIgnoreCase("on");
}

bool getRequestValue(AsyncWebServerRequest* request, const char* key, String& out) {
    if (request->hasParam(key, true)) {
        out = request->getParam(key, true)->value();
        return true;
    }
    if (request->hasParam(key)) {
        out = request->getParam(key)->value();
        return true;
    }
    return false;
}

void addDeviceToArray(JsonArray arr, const BluetoothDevice& device) {
    JsonObject obj = arr.add<JsonObject>();
    obj["address"] = device.address;
    obj["name"] = device.name;
    obj["type"] = deviceTypeToString(device.type);
    obj["manufacturer"] = device.manufacturer;
    obj["manufacturerData"] = device.manufacturerData;
    obj["rssi"] = device.rssi;
    obj["distanceFeet"] = device.distanceFeet;
    obj["distanceMeters"] = device.distanceMeters;
    obj["controllable"] = device.controllable;
    obj["connected"] = device.connected;
    obj["powerState"] = device.powerState;
    obj["brightness"] = device.brightness;
    obj["color"] = device.color;
    obj["lastSeen"] = static_cast<uint32_t>(device.lastSeen);
    JsonArray services = obj["serviceUUIDs"].to<JsonArray>();
    for (const auto& serviceUUID : device.serviceUUIDs) {
        services.add(serviceUUID);
    }
}

void sendJson(AsyncWebServerRequest* request, JsonDocument& doc, int code = 200) {
    String body;
    serializeJson(doc, body);
    request->send(code, "application/json", body);
}

} // namespace

void registerBluetoothRoutes(AsyncWebServer& server) {
    server.on("/api/bluetooth/devices", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["enabled"] = globalBluetoothService != nullptr;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        doc["scanning"] = globalBluetoothService->isScanning();
        auto devices = doc["devices"].to<JsonArray>();
        const auto allDevices = globalBluetoothService->getAllDevices();
        for (const auto& device : allDevices) {
            addDeviceToArray(devices, device);
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth/devices/controllable", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["enabled"] = globalBluetoothService != nullptr;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        auto devices = doc["devices"].to<JsonArray>();
        const auto controllable = globalBluetoothService->getControllableDevices();
        for (const auto& device : controllable) {
            addDeviceToArray(devices, device);
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth/device", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String address;
        if (!getRequestValue(request, "address", address) || address.isEmpty()) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }

        BluetoothDevice* device = globalBluetoothService->getDevice(address);
        if (!device) {
            doc["error"] = "device not found";
            doc["address"] = address;
            sendJson(request, doc, 404);
            return;
        }

        doc["enabled"] = true;
        auto deviceObj = doc["device"].to<JsonObject>();
        deviceObj["address"] = device->address;
        deviceObj["name"] = device->name;
        deviceObj["type"] = deviceTypeToString(device->type);
        deviceObj["manufacturer"] = device->manufacturer;
        deviceObj["rssi"] = device->rssi;
        deviceObj["distanceFeet"] = device->distanceFeet;
        deviceObj["distanceMeters"] = device->distanceMeters;
        deviceObj["controllable"] = device->controllable;
        deviceObj["connected"] = device->connected;
        deviceObj["powerState"] = device->powerState;
        deviceObj["brightness"] = device->brightness;
        deviceObj["color"] = device->color;
        deviceObj["lastSeen"] = static_cast<uint32_t>(device->lastSeen);
        deviceObj["manufacturerData"] = device->manufacturerData;
        JsonArray services = deviceObj["serviceUUIDs"].to<JsonArray>();
        for (const auto& serviceUUID : device->serviceUUIDs) {
            services.add(serviceUUID);
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth/scan", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        int duration = 10;
        String value;
        if (getRequestValue(request, "duration", value)) {
            duration = value.toInt();
            if (duration <= 0) duration = 10;
            if (duration > 60) duration = 60;
        }

        const bool started = globalBluetoothService->startScan(duration);
        doc["started"] = started;
        doc["duration"] = duration;
        doc["scanning"] = globalBluetoothService->isScanning();
        if (!started) {
            doc["error"] = "scan already running";
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth/scan/stop", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        globalBluetoothService->stopScan();
        doc["stopped"] = true;
        doc["scanning"] = globalBluetoothService->isScanning();
        sendJson(request, doc);
    });

    server.on("/api/bluetooth/connect", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String address;
        if (!getRequestValue(request, "address", address) || address.isEmpty()) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }

        const bool ok = globalBluetoothService->connectDevice(address);
        doc["connected"] = ok;
        doc["address"] = address;
        sendJson(request, doc, ok ? 200 : 409);
    });

    server.on("/api/bluetooth/disconnect", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String address;
        if (!getRequestValue(request, "address", address) || address.isEmpty()) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }

        const bool ok = globalBluetoothService->disconnectDevice(address);
        doc["disconnected"] = ok;
        doc["address"] = address;
        sendJson(request, doc, ok ? 200 : 409);
    });

    server.on("/api/bluetooth/control", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalBluetoothService) {
            doc["error"] = "bluetooth service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String address;
        String action;
        if (!getRequestValue(request, "address", address) || address.isEmpty()) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }
        if (!getRequestValue(request, "action", action) || action.isEmpty()) {
            doc["error"] = "action is required";
            sendJson(request, doc, 400);
            return;
        }

        JsonDocument params;
        String brightness;
        String color;
        if (getRequestValue(request, "brightness", brightness)) {
            params["brightness"] = brightness.toInt();
        }
        if (getRequestValue(request, "color", color)) {
            params["color"] = color;
        }

        const bool ok = globalBluetoothService->controlDevice(address, action, params);
        doc["ok"] = ok;
        doc["address"] = address;
        doc["action"] = action;
        sendJson(request, doc, ok ? 200 : 409);
    });

    server.on("/api/bluetooth/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["enabled"] = globalBluetoothService != nullptr;
        if (globalBluetoothService) {
            doc["scanning"] = globalBluetoothService->isScanning();
            doc["deviceCount"] = globalBluetoothService->getDeviceCount();
            doc["scanInterval"] = globalBluetoothService->getScanInterval();
            doc["scanDuration"] = globalBluetoothService->getScanDuration();
            doc["autoDiscovery"] = globalBluetoothService->isAutoDiscoveryEnabled();
        }
        sendJson(request, doc);
    });
}

#ifdef ENABLE_EVENT_SCHEDULER
void registerSchedulerRoutes(AsyncWebServer& server) {
    server.on("/api/schedules", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalEventScheduler) {
            doc["error"] = "scheduler service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String raw = globalEventScheduler->toJson();
        DeserializationError err = deserializeJson(doc, raw);
        if (err) {
            JsonDocument fallback;
            fallback["error"] = "failed to serialize schedules";
            sendJson(request, fallback, 500);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/schedules/upcoming", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalEventScheduler) {
            doc["error"] = "scheduler service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        int count = 10;
        if (request->hasParam("count")) {
            count = request->getParam("count")->value().toInt();
            if (count <= 0) count = 10;
            if (count > 100) count = 100;
        }

        auto arr = doc["events"].to<JsonArray>();
        const auto events = globalEventScheduler->getUpcomingEvents(count);
        for (const auto& event : events) {
            JsonObject obj = arr.add<JsonObject>();
            obj["id"] = event.id;
            obj["name"] = event.name;
            obj["deviceId"] = event.deviceId;
            obj["deviceType"] = event.deviceType;
            obj["action"] = event.action;
            obj["schedule"] = event.schedule;
            obj["nextRun"] = static_cast<int64_t>(event.nextRun);
            obj["enabled"] = event.enabled;
        }

        sendJson(request, doc);
    });

    server.on("/api/schedules/quick", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalEventScheduler) {
            doc["error"] = "scheduler service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String deviceId;
        String action;
        String time;
        if (!getRequestValue(request, "deviceId", deviceId) || deviceId.isEmpty()) {
            doc["error"] = "deviceId is required";
            sendJson(request, doc, 400);
            return;
        }
        if (!getRequestValue(request, "action", action) || action.isEmpty()) {
            doc["error"] = "action is required";
            sendJson(request, doc, 400);
            return;
        }
        if (!getRequestValue(request, "time", time) || time.isEmpty()) {
            doc["error"] = "time is required";
            sendJson(request, doc, 400);
            return;
        }

        String deviceType = "bluetooth";
        getRequestValue(request, "deviceType", deviceType);

        String duration;
        getRequestValue(request, "duration", duration);

        bool recurring = false;
        String recurringRaw;
        if (getRequestValue(request, "recurring", recurringRaw)) {
            recurring = parseBoolValue(recurringRaw);
        }

        const String id = globalEventScheduler->scheduleFromNaturalLanguage(
            deviceId,
            deviceType,
            action,
            time,
            duration,
            recurring);

        if (id.isEmpty()) {
            doc["error"] = "failed to create schedule";
            sendJson(request, doc, 409);
            return;
        }

        doc["created"] = true;
        doc["id"] = id;
        sendJson(request, doc);
    });

    server.on("/api/schedules/trigger", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalEventScheduler) {
            doc["error"] = "scheduler service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String id;
        if (!getRequestValue(request, "id", id) || id.isEmpty()) {
            doc["error"] = "id is required";
            sendJson(request, doc, 400);
            return;
        }

        const bool ok = globalEventScheduler->triggerEvent(id);
        doc["triggered"] = ok;
        doc["id"] = id;
        sendJson(request, doc, ok ? 200 : 404);
    });

    server.on("/api/schedules/enable", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalEventScheduler) {
            doc["error"] = "scheduler service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String id;
        if (!getRequestValue(request, "id", id) || id.isEmpty()) {
            doc["error"] = "id is required";
            sendJson(request, doc, 400);
            return;
        }

        const bool ok = globalEventScheduler->enableEvent(id);
        doc["enabled"] = ok;
        doc["id"] = id;
        sendJson(request, doc, ok ? 200 : 404);
    });

    server.on("/api/schedules/disable", HTTP_POST, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        if (!globalEventScheduler) {
            doc["error"] = "scheduler service unavailable";
            sendJson(request, doc, 503);
            return;
        }

        String id;
        if (!getRequestValue(request, "id", id) || id.isEmpty()) {
            doc["error"] = "id is required";
            sendJson(request, doc, 400);
            return;
        }

        const bool ok = globalEventScheduler->disableEvent(id);
        doc["disabled"] = ok;
        doc["id"] = id;
        sendJson(request, doc, ok ? 200 : 404);
    });
}
#endif

#endif // ENABLE_BLUETOOTH_DEVICES
