#ifndef BLUETOOTH_AUDIO_TTS_SERVICE_H
#define BLUETOOTH_AUDIO_TTS_SERVICE_H

#if defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)

#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include <vector>
#include <deque>
#include <freertos/semphr.h>
#include <esp_gap_bt_api.h>
#include <esp_a2dp_api.h>
#include <esp_avrc_api.h>

struct BluetoothAudioTarget {
    String address;
    String name;
    String type;
    String transport;
    int rssi = 0;
    bool connected = false;
};

struct ClassicBluetoothAudioTarget {
    String address;
    String name;
    int rssi = 0;
    bool audioCandidate = false;
    bool connected = false;
    unsigned long lastSeen = 0;
};

struct AudioPlaybackItem {
    String kind;
    String payload;
    bool isUrl = false;
    bool diagnosticTone = false;
    uint32_t remainingSamples = 0;
    uint32_t phonemeSamplesLeft = 0;
    uint32_t phonemeSamplesTotal = 0;
    uint32_t payloadCursor = 0;
    uint32_t noiseState = 0xA341316Cu;
    float f0 = 120.0f;
    float f1 = 650.0f;
    float f2 = 1400.0f;
    float voicedMix = 1.0f;
    float noiseMix = 0.0f;
    float phase = 0.0f;
    float phase2 = 0.0f;
    float phase3 = 0.0f;
    float prevSpeechSample = 0.0f;
    float prevSpeechEmphasis = 0.0f;
};

class BluetoothAudioTtsService {
public:
    BluetoothAudioTtsService();

    bool begin();
    void loop();

    bool startDiscovery(int durationSeconds = 8);
    std::vector<BluetoothAudioTarget> listTargets() const;
    std::vector<ClassicBluetoothAudioTarget> listClassicTargets() const;

    bool connectTarget(const String& address, String& errorOut);
    bool disconnectTarget(String& errorOut);

    bool queueMp3Playback(const String& source, bool isUrl, String& errorOut);
    bool queueTts(const String& text, const String& voice, String& errorOut);
    bool forceClassicMediaStart(String& errorOut);

    String selectedAddress() const;
    String selectedName() const;
    bool hasSelectedTarget() const;

    String lastMp3Source() const;
    bool lastMp3WasUrl() const;
    String lastTtsText() const;
    String lastTtsVoice() const;
    String lastError() const;
    unsigned long lastCommandAt() const;
    String selectedTransport() const;
    bool classicReady() const;
    bool classicConnected() const;
    bool classicDiscovering() const;
    size_t queuedPlaybackItems() const;
    void appendDebugSnapshot(JsonObject obj) const;
    void logDebug(const String& line);

private:
    bool isAudioTargetName(const String& name) const;
    bool isAudioTargetType(const String& type) const;
    bool isLikelyAlexaTargetName(const String& name) const;
    bool beginClassicStack();
    bool startClassicDiscovery(int durationSeconds);
    bool connectClassicTarget(const String& address, String& errorOut);
    bool disconnectClassicTarget(String& errorOut);
    static void onClassicGapEvent(esp_bt_gap_cb_event_t event, esp_bt_gap_cb_param_t* param);
    static void onClassicA2dpEvent(esp_a2d_cb_event_t event, esp_a2d_cb_param_t* param);
    static void onClassicAvrcEvent(esp_avrc_ct_cb_event_t event, esp_avrc_ct_cb_param_t* param);
    static int32_t onClassicA2dpData(uint8_t* data, int32_t len);
    int32_t produceA2dpPcm(uint8_t* data, int32_t len);
    void upsertClassicTarget(const ClassicBluetoothAudioTarget& target);
    bool parseMacAddress(const String& address, uint8_t out[6]) const;
    String normalizeAddress(const String& address) const;
    uint32_t clampPlaybackSamples(uint32_t suggestedSamples) const;
    bool requestClassicMediaStart(const String& reason, bool allowStopFirst);
    void armClassicMediaStartRetryLocked(uint32_t nowMs, uint32_t delayMs);
    void pushDebugLog(const String& line);

    String selectedTargetAddress_;
    String selectedTargetName_;
    String selectedTransport_;

    String lastMp3Source_;
    bool lastMp3WasUrl_ = false;

    String lastTtsText_;
    String lastTtsVoice_;

    String lastError_;
    unsigned long lastCommandAt_ = 0;

    std::vector<ClassicBluetoothAudioTarget> classicTargets_;
    bool classicReady_ = false;
    bool classicDiscovering_ = false;
    bool classicConnected_ = false;
    unsigned long classicDiscoveryUntilMs_ = 0;
    String classicConnectedAddress_;
    String classicConnectedName_;

    uint32_t debugGapEvents_ = 0;
    uint32_t debugA2dpEvents_ = 0;
    uint32_t debugAvrcEvents_ = 0;
    uint32_t debugDiscoveryStarts_ = 0;
    uint32_t debugDiscoveryCancels_ = 0;
    uint32_t debugConnectRequests_ = 0;
    uint32_t debugConnectFailures_ = 0;
    uint32_t debugAclConnectEvents_ = 0;
    uint32_t debugAclDisconnectEvents_ = 0;
    uint32_t debugA2dpDataCallbacks_ = 0;
    uint32_t debugA2dpDataBytes_ = 0;
    uint32_t debugAudioStateEvents_ = 0;
    uint32_t debugMediaStartRequests_ = 0;
    uint32_t debugMediaStartFailures_ = 0;
    uint32_t debugMediaStartAckOk_ = 0;
    uint32_t debugMediaStartAckFail_ = 0;
    uint32_t debugForcedMediaStartRequests_ = 0;
    int32_t debugLastAudioState_ = -1;
    int32_t debugLastMediaCtrlCmd_ = -1;
    int32_t debugLastMediaCtrlStatus_ = -1;
    uint32_t streamStartRetries_ = 0;
    bool streamStartPending_ = false;
    bool streamStopPending_ = false;
    unsigned long nextMediaStartRetryAtMs_ = 0;
    unsigned long lastMediaStartRequestAtMs_ = 0;
    unsigned long lastMediaStopRequestAtMs_ = 0;
    unsigned long lastA2dpDataCallbackAtMs_ = 0;
    uint16_t debugLastAclDisconnectRawReason_ = 0;
    uint8_t debugLastAclDisconnectHciReason_ = 0;
    String debugLastConnectAddress_;
    String debugLastConnectResult_;
    String debugLastGapEvent_;
    String debugLastA2dpEvent_;
    String debugLastAvrcEvent_;
    std::deque<String> debugLog_;

    std::deque<AudioPlaybackItem> playbackQueue_;
    mutable SemaphoreHandle_t stateMutex_ = nullptr;
};

extern BluetoothAudioTtsService* globalBluetoothAudioTtsService;

void registerBluetoothAudioTtsRoutes(AsyncWebServer& server, BluetoothAudioTtsService& service);

#endif // defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)

#endif // BLUETOOTH_AUDIO_TTS_SERVICE_H
