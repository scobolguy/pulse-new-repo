#if defined(ESP32) && defined(ENABLE_BT_CONTROL_PLANE)

#include "bluetooth_control_plane.h"

#include <NimBLEDevice.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <mbedtls/base64.h>

#include "control_plane_commands.h"
#include "ffs/FederatedFileSystem.h"
#if defined(ENABLE_PMACHINE)
#include "pmachine_routes.h"
#endif
#if defined(ENABLE_DISPLAY)
#include "DisplayService.h"
#endif

extern FederatedFileSystem federatedFS;
#if defined(ENABLE_PMACHINE)
extern pmachine::PMachine pm;
#endif
#if defined(ENABLE_DISPLAY) && !defined(DISPLAY_NO_LVGL)
extern bool displayStatusDashboardActive;
#endif

namespace {
constexpr char kServiceUuid[] = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char kRxUuid[] = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr char kTxUuid[] = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";
constexpr size_t kMaxRxChunkBytes = 512;
constexpr size_t kMaxControlLineBytes = 16384;
constexpr size_t kNotificationChunkBytes = 20;
constexpr size_t kMaxRpcResponseBytes = 65536;
constexpr size_t kMaxBleFileBytes = 96U * 1024U;
constexpr uint32_t kPcodeWorkerStackBytes = 12288;
constexpr TickType_t kStreamAckTimeoutTicks = pdMS_TO_TICKS(1500);
constexpr uint8_t kStreamFrameAttempts = 3;
constexpr size_t kStreamHeaderBytes = 20;
constexpr size_t kStreamPayloadBytes = 64;
constexpr uint8_t kStreamTypeBegin = 1;
constexpr uint8_t kStreamTypeData = 2;
constexpr uint8_t kStreamTypeEnd = 3;
constexpr uint8_t kStreamTypeAbort = 4;
constexpr uint8_t kStreamTypeAck = 5;
constexpr uint8_t kStreamMagic[] = {'P', 'L', 'S', '1'};

struct RxChunk {
    uint16_t length;
    char data[kMaxRxChunkBytes];
};

QueueHandle_t gRxQueue = nullptr;
NimBLECharacteristic* gTxCharacteristic = nullptr;
volatile bool gClientConnected = false;
SemaphoreHandle_t gRpcTransactionMutex = nullptr;
SemaphoreHandle_t gRpcDone = nullptr;
volatile uint32_t gRpcActiveId = 0;
uint32_t gRpcNextId = 1;
int gRpcResponseCode = -1;
String gRpcResponseBody;
size_t gRpcExpectedBodyBytes = 0;
size_t gRpcReceivedBodyBytes = 0;
bool gRpcReceivingBody = false;
int gBleFileHandle = 0;
String gBleFilePath;
size_t gBleFileExpectedBytes = 0;
size_t gBleFileWrittenBytes = 0;
#if defined(ENABLE_PMACHINE)
TaskHandle_t gPcodeWorkerTask = nullptr;
uint32_t gNextPcodeStreamId = 1;
SemaphoreHandle_t gStreamAck = nullptr;
volatile uint32_t gExpectedStreamAckId = 0;
volatile uint32_t gExpectedStreamAckSequence = 0;
#endif

void notifyBytes(const uint8_t* data, size_t size) {
    if (!gClientConnected || !gTxCharacteristic) {
        return;
    }

    for (size_t offset = 0; offset < size; offset += kNotificationChunkBytes) {
        const size_t chunkLength = min(kNotificationChunkBytes, size - offset);
        gTxCharacteristic->setValue(std::string(
            reinterpret_cast<const char*>(data + offset),
            chunkLength
        ));
        gTxCharacteristic->notify();
        delay(8);
    }
}

class BleResponseStream : public Stream {
public:
    int available() override { return 0; }
    int read() override { return -1; }
    int peek() override { return -1; }

    size_t write(uint8_t value) override {
        return write(&value, 1);
    }

    size_t write(const uint8_t* buffer, size_t size) override {
        for (size_t index = 0; index < size; ++index) {
            pending_ += static_cast<char>(buffer[index]);
            if (buffer[index] == '\n') {
                notifyPending();
            }
        }
        return size;
    }

private:
    void notifyPending() {
        if (!gClientConnected || !gTxCharacteristic) {
            pending_.clear();
            return;
        }

        notifyBytes(reinterpret_cast<const uint8_t*>(pending_.c_str()), pending_.length());
        pending_.clear();
    }

    String pending_;
};

BleResponseStream gBleResponse;

#if defined(ENABLE_PMACHINE)
struct PcodeOutputStreamState {
    uint32_t streamId = 0;
    uint32_t sequence = 0;
    size_t totalBytes = 0;
    uint32_t totalCrc32 = 0;
    uint8_t pending[kStreamPayloadBytes] = {};
    size_t pendingLength = 0;
    bool begun = false;
    bool failed = false;
};

uint32_t updateCrc32(uint32_t crc, const uint8_t* data, size_t size) {
    crc = ~crc;
    for (size_t index = 0; index < size; ++index) {
        crc ^= data[index];
        for (uint8_t bit = 0; bit < 8; ++bit) {
            crc = (crc >> 1) ^ (0xedb88320U & (0U - (crc & 1U)));
        }
    }
    return ~crc;
}

void writeUint16LE(uint8_t* target, uint16_t value) {
    target[0] = static_cast<uint8_t>(value);
    target[1] = static_cast<uint8_t>(value >> 8);
}

void writeUint32LE(uint8_t* target, uint32_t value) {
    target[0] = static_cast<uint8_t>(value);
    target[1] = static_cast<uint8_t>(value >> 8);
    target[2] = static_cast<uint8_t>(value >> 16);
    target[3] = static_cast<uint8_t>(value >> 24);
}

uint16_t readUint16LE(const uint8_t* source) {
    return static_cast<uint16_t>(source[0])
        | static_cast<uint16_t>(source[1] << 8);
}

uint32_t readUint32LE(const uint8_t* source) {
    return static_cast<uint32_t>(source[0])
        | (static_cast<uint32_t>(source[1]) << 8)
        | (static_cast<uint32_t>(source[2]) << 16)
        | (static_cast<uint32_t>(source[3]) << 24);
}

bool sendStreamFrame(
    uint32_t streamId,
    uint32_t sequence,
    uint8_t type,
    const uint8_t* payload = nullptr,
    uint16_t payloadLength = 0
) {
    if (!gStreamAck) {
        return false;
    }
    uint8_t header[kStreamHeaderBytes] = {};
    memcpy(header, kStreamMagic, sizeof(kStreamMagic));
    header[4] = type;
    header[5] = 0;
    writeUint16LE(header + 6, payloadLength);
    writeUint32LE(header + 8, streamId);
    writeUint32LE(header + 12, sequence);
    writeUint32LE(header + 16, updateCrc32(0, payload, payloadLength));

    gExpectedStreamAckId = streamId;
    gExpectedStreamAckSequence = sequence;
    while (xSemaphoreTake(gStreamAck, 0) == pdTRUE) {
    }
    for (uint8_t attempt = 0; attempt < kStreamFrameAttempts; ++attempt) {
        notifyBytes(header, sizeof(header));
        if (payloadLength > 0) {
            notifyBytes(payload, payloadLength);
        }
        if (xSemaphoreTake(gStreamAck, kStreamAckTimeoutTicks) == pdTRUE) {
            return true;
        }
    }
    return false;
}

bool flushStreamData(PcodeOutputStreamState& state) {
    if (state.pendingLength == 0) {
        return true;
    }
    const uint32_t sequence = state.sequence + 1;
    if (!sendStreamFrame(
            state.streamId,
            sequence,
            kStreamTypeData,
            state.pending,
            static_cast<uint16_t>(state.pendingLength)
        )) {
        state.failed = true;
        return false;
    }
    state.sequence = sequence;
    state.pendingLength = 0;
    return true;
}

bool appendStreamData(PcodeOutputStreamState& state, const uint8_t* data, size_t size) {
    size_t offset = 0;
    while (offset < size) {
        const size_t available = kStreamPayloadBytes - state.pendingLength;
        const size_t copied = min(available, size - offset);
        memcpy(state.pending + state.pendingLength, data + offset, copied);
        state.pendingLength += copied;
        state.totalCrc32 = updateCrc32(state.totalCrc32, data + offset, copied);
        state.totalBytes += copied;
        offset += copied;
        if (state.pendingLength == kStreamPayloadBytes && !flushStreamData(state)) {
            return false;
        }
    }
    return true;
}

void streamPcodeOutput(const std::string& outputLine, void* context) {
    auto* state = static_cast<PcodeOutputStreamState*>(context);
    if (!state || state->failed) {
        return;
    }
    if (!state->begun) {
        static const uint8_t contentType[] = "text/plain;charset=utf-8";
        if (!sendStreamFrame(
                state->streamId,
                0,
                kStreamTypeBegin,
                contentType,
                sizeof(contentType) - 1
            )) {
            state->failed = true;
            return;
        }
        state->begun = true;
    }
    const auto* bytes = reinterpret_cast<const uint8_t*>(outputLine.data());
    if (!appendStreamData(*state, bytes, outputLine.size())) {
        return;
    }
    static const uint8_t newline = '\n';
    appendStreamData(*state, &newline, 1);
}
#endif

class ControlPlaneServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer*) override {
        gClientConnected = true;
        Serial.println("[BLE-CP] client connected");
    }

    void onDisconnect(NimBLEServer*) override {
        gClientConnected = false;
        if (gBleFileHandle != 0) {
            federatedFS.closeFile(gBleFileHandle);
            gBleFileHandle = 0;
        }
        Serial.println("[BLE-CP] client disconnected");
        NimBLEDevice::startAdvertising();
    }
};

class ControlPlaneRxCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* characteristic) override {
        if (!gRxQueue) {
            return;
        }

        const std::string value = characteristic->getValue();
#if defined(ENABLE_PMACHINE)
        if (value.size() == kStreamHeaderBytes) {
            const auto* frame = reinterpret_cast<const uint8_t*>(value.data());
            if (memcmp(frame, kStreamMagic, sizeof(kStreamMagic)) == 0
                && frame[4] == kStreamTypeAck
                && readUint16LE(frame + 6) == 0
                && readUint32LE(frame + 8) == gExpectedStreamAckId
                && readUint32LE(frame + 12) == gExpectedStreamAckSequence) {
                xSemaphoreGive(gStreamAck);
                return;
            }
        }
#endif
        size_t offset = 0;
        while (offset < value.size()) {
            RxChunk chunk{};
            chunk.length = static_cast<uint16_t>(
                min(kMaxRxChunkBytes, value.size() - offset)
            );
            memcpy(chunk.data, value.data() + offset, chunk.length);
            if (xQueueSend(gRxQueue, &chunk, 0) != pdTRUE) {
                Serial.println("[BLE-CP] receive queue full");
                return;
            }
            offset += chunk.length;
        }
    }
};

ControlPlaneServerCallbacks gServerCallbacks;
ControlPlaneRxCallbacks gRxCallbacks;

bool decodeBase64(const String& encoded, std::vector<uint8_t>& decoded) {
    size_t decodedLength = 0;
    const int sizeResult = mbedtls_base64_decode(
        nullptr,
        0,
        &decodedLength,
        reinterpret_cast<const uint8_t*>(encoded.c_str()),
        encoded.length()
    );
    if (sizeResult != 0 && sizeResult != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) {
        return false;
    }
    decoded.resize(decodedLength);
    return mbedtls_base64_decode(
        decoded.data(),
        decoded.size(),
        &decodedLength,
        reinterpret_cast<const uint8_t*>(encoded.c_str()),
        encoded.length()
    ) == 0;
}

bool handleFilePut(const String& line) {
    JsonDocument request;
    if (deserializeJson(request, line.substring(String("FILE_PUT ").length()))) {
        gBleResponse.println("[BLE-CP] FILE_PUT invalid JSON");
        return true;
    }
    const String path = request["path"] | "";
    const String encoded = request["data"] | "";
    if (!path.startsWith("/ble/") || encoded.isEmpty()) {
        gBleResponse.println("[BLE-CP] FILE_PUT requires /ble/ path and data");
        return true;
    }
    if (!LittleFS.exists("/ble")) {
        LittleFS.mkdir("/ble");
    }
    std::vector<uint8_t> decoded;
    if (!decodeBase64(encoded, decoded)) {
        gBleResponse.println("[BLE-CP] FILE_PUT invalid base64");
        return true;
    }
    File file = LittleFS.open(path, "w");
    const bool written = file && file.write(decoded.data(), decoded.size()) == decoded.size();
    if (file) file.close();
    JsonDocument response;
    response["ok"] = written;
    response["path"] = path;
    response["bytes"] = static_cast<uint32_t>(decoded.size());
    String body;
    serializeJson(response, body);
    gBleResponse.println(String("[BLE-CP] file ") + body);
    return true;
}

bool isAllowedBleFilePath(const String& path) {
    return path.startsWith("/") && path.indexOf("..") < 0;
}

bool handleFileBegin(const String& line) {
    const size_t prefixLength = String("FILE_BEGIN ").length();
    const int pathEnd = line.indexOf(' ', prefixLength);
    if (pathEnd < 0) {
        gBleResponse.println("[BLE-CP] fileBegin {\"ok\":false,\"error\":\"invalid command\"}");
        return true;
    }

    const String path = line.substring(prefixLength, pathEnd);
    const String sizeText = line.substring(pathEnd + 1);
    const size_t expectedBytes = static_cast<size_t>(strtoul(sizeText.c_str(), nullptr, 10));
    if (!isAllowedBleFilePath(path) || expectedBytes == 0 || expectedBytes > kMaxBleFileBytes) {
        gBleResponse.println("[BLE-CP] fileBegin {\"ok\":false,\"error\":\"invalid path or size\"}");
        return true;
    }
    if (gBleFileHandle != 0) {
        federatedFS.closeFile(gBleFileHandle);
    }
    gBleFileHandle = federatedFS.openFile(path, "w");
    gBleFilePath = gBleFileHandle != 0 ? path : "";
    gBleFileExpectedBytes = gBleFileHandle != 0 ? expectedBytes : 0;
    gBleFileWrittenBytes = 0;
    const bool opened = gBleFileHandle != 0;
    gBleResponse.print("[BLE-CP] fileBegin {\"ok\":");
    gBleResponse.print(opened ? "true" : "false");
    gBleResponse.print(",\"expectedBytes\":");
    gBleResponse.print(static_cast<uint32_t>(expectedBytes));
    gBleResponse.println("}");
    return true;
}

bool handleFileAppend(const String& line) {
    const size_t prefixLength = String("FILE_APPEND ").length();
    const int pathEnd = line.indexOf(' ', prefixLength);
    const int offsetEnd = pathEnd >= 0 ? line.indexOf(' ', pathEnd + 1) : -1;
    if (pathEnd < 0 || offsetEnd < 0) {
        gBleResponse.println("[BLE-CP] fileAppend {\"ok\":false,\"error\":\"invalid command\"}");
        return true;
    }

    const String path = line.substring(prefixLength, pathEnd);
    const String offsetText = line.substring(pathEnd + 1, offsetEnd);
    const size_t requestedOffset = static_cast<size_t>(strtoul(offsetText.c_str(), nullptr, 10));
    const String encoded = line.substring(offsetEnd + 1);
    if (!isAllowedBleFilePath(path) || encoded.isEmpty()
        || gBleFileHandle == 0 || path != gBleFilePath) {
        gBleResponse.println("[BLE-CP] fileAppend {\"ok\":false,\"error\":\"invalid path or data\"}");
        return true;
    }

    std::vector<uint8_t> decoded;
    if (!decodeBase64(encoded, decoded)) {
        gBleResponse.println("[BLE-CP] fileAppend {\"ok\":false,\"error\":\"invalid base64\"}");
        return true;
    }

    const bool inBounds = requestedOffset == gBleFileWrittenBytes
        && gBleFileWrittenBytes + decoded.size() <= gBleFileExpectedBytes;
    const bool written = inBounds
        && federatedFS.writeBytes(gBleFileHandle, decoded.data(), decoded.size()) == decoded.size();
    if (written) {
        gBleFileWrittenBytes += decoded.size();
        if (gBleFileWrittenBytes == gBleFileExpectedBytes) {
            federatedFS.closeFile(gBleFileHandle);
            gBleFileHandle = 0;
            federatedFS.sync();
        }
    }
    const size_t resultingSize = gBleFileWrittenBytes;

    gBleResponse.print("[BLE-CP] fileAppend {\"ok\":");
    gBleResponse.print(written ? "true" : "false");
    gBleResponse.print(",\"bytes\":");
    gBleResponse.print(static_cast<uint32_t>(resultingSize));
    if (!inBounds) {
        gBleResponse.print(",\"error\":\"offset mismatch or file too large\"");
    }
    gBleResponse.println("}");
    return true;
}

bool handleDisplayJpeg(const String& line) {
#if defined(ENABLE_DISPLAY)
    JsonDocument request;
    if (deserializeJson(request, line.substring(String("DISPLAY_JPEG ").length()))) {
        gBleResponse.println("[BLE-CP] DISPLAY_JPEG invalid JSON");
        return true;
    }
    const String path = request["path"] | "";
#if !defined(DISPLAY_NO_LVGL)
    displayStatusDashboardActive = false;
#endif
    const bool shown = isAllowedBleFilePath(path)
        && displayService.showJpegFile(path, LittleFS);
    gBleResponse.print("[BLE-CP] displayJpeg {\"ok\":");
    gBleResponse.print(shown ? "true" : "false");
    gBleResponse.println("}");
#else
    gBleResponse.println("[BLE-CP] DISPLAY_JPEG unavailable");
#endif
    return true;
}

bool handleDoorbellRing(const String& line) {
#if defined(ENABLE_DISPLAY)
    String path = line.substring(String("RING ").length());
    path.trim();
    File jpeg = isAllowedBleFilePath(path) && gBleFileHandle == 0
        ? federatedFS.openReadFile(path)
        : File();
    const size_t jpegBytes = jpeg ? jpeg.size() : 0;
#if !defined(DISPLAY_NO_LVGL)
    if (jpeg) displayStatusDashboardActive = false;
#endif
    const bool shown = jpeg && displayService.showJpegFile(jpeg);
    if (jpeg) jpeg.close();
    gBleResponse.print("[BLE-CP] ring {\"ok\":");
    gBleResponse.print(shown ? "true" : "false");
    gBleResponse.print(",\"bytes\":");
    gBleResponse.print(static_cast<uint32_t>(jpegBytes));
    gBleResponse.println("}");
#else
    gBleResponse.println("[BLE-CP] ring {\"ok\":false,\"error\":\"display unavailable\"}");
#endif
    return true;
}

bool handlePcodeRun(const String& line) {
    JsonDocument request;
    if (deserializeJson(request, line.substring(String("PCODE_RUN ").length()))) {
        gBleResponse.println("[BLE-CP] PCODE_RUN invalid JSON");
        return true;
    }
    const String file = request["file"] | "";
    const String programMap = request["programMap"] | "";
    if (!file.startsWith("/ble/") || !programMap.startsWith("/ble/")) {
        gBleResponse.println("[BLE-CP] PCODE_RUN requires /ble/ artifacts");
        return true;
    }
#if defined(ENABLE_PMACHINE)
    PcodeOutputStreamState outputStream;
    outputStream.streamId = gNextPcodeStreamId++;
    if (gNextPcodeStreamId == 0) {
        gNextPcodeStreamId = 1;
    }
    pm.setTextOutputHook(streamPcodeOutput, &outputStream);
    const PMachineFileExecutionResult result = executePMachineFile(
        pm,
        &federatedFS,
        file,
        programMap,
        request["inputQueue"] | "",
        request["message"] | "",
        request["max"] | 65536
    );
    pm.setTextOutputHook(nullptr);
    if (result.statusCode == 200 && !outputStream.failed) {
        if (!outputStream.begun) {
            static const uint8_t contentType[] = "text/plain;charset=utf-8";
            outputStream.begun = sendStreamFrame(
                outputStream.streamId,
                0,
                kStreamTypeBegin,
                contentType,
                sizeof(contentType) - 1
            );
        }
        flushStreamData(outputStream);
        uint8_t endPayload[8] = {};
        writeUint32LE(endPayload, static_cast<uint32_t>(outputStream.totalBytes));
        writeUint32LE(endPayload + 4, outputStream.totalCrc32);
        const bool ended = outputStream.begun && sendStreamFrame(
            outputStream.streamId,
            outputStream.sequence + 1,
            kStreamTypeEnd,
            endPayload,
            sizeof(endPayload)
        );
        JsonDocument response;
        response["ok"] = ended;
        if (!ended) {
            response["error"] = "stream acknowledgement timeout";
        }
        String body;
        serializeJson(response, body);
        gBleResponse.println(String("[BLE-CP] run ") + body);
    } else {
        sendStreamFrame(
            outputStream.streamId,
            outputStream.sequence + 1,
            kStreamTypeAbort
        );
        JsonDocument response;
        response["statusCode"] = outputStream.failed ? 502 : result.statusCode;
        response["error"] = outputStream.failed ? "stream acknowledgement timeout" : result.body;
        String body;
        serializeJson(response, body);
        gBleResponse.println(String("[BLE-CP] run ") + body);
    }
#else
    gBleResponse.println("[BLE-CP] PMachine disabled");
#endif
    return true;
}

#if defined(ENABLE_PMACHINE)
void pcodeWorker(void* parameter) {
    String* line = static_cast<String*>(parameter);
    handlePcodeRun(*line);
    delete line;
    gPcodeWorkerTask = nullptr;
    vTaskDelete(nullptr);
}

void dispatchPcodeRun(const String& line) {
    if (gPcodeWorkerTask != nullptr) {
        gBleResponse.println("[BLE-CP] PCODE_RUN busy");
        return;
    }
    String* command = new (std::nothrow) String(line);
    if (!command) {
        gBleResponse.println("[BLE-CP] PCODE_RUN unavailable");
        return;
    }
    BaseType_t created = xTaskCreatePinnedToCore(
        pcodeWorker,
        "blePcode",
        kPcodeWorkerStackBytes,
        command,
        1,
        &gPcodeWorkerTask,
        1
    );
    if (created != pdPASS) {
        created = xTaskCreate(
            pcodeWorker,
            "blePcode",
            kPcodeWorkerStackBytes,
            command,
            1,
            &gPcodeWorkerTask
        );
    }
    if (created != pdPASS) {
        gPcodeWorkerTask = nullptr;
        delete command;
        gBleResponse.println("[BLE-CP] PCODE_RUN unavailable");
    }
}
#endif
}

BluetoothControlPlane* globalBluetoothControlPlane = nullptr;

BluetoothControlPlane::BluetoothControlPlane()
    : ready_(false) {
}

bool BluetoothControlPlane::begin(const String& deviceName) {
    if (ready_) {
        return true;
    }

    String btName = deviceName;
    btName.trim();
    if (btName.isEmpty()) {
        btName = "ESP32-CP";
    }
    btName += "-ble";

    gRxQueue = xQueueCreate(8, sizeof(RxChunk));
    gRpcTransactionMutex = xSemaphoreCreateMutex();
    gRpcDone = xSemaphoreCreateBinary();
#if defined(ENABLE_PMACHINE)
    gStreamAck = xSemaphoreCreateBinary();
#endif
    if (!gRxQueue || !gRpcTransactionMutex || !gRpcDone
#if defined(ENABLE_PMACHINE)
        || !gStreamAck
#endif
    ) {
        Serial.println("[BLE-CP] failed to create transport synchronization");
        return false;
    }

    NimBLEDevice::init(btName.c_str());
    NimBLEServer* server = NimBLEDevice::createServer();
    if (!server) {
        Serial.println("[BLE-CP] failed to create GATT server");
        return false;
    }
    server->setCallbacks(&gServerCallbacks);

    NimBLEService* service = server->createService(kServiceUuid);
    gTxCharacteristic = service->createCharacteristic(
        kTxUuid,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );
    NimBLECharacteristic* rxCharacteristic = service->createCharacteristic(
        kRxUuid,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    rxCharacteristic->setCallbacks(&gRxCallbacks);
    service->start();

    NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
    advertising->addServiceUUID(kServiceUuid);
    advertising->setScanResponse(true);
    advertising->start();

    ready_ = true;
    Serial.print("[BLE-CP] GATT control plane advertising as ");
    Serial.println(btName);
    return true;
}

void BluetoothControlPlane::loop() {
    if (!ready_ || !gRxQueue) {
        return;
    }

    RxChunk chunk{};
    while (xQueueReceive(gRxQueue, &chunk, 0) == pdTRUE) {
        for (uint16_t index = 0; index < chunk.length; ++index) {
            const char value = chunk.data[index];

            if (gRpcReceivingBody) {
                if (gRpcReceivedBodyBytes < kMaxRpcResponseBytes) {
                    gRpcResponseBody += value;
                }
                ++gRpcReceivedBodyBytes;
                if (gRpcReceivedBodyBytes >= gRpcExpectedBodyBytes) {
                    gRpcReceivingBody = false;
                    if (gRpcReceivedBodyBytes <= kMaxRpcResponseBytes) {
                        xSemaphoreGive(gRpcDone);
                    } else {
                        gRpcResponseCode = -3;
                        gRpcResponseBody = "BLE RPC response too large";
                        xSemaphoreGive(gRpcDone);
                    }
                }
                continue;
            }

            if (value == '\r') {
                continue;
            }
            if (value == '\n') {
                if (lineBuffer_.startsWith("RSP ")) {
                    uint32_t responseId = 0;
                    int responseCode = -1;
                    unsigned int responseLength = 0;
                    if (sscanf(
                            lineBuffer_.c_str(),
                            "RSP %lu %d %u",
                            &responseId,
                            &responseCode,
                            &responseLength
                        ) == 3 && responseId == gRpcActiveId) {
                        gRpcResponseCode = responseCode;
                        gRpcExpectedBodyBytes = responseLength;
                        gRpcReceivedBodyBytes = 0;
                        gRpcResponseBody.clear();
                        gRpcResponseBody.reserve(min(
                            static_cast<size_t>(responseLength),
                            kMaxRpcResponseBytes
                        ));
                        gRpcReceivingBody = responseLength > 0;
                        if (!gRpcReceivingBody) {
                            xSemaphoreGive(gRpcDone);
                        }
                    }
                    lineBuffer_.clear();
                    continue;
                }
                if (lineBuffer_.startsWith("FILE_BEGIN ")) {
                    handleFileBegin(lineBuffer_);
                } else if (lineBuffer_.startsWith("FILE_APPEND ")) {
                    handleFileAppend(lineBuffer_);
                } else if (lineBuffer_.startsWith("RING ")) {
                    handleDoorbellRing(lineBuffer_);
                } else if (lineBuffer_.startsWith("DISPLAY_JPEG ")) {
                    handleDisplayJpeg(lineBuffer_);
                } else if (lineBuffer_.startsWith("FILE_PUT ")) {
                    handleFilePut(lineBuffer_);
                } else if (lineBuffer_.startsWith("PCODE_RUN ")) {
#if defined(ENABLE_PMACHINE)
                    dispatchPcodeRun(lineBuffer_);
#else
                    handlePcodeRun(lineBuffer_);
#endif
                } else {
                    controlPlaneHandleLine(lineBuffer_, gBleResponse, "BLE-CP");
                }
                lineBuffer_.clear();
                continue;
            }
            if (lineBuffer_.length() >= kMaxControlLineBytes) {
                lineBuffer_.clear();
                gBleResponse.println("[BLE-CP] command too long");
                continue;
            }
            lineBuffer_ += value;
        }
    }
}

void initializeBluetoothControlPlane(const String& deviceName) {
    if (!globalBluetoothControlPlane) {
        globalBluetoothControlPlane = new BluetoothControlPlane();
    }
    if (globalBluetoothControlPlane) {
        globalBluetoothControlPlane->begin(deviceName);
    }
}

void bluetoothControlPlaneLoop() {
    if (globalBluetoothControlPlane) {
        globalBluetoothControlPlane->loop();
    }
}

bool bluetoothControlPlaneClientConnected() {
    return gClientConnected;
}

int bluetoothControlPlaneHttpPost(
    const String& url,
    const String& body,
    String& responseBody,
    uint16_t timeoutMs
) {
    if (!gClientConnected || !gTxCharacteristic || !gRpcTransactionMutex || !gRpcDone) {
        return -2;
    }
    if (xSemaphoreTake(gRpcTransactionMutex, pdMS_TO_TICKS(timeoutMs)) != pdTRUE) {
        return -2;
    }

    while (xSemaphoreTake(gRpcDone, 0) == pdTRUE) {
    }
    const uint32_t requestId = gRpcNextId++;
    gRpcActiveId = requestId;
    gRpcResponseCode = -1;
    gRpcResponseBody.clear();
    gRpcReceivingBody = false;

    String header = "REQ " + String(requestId) + " POST "
        + String(url.length()) + " " + String(body.length()) + "\n";
    notifyBytes(reinterpret_cast<const uint8_t*>(header.c_str()), header.length());
    notifyBytes(reinterpret_cast<const uint8_t*>(url.c_str()), url.length());
    notifyBytes(reinterpret_cast<const uint8_t*>(body.c_str()), body.length());

    const bool completed = xSemaphoreTake(gRpcDone, pdMS_TO_TICKS(timeoutMs)) == pdTRUE;
    const int responseCode = completed ? gRpcResponseCode : -2;
    responseBody = completed ? gRpcResponseBody : "BLE RPC timed out";
    gRpcActiveId = 0;
    gRpcReceivingBody = false;
    xSemaphoreGive(gRpcTransactionMutex);
    return responseCode;
}

#endif
