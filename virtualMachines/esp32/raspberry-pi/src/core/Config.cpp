#include "core/Config.h"

#include <cctype>
#include <fstream>
#include <limits>
#include <sstream>
#include <stdexcept>

namespace pulse::core {

namespace {
std::string readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("unable to open config file: " + path);
    }

    std::ostringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

std::string extractJsonString(const std::string& json, const std::string& key, const std::string& fallback) {
    const std::string marker = "\"" + key + "\"";
    const std::size_t keyPos = json.find(marker);
    if (keyPos == std::string::npos) return fallback;

    const std::size_t colonPos = json.find(':', keyPos + marker.size());
    if (colonPos == std::string::npos) return fallback;

    const std::size_t firstQuote = json.find('"', colonPos + 1);
    if (firstQuote == std::string::npos) return fallback;

    const std::size_t secondQuote = json.find('"', firstQuote + 1);
    if (secondQuote == std::string::npos) return fallback;

    return json.substr(firstQuote + 1, secondQuote - firstQuote - 1);
}

bool extractObjectBool(const std::string& json,
                       const std::string& objectKey,
                       const std::string& key,
                       bool fallback) {
    const std::string objectMarker = "\"" + objectKey + "\"";
    const std::size_t objectPos = json.find(objectMarker);
    if (objectPos == std::string::npos) return fallback;

    const std::size_t objectStart = json.find('{', objectPos + objectMarker.size());
    if (objectStart == std::string::npos) return fallback;

    const std::size_t objectEnd = json.find('}', objectStart + 1);
    if (objectEnd == std::string::npos) return fallback;

    const std::string objectChunk = json.substr(objectStart, objectEnd - objectStart + 1);
    const std::string keyMarker = "\"" + key + "\"";
    const std::size_t keyPos = objectChunk.find(keyMarker);
    if (keyPos == std::string::npos) return fallback;

    const std::size_t colonPos = objectChunk.find(':', keyPos + keyMarker.size());
    if (colonPos == std::string::npos) return fallback;

    const std::string tail = objectChunk.substr(colonPos + 1);
    if (tail.find("true") != std::string::npos) return true;
    if (tail.find("false") != std::string::npos) return false;
    return fallback;
}

int extractObjectInt(const std::string& json,
                     const std::string& objectKey,
                     const std::string& key,
                     int fallback) {
    const std::string objectMarker = "\"" + objectKey + "\"";
    const std::size_t objectPos = json.find(objectMarker);
    if (objectPos == std::string::npos) return fallback;

    const std::size_t objectStart = json.find('{', objectPos + objectMarker.size());
    if (objectStart == std::string::npos) return fallback;

    const std::size_t objectEnd = json.find('}', objectStart + 1);
    if (objectEnd == std::string::npos) return fallback;

    const std::string objectChunk = json.substr(objectStart, objectEnd - objectStart + 1);
    const std::string keyMarker = "\"" + key + "\"";
    const std::size_t keyPos = objectChunk.find(keyMarker);
    if (keyPos == std::string::npos) return fallback;

    const std::size_t colonPos = objectChunk.find(':', keyPos + keyMarker.size());
    if (colonPos == std::string::npos) return fallback;

    std::size_t firstDigit = objectChunk.find_first_of("-0123456789", colonPos + 1);
    if (firstDigit == std::string::npos) return fallback;

    std::size_t afterDigits = firstDigit + 1;
    while (afterDigits < objectChunk.size() && std::isdigit(static_cast<unsigned char>(objectChunk[afterDigits]))) {
        ++afterDigits;
    }

    try {
        const long parsed = std::stol(objectChunk.substr(firstDigit, afterDigits - firstDigit));
        if (parsed < std::numeric_limits<int>::min() || parsed > std::numeric_limits<int>::max()) {
            return fallback;
        }
        return static_cast<int>(parsed);
    } catch (...) {
        return fallback;
    }
}

std::string extractObjectString(const std::string& json,
                                const std::string& objectKey,
                                const std::string& key,
                                const std::string& fallback) {
    const std::string objectMarker = "\"" + objectKey + "\"";
    const std::size_t objectPos = json.find(objectMarker);
    if (objectPos == std::string::npos) return fallback;

    const std::size_t objectStart = json.find('{', objectPos + objectMarker.size());
    if (objectStart == std::string::npos) return fallback;

    const std::size_t objectEnd = json.find('}', objectStart + 1);
    if (objectEnd == std::string::npos) return fallback;

    const std::string objectChunk = json.substr(objectStart, objectEnd - objectStart + 1);
    const std::string keyMarker = "\"" + key + "\"";
    const std::size_t keyPos = objectChunk.find(keyMarker);
    if (keyPos == std::string::npos) return fallback;

    const std::size_t colonPos = objectChunk.find(':', keyPos + keyMarker.size());
    if (colonPos == std::string::npos) return fallback;

    const std::size_t firstQuote = objectChunk.find('"', colonPos + 1);
    if (firstQuote == std::string::npos) return fallback;

    const std::size_t secondQuote = objectChunk.find('"', firstQuote + 1);
    if (secondQuote == std::string::npos) return fallback;

    return objectChunk.substr(firstQuote + 1, secondQuote - firstQuote - 1);
}
}

NodeConfig Config::load(const std::string& path) {
    const std::string json = readFile(path);

    NodeConfig config;
    config.nodeId = extractJsonString(json, "nodeId", "raspberry-pi-node");
    config.role = extractJsonString(json, "role", "pi-gateway");
    config.backendUrl = extractJsonString(json, "backendUrl", "http://localhost:4000");
    config.queueManagerUrl = extractJsonString(json, "queueManagerUrl", "http://localhost:4100");
    config.alertQueue = extractJsonString(json, "alertQueue", "alerts");
    config.piperEnabled = extractObjectBool(json, "piper", "enabled", true);
    config.piperBinaryPath = extractObjectString(json, "piper", "binaryPath", "/usr/local/bin/piper");
    config.piperModelPath = extractObjectString(json, "piper", "modelPath", "/opt/pulse/voices/en_US-lessac-medium.onnx");
    config.piperOutputDevice = extractObjectString(json, "piper", "outputDevice", "default");
    config.piperSpeakTimeoutSec = extractObjectInt(json, "piper", "speakTimeoutSec", 15);
    config.bluetoothEnabled = extractObjectBool(json, "bluetooth", "enabled", true);
    config.bluetoothBleEnabled = extractObjectBool(json, "bluetooth", "bleEnabled", true);
    config.bluetoothClassicEnabled = extractObjectBool(json, "bluetooth", "classicEnabled", true);
    config.bluetoothHidEnabled = extractObjectBool(json, "bluetooth", "hidEnabled", false);
    config.bluetoothAdapter = extractObjectString(json, "bluetooth", "adapter", "hci0");
    config.bluetoothAutoConnectMacsCsv = extractObjectString(json, "bluetooth", "autoConnectMacsCsv", "");
    config.bluetoothHidCommand = extractObjectString(json, "bluetooth", "hidCommand", "");
    config.doorbellEnabled = extractObjectBool(json, "doorbell", "enabled", true);
    config.discoveryEnabled = extractObjectBool(json, "discovery", "enabled", true);
    config.discoveryPort = extractObjectInt(json, "discovery", "port", 4101);
    config.discoveryIntervalMs = extractObjectInt(json, "discovery", "intervalMs", 5000);
    config.httpEnabled = extractObjectBool(json, "http", "enabled", true);
    config.httpPort = extractObjectInt(json, "http", "port", 80);
    config.ffsEnabled = extractObjectBool(json, "ffs", "enabled", true);
    config.ffsPollIntervalMs = extractObjectInt(json, "ffs", "pollIntervalMs", 15000);
    config.ffsCachePath = extractObjectString(json, "ffs", "cachePath", "runtime/ffs-cache");
    config.pmachinePcodeFile = extractObjectString(json, "pmachine", "pcodeFile", "/router-mapper.pcode");
    config.pmachineProgramMap = extractObjectString(json, "pmachine", "programMap", "/router-mapper.program.json");
    config.queuePollIntervalMs = extractObjectInt(json, "queue", "pollIntervalMs", 1000);

    return config;
}

} // namespace pulse::core
