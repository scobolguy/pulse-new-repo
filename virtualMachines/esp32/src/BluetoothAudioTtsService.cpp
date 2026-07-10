#if defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)

#include "BluetoothAudioTtsService.h"

#include <ArduinoJson.h>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <esp_bt.h>
#include <esp_bt_device.h>
#include <esp_bt_main.h>
#include <esp_avrc_api.h>
#include <esp_err.h>
#include "BluetoothService.h"

BluetoothAudioTtsService* globalBluetoothAudioTtsService = nullptr;

#if defined(DISABLE_CLASSIC_AUDIO_TTS)
static constexpr bool kClassicAudioEnabled = false;
#else
static constexpr bool kClassicAudioEnabled = true;
#endif

#if defined(DISABLE_BLE_AUDIO_TTS)
static constexpr bool kBleAudioEnabled = false;
#else
static constexpr bool kBleAudioEnabled = true;
#endif

namespace {

constexpr uint32_t kAudioSampleRate = 44100;
constexpr float kTwoPi = 6.28318530718f;
constexpr float kSpeechHeadroom = 0.78f;
constexpr float kSpeechSoftLimit = 28000.0f;
constexpr uint32_t kMediaStartRetryMs = 700;
constexpr uint32_t kMediaStartCooldownMs = 1200;
constexpr uint32_t kMediaStartMaxRetries = 12;
constexpr uint32_t kMediaNoDataRestartMs = 2500;

struct SpeechCharParams {
    float f0;
    float f1;
    float f2;
    float voicedMix;
    float noiseMix;
    uint16_t durationMs;
};

char toLowerAscii(char c) {
    return (c >= 'A' && c <= 'Z') ? static_cast<char>(c - 'A' + 'a') : c;
}

SpeechCharParams speechParamsForChar(char raw) {
    const char c = toLowerAscii(raw);
    switch (c) {
        case 'a': return {172.0f, 680.0f, 1200.0f, 1.0f, 0.0f, 130};
        case 'e': return {186.0f, 520.0f, 1700.0f, 1.0f, 0.0f, 120};
        case 'i': return {198.0f, 420.0f, 2050.0f, 1.0f, 0.0f, 115};
        case 'o': return {165.0f, 560.0f, 1000.0f, 1.0f, 0.0f, 130};
        case 'u': return {155.0f, 470.0f, 920.0f, 1.0f, 0.0f, 125};
        case ' ': return {0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 90};
        case '.':
        case ',':
        case '!':
        case '?': return {0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 140};
        case 's':
        case 'f':
        case 'h':
        case 'x': return {0.0f, 0.0f, 0.0f, 0.0f, 0.6f, 75};
        case 't':
        case 'k':
        case 'p': return {0.0f, 0.0f, 0.0f, 0.0f, 0.45f, 55};
        case 'r':
        case 'l':
        case 'm':
        case 'n': return {172.0f, 560.0f, 1380.0f, 1.0f, 0.0f, 100};
        default: return {176.0f, 620.0f, 1450.0f, 1.0f, 0.03f, 95};
    }
}

float phaseIncrement(float hz) {
    return (kTwoPi * hz) / static_cast<float>(kAudioSampleRate);
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

void sendJson(AsyncWebServerRequest* request, JsonDocument& doc, int code = 200) {
    String body;
    serializeJson(doc, body);
    request->send(code, "application/json", body);
}

String toBleType(BLEDeviceType type) {
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

String formatBdAddr(const uint8_t addr[6]) {
    char buf[18];
    snprintf(buf, sizeof(buf), "%02X:%02X:%02X:%02X:%02X:%02X",
             addr[0], addr[1], addr[2], addr[3], addr[4], addr[5]);
    return String(buf);
}

String normalizeClassicAddress(const String& address) {
    String s = address;
    s.trim();
    s.toUpperCase();
    if (s.startsWith("CLASSIC://")) {
        s = s.substring(10);
    }
    return s;
}

bool parseClassicMacAddress(const String& address, uint8_t out[6]) {
    String mac = normalizeClassicAddress(address);
    int values[6] = {0};
    if (sscanf(mac.c_str(), "%x:%x:%x:%x:%x:%x", &values[0], &values[1], &values[2], &values[3], &values[4], &values[5]) != 6) {
        return false;
    }
    for (int i = 0; i < 6; ++i) {
        out[i] = static_cast<uint8_t>(values[i] & 0xFF);
    }
    return true;
}

const char* hciDisconnectReasonName(uint8_t reason) {
    switch (reason) {
        case 0x08: return "connection-timeout";
        case 0x13: return "remote-user-terminated";
        case 0x14: return "remote-low-resources";
        case 0x15: return "remote-power-off";
        case 0x16: return "local-host-terminated";
        case 0x3B: return "unacceptable-connection-params";
        case 0x3E: return "connection-failed-establish";
        default: return "unknown";
    }
}

const char* gapEventName(esp_bt_gap_cb_event_t event) {
    switch (event) {
        case ESP_BT_GAP_DISC_RES_EVT: return "DISC_RES";
        case ESP_BT_GAP_DISC_STATE_CHANGED_EVT: return "DISC_STATE_CHANGED";
        case ESP_BT_GAP_RMT_SRVCS_EVT: return "RMT_SRVCS";
        case ESP_BT_GAP_RMT_SRVC_REC_EVT: return "RMT_SRVC_REC";
        case ESP_BT_GAP_READ_REMOTE_NAME_EVT: return "READ_REMOTE_NAME";
        case ESP_BT_GAP_AUTH_CMPL_EVT: return "AUTH_CMPL";
        case ESP_BT_GAP_PIN_REQ_EVT: return "PIN_REQ";
        case ESP_BT_GAP_CFM_REQ_EVT: return "CFM_REQ";
        case ESP_BT_GAP_KEY_NOTIF_EVT: return "KEY_NOTIF";
        case ESP_BT_GAP_KEY_REQ_EVT: return "KEY_REQ";
        case ESP_BT_GAP_MODE_CHG_EVT: return "MODE_CHG";
        case ESP_BT_GAP_ACL_CONN_CMPL_STAT_EVT: return "ACL_CONN_CMPL";
        case ESP_BT_GAP_ACL_DISCONN_CMPL_STAT_EVT: return "ACL_DISCONN_CMPL";
        case ESP_BT_GAP_CONFIG_EIR_DATA_EVT: return "CONFIG_EIR_DATA";
        default: return "GAP_UNKNOWN";
    }
}

const char* a2dpEventName(esp_a2d_cb_event_t event) {
    switch (event) {
        case ESP_A2D_CONNECTION_STATE_EVT: return "CONNECTION_STATE";
        case ESP_A2D_AUDIO_STATE_EVT: return "AUDIO_STATE";
        case ESP_A2D_AUDIO_CFG_EVT: return "AUDIO_CFG";
        case ESP_A2D_MEDIA_CTRL_ACK_EVT: return "MEDIA_CTRL_ACK";
        case ESP_A2D_PROF_STATE_EVT: return "PROF_STATE";
        default: return "A2DP_UNKNOWN";
    }
}

bool isAudioCod(uint32_t cod) {
    const uint32_t major = esp_bt_gap_get_cod_major_dev(cod);
    if (major == ESP_BT_COD_MAJOR_DEV_AV) {
        return true;
    }

    const uint32_t services = esp_bt_gap_get_cod_srvc(cod);
    return (services & (ESP_BT_COD_SRVC_AUDIO | ESP_BT_COD_SRVC_RENDERING)) != 0;
}

std::vector<String> getClassicBondedAddresses() {
    std::vector<String> out;
    int count = esp_bt_gap_get_bond_device_num();
    if (count <= 0) {
        return out;
    }

    std::vector<esp_bd_addr_t> bonded(static_cast<size_t>(count));
    int fetched = count;
    if (esp_bt_gap_get_bond_device_list(&fetched, bonded.data()) != ESP_OK || fetched <= 0) {
        return out;
    }

    out.reserve(static_cast<size_t>(fetched));
    for (int i = 0; i < fetched; ++i) {
        out.push_back(formatBdAddr(bonded[static_cast<size_t>(i)]));
    }
    return out;
}

class StateLock {
public:
    explicit StateLock(SemaphoreHandle_t mutex) : mutex_(mutex) {
        if (mutex_) {
            xSemaphoreTake(mutex_, portMAX_DELAY);
        }
    }

    ~StateLock() {
        if (mutex_) {
            xSemaphoreGive(mutex_);
        }
    }

private:
    SemaphoreHandle_t mutex_;
};

} // namespace

BluetoothAudioTtsService::BluetoothAudioTtsService() {
    stateMutex_ = xSemaphoreCreateMutex();
}

String BluetoothAudioTtsService::selectedAddress() const {
    StateLock lock(stateMutex_);
    return selectedTargetAddress_;
}

String BluetoothAudioTtsService::selectedName() const {
    StateLock lock(stateMutex_);
    return selectedTargetName_;
}

bool BluetoothAudioTtsService::hasSelectedTarget() const {
    StateLock lock(stateMutex_);
    return selectedTargetAddress_.length() > 0;
}

String BluetoothAudioTtsService::lastMp3Source() const {
    StateLock lock(stateMutex_);
    return lastMp3Source_;
}

bool BluetoothAudioTtsService::lastMp3WasUrl() const {
    StateLock lock(stateMutex_);
    return lastMp3WasUrl_;
}

String BluetoothAudioTtsService::lastTtsText() const {
    StateLock lock(stateMutex_);
    return lastTtsText_;
}

String BluetoothAudioTtsService::lastTtsVoice() const {
    StateLock lock(stateMutex_);
    return lastTtsVoice_;
}

String BluetoothAudioTtsService::lastError() const {
    StateLock lock(stateMutex_);
    return lastError_;
}

unsigned long BluetoothAudioTtsService::lastCommandAt() const {
    StateLock lock(stateMutex_);
    return lastCommandAt_;
}

String BluetoothAudioTtsService::selectedTransport() const {
    StateLock lock(stateMutex_);
    return selectedTransport_;
}

bool BluetoothAudioTtsService::classicReady() const {
    StateLock lock(stateMutex_);
    return classicReady_;
}

bool BluetoothAudioTtsService::classicConnected() const {
    StateLock lock(stateMutex_);
    return classicConnected_;
}

bool BluetoothAudioTtsService::classicDiscovering() const {
    StateLock lock(stateMutex_);
    return classicDiscovering_;
}

void BluetoothAudioTtsService::pushDebugLog(const String& line) {
    StateLock lock(stateMutex_);
    String entry = String(millis()) + "ms " + line;
    debugLog_.push_back(entry);
    if (debugLog_.size() > 80) {
        debugLog_.pop_front();
    }
}

void BluetoothAudioTtsService::logDebug(const String& line) {
    pushDebugLog(line);
}

void BluetoothAudioTtsService::appendDebugSnapshot(JsonObject obj) const {
    StateLock lock(stateMutex_);
    obj["btControllerStatus"] = static_cast<int>(esp_bt_controller_get_status());
    obj["bluedroidStatus"] = static_cast<int>(esp_bluedroid_get_status());
    obj["classicReady"] = classicReady_;
    obj["classicConnected"] = classicConnected_;
    obj["classicDiscovering"] = classicDiscovering_;
    obj["selectedAddress"] = selectedTargetAddress_;
    obj["selectedTransport"] = selectedTransport_;
    obj["classicConnectedAddress"] = classicConnectedAddress_;
    obj["classicConnectedName"] = classicConnectedName_;
    obj["classicTargetsCount"] = static_cast<uint32_t>(classicTargets_.size());
    obj["playbackQueueCount"] = static_cast<uint32_t>(playbackQueue_.size());
    obj["lastError"] = lastError_;

    auto counters = obj["counters"].to<JsonObject>();
    counters["gapEvents"] = debugGapEvents_;
    counters["a2dpEvents"] = debugA2dpEvents_;
    counters["avrcEvents"] = debugAvrcEvents_;
    counters["discoveryStarts"] = debugDiscoveryStarts_;
    counters["discoveryCancels"] = debugDiscoveryCancels_;
    counters["connectRequests"] = debugConnectRequests_;
    counters["connectFailures"] = debugConnectFailures_;
    counters["aclConnectEvents"] = debugAclConnectEvents_;
    counters["aclDisconnectEvents"] = debugAclDisconnectEvents_;
    counters["a2dpDataCallbacks"] = debugA2dpDataCallbacks_;
    counters["a2dpDataBytes"] = debugA2dpDataBytes_;
    counters["audioStateEvents"] = debugAudioStateEvents_;
    counters["mediaStartRequests"] = debugMediaStartRequests_;
    counters["mediaStartFailures"] = debugMediaStartFailures_;
    counters["mediaStartAckOk"] = debugMediaStartAckOk_;
    counters["mediaStartAckFail"] = debugMediaStartAckFail_;
    counters["forcedMediaStartRequests"] = debugForcedMediaStartRequests_;

    auto last = obj["last"].to<JsonObject>();
    last["connectAddress"] = debugLastConnectAddress_;
    last["connectResult"] = debugLastConnectResult_;
    last["gapEvent"] = debugLastGapEvent_;
    last["a2dpEvent"] = debugLastA2dpEvent_;
    last["avrcEvent"] = debugLastAvrcEvent_;
    last["audioState"] = debugLastAudioState_;
    last["mediaCtrlCmd"] = debugLastMediaCtrlCmd_;
    last["mediaCtrlStatus"] = debugLastMediaCtrlStatus_;
    last["aclDisconnectRawReason"] = debugLastAclDisconnectRawReason_;
    last["aclDisconnectHciReason"] = debugLastAclDisconnectHciReason_;

    auto media = obj["media"].to<JsonObject>();
    media["streamStartPending"] = streamStartPending_;
    media["streamStartRetries"] = streamStartRetries_;
    media["nextMediaStartRetryAtMs"] = static_cast<uint32_t>(nextMediaStartRetryAtMs_);
    media["lastMediaStartRequestAtMs"] = static_cast<uint32_t>(lastMediaStartRequestAtMs_);
    media["lastA2dpDataCallbackAtMs"] = static_cast<uint32_t>(lastA2dpDataCallbackAtMs_);

    auto log = obj["log"].to<JsonArray>();
    for (const auto& line : debugLog_) {
        log.add(line);
    }
}

size_t BluetoothAudioTtsService::queuedPlaybackItems() const {
    StateLock lock(stateMutex_);
    return playbackQueue_.size();
}

bool BluetoothAudioTtsService::begin() {
    if (kBleAudioEnabled && !globalBluetoothService) {
        lastError_ = "BluetoothService not initialized";
        return false;
    }
    if (kClassicAudioEnabled) {
        beginClassicStack();
    }
    lastError_ = "";
    return true;
}

void BluetoothAudioTtsService::loop() {
    if (!kClassicAudioEnabled) {
        return;
    }

    bool shouldCancel = false;
    bool shouldStart = false;
    bool shouldStop = false;
    uint32_t plannedRetry = 0;
    uint32_t pendingRetries = 0;
    const unsigned long nowMs = millis();
    {
        StateLock lock(stateMutex_);
        shouldCancel = classicDiscovering_ && millis() > classicDiscoveryUntilMs_;
        if (shouldCancel) {
            classicDiscovering_ = false;
        }

        if (classicConnected_ && !playbackQueue_.empty()) {
            const bool retryDue = streamStartPending_ && nowMs >= nextMediaStartRetryAtMs_;
            const bool canKick = !streamStartPending_ &&
                                 (nowMs - lastMediaStartRequestAtMs_) >= kMediaStartCooldownMs;
            if (retryDue || canKick) {
                const bool staleNoData =
                    (lastA2dpDataCallbackAtMs_ == 0) || ((nowMs - lastA2dpDataCallbackAtMs_) >= kMediaNoDataRestartMs);
                if (staleNoData && streamStartRetries_ > 0 && (streamStartRetries_ % 4U) == 0U) {
                    shouldStop = true;
                    plannedRetry = streamStartRetries_ + 1;
                    streamStartPending_ = true;
                    streamStartRetries_ = plannedRetry;
                    nextMediaStartRetryAtMs_ = nowMs + 120;
                } else if (streamStartRetries_ < kMediaStartMaxRetries) {
                    shouldStart = true;
                    plannedRetry = streamStartRetries_ + 1;
                    streamStartPending_ = true;
                    streamStartRetries_ = plannedRetry;
                    nextMediaStartRetryAtMs_ = nowMs + kMediaStartRetryMs;
                    lastMediaStartRequestAtMs_ = nowMs;
                    debugMediaStartRequests_++;
                }
            }
            pendingRetries = streamStartRetries_;
        } else if (playbackQueue_.empty()) {
            streamStartPending_ = false;
            streamStartRetries_ = 0;
            nextMediaStartRetryAtMs_ = 0;
            if (classicConnected_ && streamStopPending_ && (nowMs - lastMediaStopRequestAtMs_) >= 1000UL) {
                shouldStop = true;
                lastMediaStopRequestAtMs_ = nowMs;
            }
        }
    }

    if (shouldCancel) {
        esp_bt_gap_cancel_discovery();
        Serial.println("[BLUETOOTH-AUDIO] classic discovery timeout -> cancel requested");
    }

    if (shouldStop) {
        const esp_err_t stopErr = esp_a2d_media_ctrl(ESP_A2D_MEDIA_CTRL_STOP);
        if (stopErr != ESP_OK) {
            pushDebugLog(String("loop media stop failed: ") + esp_err_to_name(stopErr));
        } else {
            {
                StateLock lock(stateMutex_);
                streamStopPending_ = false;
            }
            pushDebugLog(String("loop media stop requested retry=") + String(plannedRetry));
        }
    }

    if (shouldStart) {
        const esp_err_t startErr = esp_a2d_media_ctrl(ESP_A2D_MEDIA_CTRL_START);
        if (startErr != ESP_OK) {
            {
                StateLock lock(stateMutex_);
                debugMediaStartFailures_++;
            }
            pushDebugLog(String("loop media start failed: ") + esp_err_to_name(startErr) +
                         " retry=" + String(plannedRetry));
        } else {
            pushDebugLog(String("loop media start requested retry=") + String(plannedRetry) +
                         " pending=" + String(pendingRetries));
        }
    }
}

void BluetoothAudioTtsService::armClassicMediaStartRetryLocked(uint32_t nowMs, uint32_t delayMs) {
    streamStartPending_ = true;
    if (streamStartRetries_ == 0) {
        streamStartRetries_ = 1;
    }
    nextMediaStartRetryAtMs_ = nowMs + delayMs;
}

bool BluetoothAudioTtsService::requestClassicMediaStart(const String& reason, bool allowStopFirst) {
    bool connected = false;
    bool hasQueue = false;
    uint32_t plannedRetry = 0;
    bool deferredNotConnected = false;
    bool ignoredEmptyQueue = false;
    const unsigned long nowMs = millis();

    {
        StateLock lock(stateMutex_);
        connected = classicConnected_;
        hasQueue = !playbackQueue_.empty();
        if (!connected) {
            armClassicMediaStartRetryLocked(nowMs, kMediaStartRetryMs);
            deferredNotConnected = true;
        } else if (!hasQueue) {
            ignoredEmptyQueue = true;
        } else {
            streamStartPending_ = true;
            streamStartRetries_++;
            plannedRetry = streamStartRetries_;
            nextMediaStartRetryAtMs_ = nowMs + kMediaStartRetryMs;
            lastMediaStartRequestAtMs_ = nowMs;
            debugMediaStartRequests_++;
        }
    }

    if (deferredNotConnected) {
        pushDebugLog(String("requestClassicMediaStart deferred(not connected): ") + reason);
        return false;
    }
    if (ignoredEmptyQueue) {
        pushDebugLog(String("requestClassicMediaStart ignored(empty queue): ") + reason);
        return false;
    }

    if (allowStopFirst) {
        const esp_err_t stopErr = esp_a2d_media_ctrl(ESP_A2D_MEDIA_CTRL_STOP);
        if (stopErr != ESP_OK) {
            pushDebugLog(String("requestClassicMediaStart stop failed: ") + esp_err_to_name(stopErr));
        } else {
            pushDebugLog(String("requestClassicMediaStart stop requested: ") + reason);
        }
    }

    const esp_err_t mediaErr = esp_a2d_media_ctrl(ESP_A2D_MEDIA_CTRL_START);
    if (mediaErr != ESP_OK) {
        {
            StateLock lock(stateMutex_);
            debugMediaStartFailures_++;
        }
        pushDebugLog(String("requestClassicMediaStart start failed: ") + esp_err_to_name(mediaErr) +
                     " reason=" + reason + " retry=" + String(plannedRetry));
        return false;
    }

    pushDebugLog(String("requestClassicMediaStart start requested: ") + reason +
                 " retry=" + String(plannedRetry));
    return true;
}

bool BluetoothAudioTtsService::forceClassicMediaStart(String& errorOut) {
    if (!kClassicAudioEnabled) {
        errorOut = "classic audio disabled in this build";
        return false;
    }

    {
        StateLock lock(stateMutex_);
        if (!classicConnected_) {
            errorOut = "classic target not connected";
            return false;
        }
        debugForcedMediaStartRequests_++;
    }

    const bool ok = requestClassicMediaStart("force endpoint", true);
    if (!ok) {
        errorOut = "media start request failed";
        return false;
    }
    return true;
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

bool BluetoothAudioTtsService::isLikelyAlexaTargetName(const String& name) const {
    String n = name;
    n.toLowerCase();
    return n.indexOf("alexa") >= 0 || n.indexOf("echo") >= 0 || n.indexOf("amazon") >= 0;
}

bool BluetoothAudioTtsService::beginClassicStack() {
    if (classicReady_) {
        pushDebugLog("beginClassicStack: already ready");
        return true;
    }

    pushDebugLog(String("beginClassicStack: bluedroid status=") + String(static_cast<int>(esp_bluedroid_get_status())));

    if (esp_bluedroid_get_status() != ESP_BLUEDROID_STATUS_ENABLED) {
        if (!btStart()) {
            lastError_ = "classic bt start failed";
            pushDebugLog("beginClassicStack: btStart failed");
            return false;
        }
        if (esp_bluedroid_get_status() == ESP_BLUEDROID_STATUS_UNINITIALIZED) {
            if (esp_bluedroid_init() != ESP_OK) {
                lastError_ = "bluedroid init failed";
                pushDebugLog("beginClassicStack: bluedroid init failed");
                return false;
            }
            pushDebugLog("beginClassicStack: bluedroid init ok");
        }
        if (esp_bluedroid_get_status() != ESP_BLUEDROID_STATUS_ENABLED) {
            if (esp_bluedroid_enable() != ESP_OK) {
                lastError_ = "bluedroid enable failed";
                pushDebugLog("beginClassicStack: bluedroid enable failed");
                return false;
            }
            pushDebugLog("beginClassicStack: bluedroid enable ok");
        }
    }

    esp_bt_pin_code_t pinCode;
    pinCode[0] = '0'; pinCode[1] = '0'; pinCode[2] = '0'; pinCode[3] = '0';
    esp_bt_gap_set_pin(ESP_BT_PIN_TYPE_VARIABLE, 4, pinCode);

    if (esp_bt_gap_register_callback(&BluetoothAudioTtsService::onClassicGapEvent) != ESP_OK) {
        lastError_ = "gap callback register failed";
        pushDebugLog("beginClassicStack: GAP callback register failed");
        return false;
    }

    if (esp_a2d_register_callback(&BluetoothAudioTtsService::onClassicA2dpEvent) != ESP_OK) {
        lastError_ = "a2dp callback register failed";
        pushDebugLog("beginClassicStack: A2DP callback register failed");
        return false;
    }
    if (esp_a2d_source_register_data_callback(&BluetoothAudioTtsService::onClassicA2dpData) != ESP_OK) {
        lastError_ = "a2dp data callback register failed";
        pushDebugLog("beginClassicStack: A2DP data callback register failed");
        return false;
    }
    if (esp_a2d_source_init() != ESP_OK) {
        lastError_ = "a2dp source init failed";
        pushDebugLog("beginClassicStack: A2DP source init failed");
        return false;
    }
    pushDebugLog("beginClassicStack: A2DP source init ok");

    if (esp_avrc_ct_register_callback(&BluetoothAudioTtsService::onClassicAvrcEvent) != ESP_OK) {
        lastError_ = "avrc callback register failed";
        pushDebugLog("beginClassicStack: AVRCP callback register failed");
        return false;
    }
    if (esp_avrc_ct_init() != ESP_OK) {
        lastError_ = "avrc init failed";
        pushDebugLog("beginClassicStack: AVRCP init failed");
        return false;
    }
    pushDebugLog("beginClassicStack: AVRCP init ok");

    const esp_err_t scanModeErr = esp_bt_gap_set_scan_mode(ESP_BT_CONNECTABLE, ESP_BT_GENERAL_DISCOVERABLE);
    if (scanModeErr != ESP_OK) {
        pushDebugLog(String("beginClassicStack: set scan mode failed: ") + esp_err_to_name(scanModeErr));
    } else {
        pushDebugLog("beginClassicStack: set scan mode ok");
    }
    classicReady_ = true;
    pushDebugLog("beginClassicStack: ready");
    return true;
}

bool BluetoothAudioTtsService::startClassicDiscovery(int durationSeconds) {
    if (!beginClassicStack()) {
        return false;
    }

    bool wasDiscovering = false;
    {
        StateLock lock(stateMutex_);
        wasDiscovering = classicDiscovering_;
        if (wasDiscovering) {
            classicDiscovering_ = false;
        }

        const unsigned long nowMs = millis();
        classicTargets_.erase(std::remove_if(classicTargets_.begin(), classicTargets_.end(),
            [nowMs](const ClassicBluetoothAudioTarget& t) {
                return !t.connected && (nowMs - t.lastSeen) > 120000UL;
            }),
            classicTargets_.end());
    }

    if (wasDiscovering) {
        esp_bt_gap_cancel_discovery();
        Serial.println("[BLUETOOTH-AUDIO] classic discovery restarted");
        {
            StateLock lock(stateMutex_);
            debugDiscoveryCancels_++;
        }
        pushDebugLog("startClassicDiscovery: canceled previous discovery");
    }

    const int inqLen = durationSeconds < 3 ? 3 : (durationSeconds > 20 ? 20 : durationSeconds);
    const esp_err_t err = esp_bt_gap_start_discovery(ESP_BT_INQ_MODE_GENERAL_INQUIRY, static_cast<uint8_t>(inqLen), 0);
    if (err != ESP_OK) {
        lastError_ = String("classic discovery start failed: ") + esp_err_to_name(err);
        Serial.printf("[BLUETOOTH-AUDIO] classic discovery failed (%s)\n", esp_err_to_name(err));
        pushDebugLog(String("startClassicDiscovery failed: ") + esp_err_to_name(err));
        return false;
    }

    size_t targetCount = 0;
    {
        StateLock lock(stateMutex_);
        classicDiscovering_ = true;
        classicDiscoveryUntilMs_ = millis() + (static_cast<unsigned long>(inqLen) * 1000UL);
        targetCount = classicTargets_.size();
        debugDiscoveryStarts_++;
    }

    pushDebugLog(String("startClassicDiscovery ok: duration=") + String(inqLen) + " targets=" + String(static_cast<unsigned>(targetCount)));

    Serial.printf("[BLUETOOTH-AUDIO] classic discovery started duration=%ds existingTargets=%u\n",
                  inqLen,
                  static_cast<unsigned>(targetCount));
    return true;
}

bool BluetoothAudioTtsService::startDiscovery(int durationSeconds) {
    if (kBleAudioEnabled && !globalBluetoothService) {
        lastError_ = "BluetoothService unavailable";
        return false;
    }

    const int clampedDuration = durationSeconds < 3 ? 3 : (durationSeconds > 20 ? 20 : durationSeconds);
    bool bleStarted = false;
    bool classicStarted = false;
    if (kBleAudioEnabled && globalBluetoothService) {
        bleStarted = globalBluetoothService->startScan(clampedDuration);
    }
    if (kClassicAudioEnabled) {
        classicStarted = startClassicDiscovery(clampedDuration);
    }
    if (!bleStarted && !classicStarted) {
        if (lastError_.length() == 0) {
            lastError_ = "discovery unavailable";
        }
        return false;
    }
    lastError_ = "";
    lastCommandAt_ = millis();
    return true;
}

std::vector<BluetoothAudioTarget> BluetoothAudioTtsService::listTargets() const {
    std::vector<BluetoothAudioTarget> out;
    if (kBleAudioEnabled && globalBluetoothService) {
        const auto devices = globalBluetoothService->getAllDevices();
        for (const auto& device : devices) {
            const String type = toBleType(device.type);

            BluetoothAudioTarget target;
            target.address = device.address;
            target.name = device.name;
            target.type = type;
            target.transport = "ble";
            target.rssi = device.rssi;
            target.connected = device.connected;
            out.push_back(target);
        }
    }

    if (kClassicAudioEnabled) {
        StateLock lock(stateMutex_);
        for (const auto& classic : classicTargets_) {
            BluetoothAudioTarget target;
            target.address = classic.address;
            target.name = classic.name.length() ? classic.name : "Classic Device";
            if (isLikelyAlexaTargetName(classic.name)) {
                target.type = "alexa";
            } else if (classic.audioCandidate || isAudioTargetName(classic.name)) {
                target.type = "speaker";
            } else {
                target.type = "other";
            }
            target.transport = "classic";
            target.rssi = classic.rssi;
            target.connected = classic.connected;
            out.push_back(target);
        }
    }

    return out;
}

std::vector<ClassicBluetoothAudioTarget> BluetoothAudioTtsService::listClassicTargets() const {
    StateLock lock(stateMutex_);
    return classicTargets_;
}

void BluetoothAudioTtsService::upsertClassicTarget(const ClassicBluetoothAudioTarget& target) {
    StateLock lock(stateMutex_);
    for (auto& existing : classicTargets_) {
        if (normalizeAddress(existing.address) == normalizeAddress(target.address)) {
            existing.name = target.name.length() ? target.name : existing.name;
            existing.rssi = target.rssi;
            existing.audioCandidate = target.audioCandidate || existing.audioCandidate;
            existing.connected = target.connected;
            existing.lastSeen = millis();
            return;
        }
    }
    ClassicBluetoothAudioTarget copy = target;
    copy.lastSeen = millis();
    classicTargets_.push_back(copy);
}

String BluetoothAudioTtsService::normalizeAddress(const String& address) const {
    String s = address;
    s.trim();
    s.toUpperCase();
    if (s.startsWith("CLASSIC://")) {
        s = s.substring(10);
    }
    return s;
}

bool BluetoothAudioTtsService::parseMacAddress(const String& address, uint8_t out[6]) const {
    String mac = normalizeAddress(address);
    int values[6] = {0};
    if (sscanf(mac.c_str(), "%x:%x:%x:%x:%x:%x", &values[0], &values[1], &values[2], &values[3], &values[4], &values[5]) != 6) {
        return false;
    }
    for (int i = 0; i < 6; ++i) {
        out[i] = static_cast<uint8_t>(values[i] & 0xFF);
    }
    return true;
}

bool BluetoothAudioTtsService::connectClassicTarget(const String& address, String& errorOut) {
    if (!kClassicAudioEnabled) {
        errorOut = "classic audio disabled in this build";
        return false;
    }
    if (!beginClassicStack()) {
        errorOut = lastError_.length() ? lastError_ : "classic stack unavailable";
        return false;
    }

    {
        StateLock lock(stateMutex_);
        debugConnectRequests_++;
        debugLastConnectAddress_ = normalizeAddress(address);
    }

    uint8_t bda[6];
    if (!parseMacAddress(address, bda)) {
        errorOut = "invalid classic bluetooth address";
        {
            StateLock lock(stateMutex_);
            debugConnectFailures_++;
            debugLastConnectResult_ = "invalid address";
        }
        return false;
    }

    bool isBonded = false;
    for (const auto& bonded : getClassicBondedAddresses()) {
        if (normalizeAddress(bonded) == normalizeAddress(address)) {
            isBonded = true;
            break;
        }
    }
    pushDebugLog(String("connectClassicTarget: target bonded=") + (isBonded ? "true" : "false"));

    bool wasDiscovering = false;
    {
        StateLock lock(stateMutex_);
        wasDiscovering = classicDiscovering_;
        if (wasDiscovering) {
            classicDiscovering_ = false;
        }
    }

    if (wasDiscovering) {
        const esp_err_t cancelResult = esp_bt_gap_cancel_discovery();
        if (cancelResult == ESP_OK || cancelResult == ESP_ERR_INVALID_STATE) {
            Serial.println("[BLUETOOTH-AUDIO] classic connect requested while discovering -> discovery cancel requested");
        } else {
            Serial.printf("[BLUETOOTH-AUDIO] classic connect discovery cancel failed (%s)\n", esp_err_to_name(cancelResult));
        }
        {
            StateLock lock(stateMutex_);
            debugDiscoveryCancels_++;
        }
    }

    const esp_err_t connectResult = esp_a2d_source_connect(bda);
    if (connectResult != ESP_OK) {
        errorOut = String("classic a2dp connect failed: ") + esp_err_to_name(connectResult);
        Serial.printf("[BLUETOOTH-AUDIO] classic connect failed for %s (%s)\n", normalizeAddress(address).c_str(), esp_err_to_name(connectResult));
        {
            StateLock lock(stateMutex_);
            debugConnectFailures_++;
            debugLastConnectResult_ = String("connect failed: ") + esp_err_to_name(connectResult);
        }
        pushDebugLog(String("connectClassicTarget failed: ") + esp_err_to_name(connectResult));
        return false;
    }

    Serial.printf("[BLUETOOTH-AUDIO] classic connect requested for %s\n", normalizeAddress(address).c_str());

    {
        StateLock lock(stateMutex_);
        selectedTargetAddress_ = normalizeAddress(address);
        selectedTransport_ = "classic";
        lastError_ = "";
        debugLastConnectResult_ = "connect requested";
    }
    pushDebugLog(String("connectClassicTarget requested: ") + normalizeAddress(address));
    return true;
}

bool BluetoothAudioTtsService::disconnectClassicTarget(String& errorOut) {
    if (!kClassicAudioEnabled) {
        errorOut = "classic audio disabled in this build";
        return false;
    }
    uint8_t bda[6];
    String selectedAddress;
    {
        StateLock lock(stateMutex_);
        selectedAddress = selectedTargetAddress_;
    }
    if (!parseMacAddress(selectedAddress, bda)) {
        errorOut = "invalid selected classic address";
        pushDebugLog("disconnectClassicTarget: invalid selected address");
        return false;
    }
    pushDebugLog(String("disconnectClassicTarget: requesting disconnect for ") + normalizeAddress(selectedAddress));
    if (esp_a2d_source_disconnect(bda) != ESP_OK) {
        errorOut = "classic a2dp disconnect failed";
        pushDebugLog("disconnectClassicTarget: esp_a2d_source_disconnect failed");
        return false;
    }
    pushDebugLog("disconnectClassicTarget: disconnect requested");
    return true;
}

bool BluetoothAudioTtsService::connectTarget(const String& address, String& errorOut) {
    if (kBleAudioEnabled && !globalBluetoothService) {
        errorOut = "BluetoothService unavailable";
        lastError_ = errorOut;
        return false;
    }
    if (address.length() == 0) {
        errorOut = "address is required";
        lastError_ = errorOut;
        return false;
    }

    String requestedAddress = address;
    String lowered = requestedAddress;
    lowered.toLowerCase();
    const bool forceClassic = kClassicAudioEnabled && lowered.startsWith("classic://");

    const String normalized = normalizeAddress(requestedAddress);
    const bool classicOnlyBuild = kClassicAudioEnabled && !kBleAudioEnabled;
    bool prefersClassic = classicOnlyBuild;
    if (kClassicAudioEnabled) {
        StateLock lock(stateMutex_);
        for (const auto& target : classicTargets_) {
            if (normalizeAddress(target.address) == normalized) {
                prefersClassic = true;
                break;
            }
        }
    }

    if (forceClassic || prefersClassic) {
        if (!connectClassicTarget(normalized, errorOut)) {
            lastError_ = errorOut;
            return false;
        }
        {
            StateLock lock(stateMutex_);
            selectedTargetAddress_ = normalized;
            selectedTargetName_ = "Classic Audio";
            for (const auto& target : classicTargets_) {
                if (normalizeAddress(target.address) == normalized) {
                    selectedTargetName_ = target.name;
                    break;
                }
            }
            lastCommandAt_ = millis();
        }
        return true;
    }

    if (!kBleAudioEnabled || !globalBluetoothService || !globalBluetoothService->connectDevice(address)) {
        errorOut = "connect failed";
        lastError_ = errorOut;
        return false;
    }

    {
        StateLock lock(stateMutex_);
        selectedTargetAddress_ = address;
        if (BluetoothDevice* device = globalBluetoothService->getDevice(address)) {
            selectedTargetName_ = device->name;
        }
        selectedTransport_ = "ble";
        lastError_ = "";
        lastCommandAt_ = millis();
    }
    return true;
}

bool BluetoothAudioTtsService::disconnectTarget(String& errorOut) {
    String selectedAddress;
    String selectedTransport;
    {
        StateLock lock(stateMutex_);
        selectedAddress = selectedTargetAddress_;
        selectedTransport = selectedTransport_;
    }

    if (selectedAddress.length() == 0) {
        errorOut = "no target selected";
        lastError_ = errorOut;
        pushDebugLog("disconnectTarget: no selected target");
        return false;
    }

    pushDebugLog(String("disconnectTarget called transport=") + selectedTransport + " addr=" + selectedAddress);

    if (selectedTransport == "classic") {
        if (!disconnectClassicTarget(errorOut)) {
            lastError_ = errorOut;
            pushDebugLog(String("disconnectTarget classic failed: ") + errorOut);
            return false;
        }
    } else {
        if (!kBleAudioEnabled || !globalBluetoothService || !globalBluetoothService->disconnectDevice(selectedAddress)) {
            errorOut = "disconnect failed";
            lastError_ = errorOut;
            pushDebugLog("disconnectTarget BLE failed");
            return false;
        }
    }

    {
        StateLock lock(stateMutex_);
        selectedTargetAddress_ = "";
        selectedTargetName_ = "";
        selectedTransport_ = "";
        lastError_ = "";
        lastCommandAt_ = millis();
    }
    pushDebugLog("disconnectTarget: success");
    return true;
}

bool BluetoothAudioTtsService::queueMp3Playback(const String& source, bool isUrl, String& errorOut) {
    String selectedTransport;
    {
        StateLock lock(stateMutex_);
        if (selectedTargetAddress_.length() == 0) {
            errorOut = "no selected bluetooth audio target";
            lastError_ = errorOut;
            return false;
        }
        selectedTransport = selectedTransport_;
    }

    if (selectedTransport.length() == 0) {
        errorOut = "no selected bluetooth audio target";
        lastError_ = errorOut;
        return false;
    }
    if (source.length() == 0) {
        errorOut = "source is required";
        lastError_ = errorOut;
        return false;
    }

    bool queuedClassic = false;
    {
        StateLock lock(stateMutex_);
        lastMp3Source_ = source;
        lastMp3WasUrl_ = isUrl;
        if (selectedTransport == "classic") {
            AudioPlaybackItem item;
            item.kind = "mp3";
            item.payload = source;
            item.isUrl = isUrl;
            item.remainingSamples = clampPlaybackSamples(6U * kAudioSampleRate);
            playbackQueue_.push_back(item);
            queuedClassic = true;
            armClassicMediaStartRetryLocked(millis(), 80);
        }
        lastError_ = "";
        lastCommandAt_ = millis();
    }

    if (selectedTransport == "classic" && queuedClassic) {
        requestClassicMediaStart("queueMp3Playback", false);
    }
    return true;
}

bool BluetoothAudioTtsService::queueTts(const String& text, const String& voice, String& errorOut) {
    String selectedTransport;
    {
        StateLock lock(stateMutex_);
        if (selectedTargetAddress_.length() == 0) {
            errorOut = "no selected bluetooth audio target";
            lastError_ = errorOut;
            return false;
        }
        selectedTransport = selectedTransport_;
    }

    if (selectedTransport.length() == 0) {
        errorOut = "no selected bluetooth audio target";
        lastError_ = errorOut;
        return false;
    }
    if (text.length() == 0) {
        errorOut = "text is required";
        lastError_ = errorOut;
        return false;
    }

    bool queuedClassic = false;
    bool diagnosticTone = false;
    uint32_t textLen = 0;
    String voiceLower = voice;
    voiceLower.toLowerCase();
    if (voiceLower == "tone" || voiceLower == "diag" || voiceLower == "debug-tone") {
        diagnosticTone = true;
    }
    {
        StateLock lock(stateMutex_);
        lastTtsText_ = text;
        lastTtsVoice_ = voice.length() ? voice : "default";
        if (selectedTransport == "classic") {
            AudioPlaybackItem item;
            item.kind = "tts";
            String synthText = text;
            if (!diagnosticTone) {
                synthText.toLowerCase();
                synthText.replace("hello", "heh loh");
                synthText.replace("world", "wurld");
                synthText.replace("from", "frum");
                synthText.replace("esp32", "ee es pee thirty two");
            }
            item.payload = synthText;
            item.diagnosticTone = diagnosticTone;
            textLen = static_cast<uint32_t>(item.payload.length());
            item.remainingSamples = diagnosticTone
                ? clampPlaybackSamples(static_cast<uint32_t>(textLen * 12000U))
                : clampPlaybackSamples(static_cast<uint32_t>(textLen * 5200U));
            item.payloadCursor = 0;
            playbackQueue_.push_back(item);
            queuedClassic = true;
            armClassicMediaStartRetryLocked(millis(), 80);
        }
        lastError_ = "";
        lastCommandAt_ = millis();
    }

    if (queuedClassic) {
        pushDebugLog(String("queueTts mode=") + (diagnosticTone ? "tone" : "speech") +
                     " chars=" + String(static_cast<unsigned>(textLen)));
    }

    if (selectedTransport == "classic" && queuedClassic) {
        requestClassicMediaStart("queueTts", false);
    }
    return true;
}

uint32_t BluetoothAudioTtsService::clampPlaybackSamples(uint32_t suggestedSamples) const {
    const uint32_t minSamples = kAudioSampleRate / 2;
    const uint32_t maxSamples = kAudioSampleRate * 30;
    return std::max(minSamples, std::min(maxSamples, suggestedSamples));
}

int32_t BluetoothAudioTtsService::produceA2dpPcm(uint8_t* data, int32_t len) {
    StateLock lock(stateMutex_);
    if (!classicConnected_ || playbackQueue_.empty()) {
        memset(data, 0, static_cast<size_t>(len));
        return len;
    }

    AudioPlaybackItem& item = playbackQueue_.front();
    float baseFreq = 659.25f;
    if (item.kind == "tts" && item.diagnosticTone) {
        if (item.payload.length() == 0) {
            baseFreq = 523.25f;
        } else {
            const size_t idx = static_cast<size_t>(millis() / 40U) % static_cast<size_t>(item.payload.length());
            const uint8_t c = static_cast<uint8_t>(item.payload[idx]);
            baseFreq = 220.0f + static_cast<float>((c % 48U) * 12U);
        }
    }
    const int32_t frameCount = len / 4;
    int32_t framesWritten = 0;

    for (int32_t i = 0; i < frameCount; ++i) {
        if (item.remainingSamples == 0) {
            break;
        }

        float sampleF = 0.0f;
        if (item.kind == "tts" && !item.diagnosticTone) {
            if (item.phonemeSamplesLeft == 0) {
                const char raw = (item.payloadCursor < static_cast<uint32_t>(item.payload.length()))
                    ? item.payload[static_cast<int>(item.payloadCursor++)]
                    : ' ';
                const SpeechCharParams params = speechParamsForChar(raw);
                item.f0 = params.f0;
                item.f1 = params.f1;
                item.f2 = params.f2;
                item.voicedMix = params.voicedMix;
                item.noiseMix = params.noiseMix;
                item.phonemeSamplesTotal = static_cast<uint32_t>((static_cast<uint32_t>(params.durationMs) * kAudioSampleRate) / 1000U);
                if (item.phonemeSamplesTotal == 0) {
                    item.phonemeSamplesTotal = 1;
                }
                item.phonemeSamplesLeft = item.phonemeSamplesTotal;
            }

            const float progress = 1.0f - (static_cast<float>(item.phonemeSamplesLeft) / static_cast<float>(item.phonemeSamplesTotal));
            float env = 1.0f;
            if (progress < 0.1f) {
                env = progress / 0.1f;
            } else if (progress > 0.82f) {
                env = (1.0f - progress) / 0.18f;
            }
            env = std::max(0.0f, std::min(1.0f, env));

            item.noiseState ^= item.noiseState << 13;
            item.noiseState ^= item.noiseState >> 17;
            item.noiseState ^= item.noiseState << 5;
            const float noise = (static_cast<float>(item.noiseState & 0xFFFFU) / 32768.0f) - 1.0f;

            const float voiced =
                (sinf(item.phase) * 0.72f) +
                (sinf(item.phase2) * 0.20f) +
                (sinf(item.phase3) * 0.08f);
            sampleF = ((voiced * item.voicedMix) + (noise * item.noiseMix)) * env * 14500.0f;

            // Mild pre-emphasis adds articulation and reduces muddy low-mid character.
            const float emphasized = (sampleF - (0.91f * item.prevSpeechSample));
            sampleF = (sampleF * 0.62f) + (emphasized * 0.38f);
            item.prevSpeechSample = sampleF;
            item.prevSpeechEmphasis = emphasized;

            // Preserve headroom and avoid harsh clipping in the Bluetooth PCM path.
            sampleF *= kSpeechHeadroom;
            sampleF = kSpeechSoftLimit * tanhf(sampleF / kSpeechSoftLimit);

            item.phase += phaseIncrement(item.f0);
            item.phase2 += phaseIncrement(item.f0 * 2.0f);
            item.phase3 += phaseIncrement(item.f0 * 3.0f);
            if (item.phase >= kTwoPi) item.phase -= kTwoPi;
            if (item.phase2 >= kTwoPi) item.phase2 -= kTwoPi;
            if (item.phase3 >= kTwoPi) item.phase3 -= kTwoPi;

            if (item.phonemeSamplesLeft > 0) {
                item.phonemeSamplesLeft--;
            }
        } else {
            sampleF = sinf(item.phase) * 16000.0f;
            item.phase += (kTwoPi * baseFreq) / static_cast<float>(kAudioSampleRate);
            if (item.phase >= kTwoPi) {
                item.phase -= kTwoPi;
            }
        }

        sampleF = std::max(-32767.0f, std::min(32767.0f, sampleF));
        const int16_t sample = static_cast<int16_t>(sampleF);
        data[(i * 4) + 0] = static_cast<uint8_t>(sample & 0xFF);
        data[(i * 4) + 1] = static_cast<uint8_t>((sample >> 8) & 0xFF);
        data[(i * 4) + 2] = static_cast<uint8_t>(sample & 0xFF);
        data[(i * 4) + 3] = static_cast<uint8_t>((sample >> 8) & 0xFF);

        item.remainingSamples--;
        framesWritten++;
    }

    if (framesWritten < frameCount) {
        memset(data + (framesWritten * 4), 0, static_cast<size_t>((frameCount - framesWritten) * 4));
    }

    if (item.remainingSamples == 0) {
        playbackQueue_.pop_front();
        streamStartPending_ = !playbackQueue_.empty();
        if (playbackQueue_.empty()) {
            streamStartRetries_ = 0;
            streamStopPending_ = true;
        }
    }

    return len;
}

void BluetoothAudioTtsService::onClassicGapEvent(esp_bt_gap_cb_event_t event, esp_bt_gap_cb_param_t* param) {
    if (!globalBluetoothAudioTtsService || !param) {
        return;
    }

    {
        StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
        globalBluetoothAudioTtsService->debugGapEvents_++;
        globalBluetoothAudioTtsService->debugLastGapEvent_ = String(static_cast<int>(event));
    }
    globalBluetoothAudioTtsService->pushDebugLog(String("GAP event: ") + gapEventName(event) +
                                                 "(" + String(static_cast<int>(event)) + ")");

    if (event == ESP_BT_GAP_DISC_RES_EVT) {
        ClassicBluetoothAudioTarget target;
        target.address = formatBdAddr(param->disc_res.bda);
        target.name = "";
        target.rssi = -120;
        target.audioCandidate = false;

        for (int i = 0; i < param->disc_res.num_prop; ++i) {
            const esp_bt_gap_dev_prop_t& prop = param->disc_res.prop[i];
            if (prop.type == ESP_BT_GAP_DEV_PROP_BDNAME && prop.len > 0 && prop.val) {
                target.name = String(reinterpret_cast<const char*>(prop.val));
            } else if (prop.type == ESP_BT_GAP_DEV_PROP_EIR && prop.len > 0 && prop.val) {
                uint8_t len = 0;
                uint8_t* eirName = esp_bt_gap_resolve_eir_data(reinterpret_cast<uint8_t*>(prop.val), ESP_BT_EIR_TYPE_CMPL_LOCAL_NAME, &len);
                if (!eirName) {
                    eirName = esp_bt_gap_resolve_eir_data(reinterpret_cast<uint8_t*>(prop.val), ESP_BT_EIR_TYPE_SHORT_LOCAL_NAME, &len);
                }
                if (eirName && len > 0) {
                    char tmp[64];
                    const size_t copyLen = std::min(sizeof(tmp) - 1, static_cast<size_t>(len));
                    memcpy(tmp, eirName, copyLen);
                    tmp[copyLen] = '\0';
                    target.name = String(tmp);
                }
            } else if (prop.type == ESP_BT_GAP_DEV_PROP_RSSI && prop.val) {
                target.rssi = *reinterpret_cast<int8_t*>(prop.val);
            } else if (prop.type == ESP_BT_GAP_DEV_PROP_COD && prop.val) {
                const uint32_t cod = *reinterpret_cast<uint32_t*>(prop.val);
                target.audioCandidate = isAudioCod(cod);
            }
        }

        const bool missingName = (target.name.length() == 0);
        if (missingName) {
            target.name = target.address;
        }
        if (globalBluetoothAudioTtsService->isAudioTargetName(target.name) ||
            globalBluetoothAudioTtsService->isLikelyAlexaTargetName(target.name)) {
            target.audioCandidate = true;
        }

        Serial.printf("[BLUETOOTH-AUDIO] classic DISC_RES addr=%s name=%s rssi=%d audioCandidate=%s\n",
                      target.address.c_str(),
                      target.name.c_str(),
                      target.rssi,
                      target.audioCandidate ? "true" : "false");

        globalBluetoothAudioTtsService->upsertClassicTarget(target);

        if (missingName) {
            esp_err_t nameErr = esp_bt_gap_read_remote_name(param->disc_res.bda);
            if (nameErr == ESP_OK) {
                Serial.printf("[BLUETOOTH-AUDIO] classic NAME_REQ addr=%s\n", target.address.c_str());
            } else if (nameErr != ESP_ERR_INVALID_STATE && nameErr != ESP_ERR_INVALID_ARG) {
                Serial.printf("[BLUETOOTH-AUDIO] classic NAME_REQ failed addr=%s err=%s\n",
                              target.address.c_str(),
                              esp_err_to_name(nameErr));
            }
        }
    } else if (event == ESP_BT_GAP_DISC_STATE_CHANGED_EVT) {
        StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
        globalBluetoothAudioTtsService->classicDiscovering_ =
            (param->disc_st_chg.state == ESP_BT_GAP_DISCOVERY_STARTED);
        globalBluetoothAudioTtsService->debugLastGapEvent_ =
            String("DISC_STATE:") + String(static_cast<int>(param->disc_st_chg.state));
        Serial.printf("[BLUETOOTH-AUDIO] classic DISC_STATE=%d targets=%u\n",
                      static_cast<int>(param->disc_st_chg.state),
                      static_cast<unsigned>(globalBluetoothAudioTtsService->classicTargets_.size()));
    } else if (event == ESP_BT_GAP_READ_REMOTE_NAME_EVT) {
        const String addr = formatBdAddr(param->read_rmt_name.bda);
        const int stat = static_cast<int>(param->read_rmt_name.stat);
        if (param->read_rmt_name.stat == ESP_BT_STATUS_SUCCESS &&
            strlen(reinterpret_cast<const char*>(param->read_rmt_name.rmt_name)) > 0) {
            const String remoteName = String(reinterpret_cast<const char*>(param->read_rmt_name.rmt_name));
            ClassicBluetoothAudioTarget target;
            target.address = addr;
            target.name = remoteName;
            target.audioCandidate = globalBluetoothAudioTtsService->isAudioTargetName(remoteName) ||
                                    globalBluetoothAudioTtsService->isLikelyAlexaTargetName(remoteName);
            globalBluetoothAudioTtsService->upsertClassicTarget(target);
            Serial.printf("[BLUETOOTH-AUDIO] classic NAME_RES addr=%s stat=%d name=%s\n",
                          addr.c_str(),
                          stat,
                          remoteName.c_str());
        } else {
            Serial.printf("[BLUETOOTH-AUDIO] classic NAME_RES addr=%s stat=%d\n",
                          addr.c_str(),
                          stat);
        }
        globalBluetoothAudioTtsService->pushDebugLog(String("GAP READ_REMOTE_NAME stat=") + String(stat));
    } else if (event == ESP_BT_GAP_PIN_REQ_EVT) {
        esp_bt_pin_code_t pinCode;
        pinCode[0] = '0'; pinCode[1] = '0'; pinCode[2] = '0'; pinCode[3] = '0';
        esp_bt_gap_pin_reply(param->pin_req.bda, true, 4, pinCode);
        Serial.printf("[BLUETOOTH-AUDIO] classic PIN_REQ addr=%s -> replied 0000\n",
                      formatBdAddr(param->pin_req.bda).c_str());
        globalBluetoothAudioTtsService->pushDebugLog("GAP PIN_REQ replied 0000");
    } else if (event == ESP_BT_GAP_CFM_REQ_EVT) {
        esp_bt_gap_ssp_confirm_reply(param->cfm_req.bda, true);
        Serial.printf("[BLUETOOTH-AUDIO] classic CFM_REQ addr=%s num=%lu -> accepted\n",
                      formatBdAddr(param->cfm_req.bda).c_str(),
                      static_cast<unsigned long>(param->cfm_req.num_val));
        globalBluetoothAudioTtsService->pushDebugLog("GAP CFM_REQ accepted");
    } else if (event == ESP_BT_GAP_AUTH_CMPL_EVT) {
        Serial.printf("[BLUETOOTH-AUDIO] classic AUTH_CMPL addr=%s stat=%d\n",
                      formatBdAddr(param->auth_cmpl.bda).c_str(),
                      static_cast<int>(param->auth_cmpl.stat));
        globalBluetoothAudioTtsService->pushDebugLog(String("GAP AUTH_CMPL stat=") +
                                                     String(static_cast<int>(param->auth_cmpl.stat)));
    } else if (event == ESP_BT_GAP_CONFIG_EIR_DATA_EVT) {
        Serial.printf("[BLUETOOTH-AUDIO] classic CONFIG_EIR stat=%d\n",
                      static_cast<int>(param->config_eir_data.stat));
        globalBluetoothAudioTtsService->pushDebugLog(String("GAP CONFIG_EIR stat=") +
                                                     String(static_cast<int>(param->config_eir_data.stat)));
    } else if (event == ESP_BT_GAP_ACL_CONN_CMPL_STAT_EVT) {
        {
            StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
            globalBluetoothAudioTtsService->debugAclConnectEvents_++;
            globalBluetoothAudioTtsService->debugLastGapEvent_ = String("ACL_CONN:") + String(static_cast<int>(param->acl_conn_cmpl_stat.stat));
        }
        Serial.printf("[BLUETOOTH-AUDIO] classic ACL_CONN stat=%d handle=%u addr=%s\n",
                      static_cast<int>(param->acl_conn_cmpl_stat.stat),
                      static_cast<unsigned>(param->acl_conn_cmpl_stat.handle),
                      formatBdAddr(param->acl_conn_cmpl_stat.bda).c_str());
    } else if (event == ESP_BT_GAP_ACL_DISCONN_CMPL_STAT_EVT) {
        const uint16_t rawReason = static_cast<uint16_t>(param->acl_disconn_cmpl_stat.reason);
        const uint8_t hciReason = static_cast<uint8_t>(rawReason & 0xFF);
        {
            StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
            globalBluetoothAudioTtsService->debugAclDisconnectEvents_++;
            globalBluetoothAudioTtsService->debugLastAclDisconnectRawReason_ = rawReason;
            globalBluetoothAudioTtsService->debugLastAclDisconnectHciReason_ = hciReason;
            globalBluetoothAudioTtsService->debugLastGapEvent_ = String("ACL_DISCONN:") + String(static_cast<unsigned>(rawReason));
        }
        globalBluetoothAudioTtsService->pushDebugLog(
            String("ACL_DISCONN raw=") + String(static_cast<unsigned>(rawReason)) +
            " hci=" + String(static_cast<unsigned>(hciReason)) +
            ":" + hciDisconnectReasonName(hciReason));
        Serial.printf("[BLUETOOTH-AUDIO] classic ACL_DISCONN reason=%u(0x%X) hci=%u(0x%X:%s) handle=%u addr=%s\n",
                      static_cast<unsigned>(rawReason),
                      static_cast<unsigned>(rawReason),
                      static_cast<unsigned>(hciReason),
                      static_cast<unsigned>(hciReason),
                      hciDisconnectReasonName(hciReason),
                      static_cast<unsigned>(param->acl_disconn_cmpl_stat.handle),
                      formatBdAddr(param->acl_disconn_cmpl_stat.bda).c_str());
    } else {
        Serial.printf("[BLUETOOTH-AUDIO] classic GAP event=%d\n", static_cast<int>(event));
    }
}

void BluetoothAudioTtsService::onClassicA2dpEvent(esp_a2d_cb_event_t event, esp_a2d_cb_param_t* param) {
    if (!globalBluetoothAudioTtsService || !param) {
        return;
    }

    {
        StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
        globalBluetoothAudioTtsService->debugA2dpEvents_++;
        globalBluetoothAudioTtsService->debugLastA2dpEvent_ = String(static_cast<int>(event));
    }
    globalBluetoothAudioTtsService->pushDebugLog(String("A2DP event: ") + a2dpEventName(event) +
                                                 "(" + String(static_cast<int>(event)) + ")");

    if (event == ESP_A2D_CONNECTION_STATE_EVT) {
        bool shouldKickStart = false;
        {
            StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
            const esp_a2d_connection_state_t state = param->conn_stat.state;
            const esp_a2d_disc_rsn_t discReason = param->conn_stat.disc_rsn;
            const bool connected = (state == ESP_A2D_CONNECTION_STATE_CONNECTED);
            const String addr = formatBdAddr(param->conn_stat.remote_bda);
            globalBluetoothAudioTtsService->classicConnected_ = connected;
            globalBluetoothAudioTtsService->debugLastA2dpEvent_ =
                String("A2DP_CONN_STATE:") + String(static_cast<int>(state));
            Serial.printf("[BLUETOOTH-AUDIO] classic A2DP state=%d disc_rsn=%d(0x%X) addr=%s\n",
                          static_cast<int>(state),
                          static_cast<int>(discReason),
                          static_cast<unsigned>(discReason),
                          addr.c_str());
            if (connected) {
                globalBluetoothAudioTtsService->classicConnectedAddress_ = addr;
                globalBluetoothAudioTtsService->selectedTargetAddress_ = addr;
                globalBluetoothAudioTtsService->selectedTransport_ = "classic";
                globalBluetoothAudioTtsService->lastError_ = "";
                globalBluetoothAudioTtsService->streamStartRetries_ = 0;
                globalBluetoothAudioTtsService->streamStartPending_ = !globalBluetoothAudioTtsService->playbackQueue_.empty();
                globalBluetoothAudioTtsService->nextMediaStartRetryAtMs_ = millis() + 50;
                shouldKickStart = !globalBluetoothAudioTtsService->playbackQueue_.empty();
            } else if (state == ESP_A2D_CONNECTION_STATE_DISCONNECTED) {
                globalBluetoothAudioTtsService->classicConnectedAddress_ = "";
                globalBluetoothAudioTtsService->lastError_ = String("classic a2dp disconnected (disc_rsn=") +
                                                       String(static_cast<int>(discReason)) + ")";
                globalBluetoothAudioTtsService->streamStartPending_ = false;
                globalBluetoothAudioTtsService->streamStartRetries_ = 0;
            }

            for (auto& target : globalBluetoothAudioTtsService->classicTargets_) {
                if (globalBluetoothAudioTtsService->normalizeAddress(target.address) ==
                    globalBluetoothAudioTtsService->normalizeAddress(addr)) {
                    target.connected = connected;
                    if (connected && globalBluetoothAudioTtsService->selectedTargetName_.length() == 0) {
                        globalBluetoothAudioTtsService->selectedTargetName_ = target.name;
                    }
                }
            }
        }
        if (shouldKickStart) {
            globalBluetoothAudioTtsService->requestClassicMediaStart("a2dp connected", false);
        }
    } else if (event == ESP_A2D_AUDIO_STATE_EVT) {
        const int state = static_cast<int>(param->audio_stat.state);
        Serial.printf("[BLUETOOTH-AUDIO] classic A2DP audio_state=%d\n", state);
        globalBluetoothAudioTtsService->pushDebugLog(String("A2DP AUDIO_STATE=") + String(state));
        {
            StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
            globalBluetoothAudioTtsService->debugAudioStateEvents_++;
            globalBluetoothAudioTtsService->debugLastAudioState_ = state;
            if (state == ESP_A2D_AUDIO_STATE_STARTED) {
                globalBluetoothAudioTtsService->streamStartPending_ = false;
            }
        }
    } else if (event == ESP_A2D_MEDIA_CTRL_ACK_EVT) {
        const int cmd = static_cast<int>(param->media_ctrl_stat.cmd);
        const int status = static_cast<int>(param->media_ctrl_stat.status);
        Serial.printf("[BLUETOOTH-AUDIO] classic A2DP media_ctrl_ack cmd=%d status=%d\n", cmd, status);
        globalBluetoothAudioTtsService->pushDebugLog(String("A2DP MEDIA_CTRL_ACK cmd=") + String(cmd) +
                                                     " status=" + String(status));
        {
            StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
            globalBluetoothAudioTtsService->debugLastMediaCtrlCmd_ = cmd;
            globalBluetoothAudioTtsService->debugLastMediaCtrlStatus_ = status;
            if (cmd == ESP_A2D_MEDIA_CTRL_START) {
                if (status == ESP_A2D_MEDIA_CTRL_ACK_SUCCESS) {
                    globalBluetoothAudioTtsService->debugMediaStartAckOk_++;
                    globalBluetoothAudioTtsService->streamStartPending_ = false;
                    globalBluetoothAudioTtsService->streamStartRetries_ = 0;
                } else {
                    globalBluetoothAudioTtsService->debugMediaStartAckFail_++;
                    globalBluetoothAudioTtsService->streamStartPending_ = true;
                    globalBluetoothAudioTtsService->nextMediaStartRetryAtMs_ = millis() + kMediaStartRetryMs;
                }
            }
        }
    } else if (event == ESP_A2D_PROF_STATE_EVT) {
        const int initState = static_cast<int>(param->a2d_prof_stat.init_state);
        Serial.printf("[BLUETOOTH-AUDIO] classic A2DP prof_state=%d\n", initState);
        globalBluetoothAudioTtsService->pushDebugLog(String("A2DP PROF_STATE=") + String(initState));
    }
}

void BluetoothAudioTtsService::onClassicAvrcEvent(esp_avrc_ct_cb_event_t event, esp_avrc_ct_cb_param_t* param) {
    if (!globalBluetoothAudioTtsService || !param) {
        return;
    }

    {
        StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
        globalBluetoothAudioTtsService->debugAvrcEvents_++;
        globalBluetoothAudioTtsService->debugLastAvrcEvent_ = String(static_cast<int>(event));
    }

    if (event == ESP_AVRC_CT_CONNECTION_STATE_EVT) {
        {
            StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
            globalBluetoothAudioTtsService->debugLastAvrcEvent_ =
                String("AVRCP_CONN:") + String(static_cast<int>(param->conn_stat.connected));
        }
        Serial.printf("[BLUETOOTH-AUDIO] classic AVRCP connected=%d addr=%s\n",
                      static_cast<int>(param->conn_stat.connected),
                      formatBdAddr(param->conn_stat.remote_bda).c_str());
    } else {
        Serial.printf("[BLUETOOTH-AUDIO] classic AVRCP event=%d\n", static_cast<int>(event));
    }
}

int32_t BluetoothAudioTtsService::onClassicA2dpData(uint8_t* data, int32_t len) {
    if (!globalBluetoothAudioTtsService) {
        memset(data, 0, static_cast<size_t>(len));
        return len;
    }
    bool shouldLogData = false;
    uint32_t callbackCount = 0;
    uint32_t byteCount = 0;
    uint32_t queueDepth = 0;
    static unsigned long lastDataLogAtMs = 0;
    {
        StateLock lock(globalBluetoothAudioTtsService->stateMutex_);
        globalBluetoothAudioTtsService->debugA2dpDataCallbacks_++;
        globalBluetoothAudioTtsService->debugA2dpDataBytes_ += static_cast<uint32_t>(len);
        globalBluetoothAudioTtsService->lastA2dpDataCallbackAtMs_ = millis();
        callbackCount = globalBluetoothAudioTtsService->debugA2dpDataCallbacks_;
        byteCount = globalBluetoothAudioTtsService->debugA2dpDataBytes_;
        queueDepth = static_cast<uint32_t>(globalBluetoothAudioTtsService->playbackQueue_.size());
        const unsigned long nowMs = globalBluetoothAudioTtsService->lastA2dpDataCallbackAtMs_;
        if (queueDepth > 0 && (nowMs - lastDataLogAtMs) >= 3000UL) {
            shouldLogData = true;
            lastDataLogAtMs = nowMs;
        }
    }
    if (shouldLogData) {
        Serial.printf("[BLUETOOTH-AUDIO] classic A2DP data callbacks=%lu bytes=%lu queue=%lu\n",
                      static_cast<unsigned long>(callbackCount),
                      static_cast<unsigned long>(byteCount),
                      static_cast<unsigned long>(queueDepth));
    }
    return globalBluetoothAudioTtsService->produceA2dpPcm(data, len);
}

void registerBluetoothAudioTtsRoutes(AsyncWebServer& server, BluetoothAudioTtsService& service) {
    server.on("/api/bluetooth-audio/discover", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        service.logDebug(String("HTTP discover from ") + request->client()->remoteIP().toString());
        JsonDocument doc;
        String durationRaw;
        int duration = 8;
        if (getRequestValue(request, "duration", durationRaw)) {
            duration = durationRaw.toInt();
        }

        const bool ok = service.startDiscovery(duration);
        doc["ok"] = ok;
        doc["duration"] = duration;
        doc["classicReady"] = service.classicReady();
        doc["classicConnected"] = service.classicConnected();
        doc["classicDiscoveredCount"] = static_cast<uint32_t>(service.listClassicTargets().size());
        doc["targetCount"] = static_cast<uint32_t>(service.listTargets().size());
        doc["lastError"] = service.lastError();
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
            t["transport"] = target.transport;
            t["rssi"] = target.rssi;
            t["connected"] = target.connected;
        }

        // Raw classic scan results are included to ensure all discovered classic
        // devices are visible for manual connect attempts.
        auto classicTargetsRaw = doc["classicTargetsRaw"].to<JsonArray>();
        for (const auto& classic : service.listClassicTargets()) {
            auto t = classicTargetsRaw.add<JsonObject>();
            t["address"] = classic.address;
            t["name"] = classic.name;
            t["rssi"] = classic.rssi;
            t["audioCandidate"] = classic.audioCandidate;
            t["connected"] = classic.connected;
            t["lastSeen"] = static_cast<uint32_t>(classic.lastSeen);
        }

        auto bondedClassicRaw = doc["bondedClassicRaw"].to<JsonArray>();
        for (const auto& addr : getClassicBondedAddresses()) {
            auto t = bondedClassicRaw.add<JsonObject>();
            t["address"] = addr;
        }

        doc["selectedAddress"] = service.selectedAddress();
        doc["selectedName"] = service.selectedName();
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/debug", HTTP_GET, [&service](AsyncWebServerRequest* request) {
        JsonDocument doc;
        service.appendDebugSnapshot(doc.to<JsonObject>());
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/connect", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        service.logDebug(String("HTTP connect from ") + request->client()->remoteIP().toString());
        JsonDocument doc;
        String address;
        String transport;
        if (!getRequestValue(request, "address", address) || address.length() == 0) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }
        getRequestValue(request, "transport", transport);
        if (transport.equalsIgnoreCase("classic") && !address.startsWith("classic://") && !address.startsWith("CLASSIC://")) {
            address = "classic://" + address;
        }

        String err;
        const bool ok = service.connectTarget(address, err);
        doc["ok"] = ok;
        doc["address"] = address;
        doc["selectedAddress"] = service.selectedAddress();
        doc["selectedName"] = service.selectedName();
        doc["selectedTransport"] = service.selectedTransport();
        if (!ok) {
            doc["error"] = err;
            sendJson(request, doc, 409);
            return;
        }
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/disconnect", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        service.logDebug(String("HTTP disconnect from ") + request->client()->remoteIP().toString());
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

    server.on("/api/bluetooth-audio/unpair", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (globalBluetoothAudioTtsService) {
            globalBluetoothAudioTtsService->logDebug(String("HTTP unpair from ") + request->client()->remoteIP().toString());
        }
        JsonDocument doc;
        String address;
        if (!getRequestValue(request, "address", address) || address.length() == 0) {
            doc["error"] = "address is required";
            sendJson(request, doc, 400);
            return;
        }

        uint8_t bda[6];
        if (!parseClassicMacAddress(address, bda)) {
            doc["error"] = "invalid classic bluetooth address";
            sendJson(request, doc, 400);
            return;
        }

        const String normalized = normalizeClassicAddress(address);
        const esp_err_t err = esp_bt_gap_remove_bond_device(bda);
        doc["address"] = normalized;
        doc["ok"] = (err == ESP_OK);
        doc["result"] = esp_err_to_name(err);
        if (err != ESP_OK) {
            sendJson(request, doc, 409);
            return;
        }

        Serial.printf("[BLUETOOTH-AUDIO] classic UNPAIR addr=%s\n", normalized.c_str());
        sendJson(request, doc);
    });

    server.on("/api/bluetooth-audio/force-start", HTTP_POST, [&service](AsyncWebServerRequest* request) {
        service.logDebug(String("HTTP force-start from ") + request->client()->remoteIP().toString());
        JsonDocument doc;
        String err;
        const bool ok = service.forceClassicMediaStart(err);
        doc["ok"] = ok;
        doc["selectedAddress"] = service.selectedAddress();
        doc["classicConnected"] = service.classicConnected();
        doc["queuedPlaybackItems"] = static_cast<uint32_t>(service.queuedPlaybackItems());
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
        doc["selectedTransport"] = service.selectedTransport();
        doc["lastMp3Source"] = service.lastMp3Source();
        doc["lastMp3WasUrl"] = service.lastMp3WasUrl();
        doc["lastTtsText"] = service.lastTtsText();
        doc["lastTtsVoice"] = service.lastTtsVoice();
        doc["classicReady"] = service.classicReady();
        doc["classicDiscovering"] = service.classicDiscovering();
        doc["classicConnected"] = service.classicConnected();
        doc["classicDiscoveredCount"] = static_cast<uint32_t>(service.listClassicTargets().size());
        doc["queuedPlaybackItems"] = static_cast<uint32_t>(service.queuedPlaybackItems());
        doc["mediaStartPending"] = service.classicConnected() && service.queuedPlaybackItems() > 0;
        doc["lastError"] = service.lastError();
        doc["lastCommandAt"] = static_cast<uint32_t>(service.lastCommandAt());
        sendJson(request, doc);
    });
}

#endif // defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)
