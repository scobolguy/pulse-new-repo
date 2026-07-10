#pragma once

#include <string>

namespace pulse::core {

struct AlertEvent {
    std::string kind;
    std::string eventType;
    std::string sourceNode;
    std::string snapshotUrl;
    std::string payload;
};

struct NodeConfig {
    std::string nodeId;
    std::string role;
    std::string backendUrl;
    std::string queueManagerUrl;
    std::string alertQueue;
    bool bluetoothEnabled = true;
    bool bluetoothBleEnabled = true;
    bool bluetoothClassicEnabled = true;
    bool bluetoothHidEnabled = false;
    std::string bluetoothAdapter = "hci0";
    std::string bluetoothAutoConnectMacsCsv;
    std::string bluetoothHidCommand;
    bool piperEnabled = true;
    std::string piperBinaryPath = "/usr/local/bin/piper";
    std::string piperModelPath = "/opt/pulse/voices/en_US-lessac-medium.onnx";
    std::string piperOutputDevice = "default";
    int piperSpeakTimeoutSec = 15;
    bool doorbellEnabled = true;
    bool discoveryEnabled = true;
    int discoveryPort = 4101;
    int discoveryIntervalMs = 5000;
    bool httpEnabled = true;
    int httpPort = 80;
    bool ffsEnabled = true;
    int ffsPollIntervalMs = 15000;
    std::string ffsCachePath = "runtime/ffs-cache";
    std::string pmachinePcodeFile = "/router-mapper.pcode";
    std::string pmachineProgramMap = "/router-mapper.program.json";
    int queuePollIntervalMs = 1000;
};

} // namespace pulse::core
