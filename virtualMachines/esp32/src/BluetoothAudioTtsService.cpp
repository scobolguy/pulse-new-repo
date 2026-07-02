#if defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)

#include "BluetoothAudioTtsService.h"

#include <ArduinoJson.h>
#include "BluetoothService.h"

BluetoothAudioTtsService* globalBluetoothAudioTtsService = nullptr;

namespace {

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

void sendJson(AsyncWebServerRequest* request, JsonDocument& doc, int code = 200) {
    String body;
    serializeJson(doc, body);
    request->send(code, "application/json", body);
}

String toAudioType(BLEDeviceType type) {
    switch (type) {
        case BLEDeviceType::SPEAKER: return "speaker";
        case BLEDeviceType::OTHER: return "other";
        default: return "other";
    }
}

} // namespace

BluetoothAudioTtsService::BluetoothAudioTtsService() = default;

bool BluetoothAudioTtsService::begin() {
    if (!globalBluetoothService) {
        lastError_ = "BluetoothService not initialized";
        return false;
    }
    lastError_ = "";
    return true;
}

void BluetoothAudioTtsService::loop() {
    // Placeholder for audio pipeline state machine.
}

bool BluetoothAudioTtsService::isAudioTargetName(const String& name) const {
    String n = name;
    n.toLowerCase();
    return n.indexOf("speaker") >= 0 || n.indexOf("headset") >= 0 || n.indexOf("headphone") >= 0 || n.indexOf("buds") >= 0;
}

bool BluetoothAudioTtsService::isAudioTargetType(const String& type) const {
    String t = type;
    t.toLowerCase();
    return t == "speaker";
}

bool BluetoothAudioTtsService::startDiscovery(int durationSeconds) {
    if (!globalBluetoothService) {
        lastError_ = "BluetoothService unavailable";
        return false;
    }

    const int clampedDuration = durationSeconds < 3 ? 3 : (durationSeconds > 20 ? 20 : durationSeconds);
    const bool started = globalBluetoothService->startScan(clampedDuration);
    if (!started) {
        lastError_ = "Discovery already running";
        return false;
    }
    lastError_ = "";
    lastCommandAt_ = millis();
    return true;
}

std::vector<BluetoothAudioTarget> BluetoothAudioTtsService::listTargets() const {
    std::vector<BluetoothAudioTarget> out;
    if (!globalBluetoothService) return out;

    const auto devices = globalBluetoothService->getAllDevices();
    for (const auto& device : devices) {
        const String type = toAudioType(device.type);
        if (!(isAudioTargetType(type) || isAudioTargetName(device.name))) {
            continue;
        }

        BluetoothAudioTarget target;
        target.address = device.address;
        target.name = device.name;
        target.type = type;
        target.rssi = device.rssi;
        target.connected = device.connected;
        out.push_back(target);
    }
    return out;
}

bool BluetoothAudioTtsService::connectTarget(const String& address, String& errorOut) {
    if (!globalBluetoothService) {
        errorOut = "BluetoothService unavailable";
        lastError_ = errorOut;
        return false;
    }
    if (address.length() == 0) {
        errorOut = "address is required";
        lastError_ = errorOut;
        return false;
    }

    if (!globalBluetoothService->connectDevice(address)) {
        errorOut = "connect failed";
        lastError_ = errorOut;
        return false;
    }

    selectedTargetAddress_ = address;
    if (BluetoothDevice* device = globalBluetoothService->getDevice(address)) {
        selectedTargetName_ = device->name;
    }

    lastError_ = "";
    lastCommandAt_ = millis();
    return true;
}

bool BluetoothAudioTtsService::disconnectTarget(String& errorOut) {
    if (!globalBluetoothService) {
        errorOut = "BluetoothService unavailable";
        lastError_ = errorOut;
        return false;
    }
    if (selectedTargetAddress_.length() == 0) {
        errorOut = "no target selected";
        lastError_ = errorOut;
        return false;
    }

    if (!globalBluetoothService->disconnectDevice(selectedTargetAddress_)) {
        errorOut = "disconnect failed";
        lastError_ = errorOut;
        return false;
    }

    selectedTargetAddress_ = "";
    selectedTargetName_ = "";
    lastError_ = "";
    lastCommandAt_ = millis();
    return true;
}

bool BluetoothAudioTtsService::queueMp3Playback(const String& source, bool isUrl, String& errorOut) {
    if (!hasSelectedTarget()) {
        errorOut = "no selected bluetooth audio target";
        lastError_ = errorOut;
        return false;
    }
    if (source.length() == 0) {
        errorOut = "source is required";
        lastError_ = errorOut;
        return false;
    }

    // Placeholder queue semantics until A2DP pipeline is wired.
    lastMp3Source_ = source;
    lastMp3WasUrl_ = isUrl;
    lastError_ = "";
    lastCommandAt_ = millis();
    return true;
}

bool BluetoothAudioTtsService::queueTts(const String& text, const String& voice, String& errorOut) {
    if (!hasSelectedTarget()) {
        errorOut = "no selected bluetooth audio target";
        lastError_ = errorOut;
        return false;
    }
    if (text.length() == 0) {
        errorOut = "text is required";
        lastError_ = errorOut;
        return false;
    }

    // Placeholder queue semantics until TTS backend is wired.
    lastTtsText_ = text;
    lastTtsVoice_ = voice.length() ? voice : "default";
    lastError_ = "";
    lastCommandAt_ = millis();
    return true;
}

void registerBluetoothAudioTtsRoutes(AsyncWebServer& server, BluetoothAudioTtsService& service) {
    server.on("/api/bluetooth-audio/discover", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        String durationRaw;
        int duration = 8;
        if (getRequestValue(request, "duration", durationRaw)) {
            duration = durationRaw.toInt();
        }

        const bool ok = service.startDiscovery(duration);
        doc["ok"] = ok;
        doc["duration"] = duration;
        if (!ok) {
            doc["error"] = service.lastError();
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/targets", HTTP_GET, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        auto targets = doc["targets"].to<JsonArray>();
        for (const auto& target : service.listTargets()) {
            auto t = targets.add<JsonObject>();
            t["address"] = target.address;
            t["name"] = target.name;
            t["type"] = target.type;
            t["rssi"] = target.rssi;
            t["connected"] = target.connected;
        }
        doc["selectedAddress"] = service.selectedAddress();
        doc["selectedName"] = service.selectedName();
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/connect", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        String address;
        if (!getRequestValue(request, "address", address) || address.length() == 0) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }

        String err;
        const bool ok = service.connectTarget(address, err);
        doc["ok"] = ok;
        doc["address"] = address;
        doc["selectedAddress"] = service.selectedAddress();
        doc["selectedName"] = service.selectedName();
        if (!ok) {
            doc["error"] = err;
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/disconnect", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        String err;
        const bool ok = service.disconnectTarget(err);
        doc["ok"] = ok;
        if (!ok) {
            doc["error"] = err;
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/play-mp3", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        String url;
        String file;
        getRequestValue(request, "url", url);
        getRequestValue(request, "file", file);

        const bool useUrl = url.length() > 0;
        const String source = useUrl ? url : file;
        String err;
        const bool ok = service.queueMp3Playback(source, useUrl, err);
        doc["ok"] = ok;
        doc["source"] = source;
        doc["sourceType"] = useUrl ? "url" : "file";
        if (!ok) {
            doc["error"] = err;
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/tts", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        String text;
        String voice;
        getRequestValue(request, "text", text);
        getRequestValue(request, "voice", voice);

        String err;
        const bool ok = service.queueTts(text, voice, err);
        doc["ok"] = ok;
        doc["voice"] = voice.length() ? voice : "default";
        if (!ok) {
            doc["error"] = err;
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/status", HTTP_GET, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        doc["selectedAddress"] = service.selectedAddress();
        doc["selectedName"] = service.selectedName();
        doc["lastMp3Source"] = service.lastMp3Source();
        doc["lastMp3WasUrl"] = service.lastMp3WasUrl();
        doc["lastTtsText"] = service.lastTtsText();
        doc["lastTtsVoice"] = service.lastTtsVoice();
        doc["lastError"] = service.lastError();
        doc["lastCommandAt"] = static_cast<uint32_t>(service.lastCommandAt());
        sendJson(request, doc);
    });
}

#endif // defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)
