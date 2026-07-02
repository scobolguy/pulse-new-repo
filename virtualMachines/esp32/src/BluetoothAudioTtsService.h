#ifndef BLUETOOTH_AUDIO_TTS_SERVICE_H
#define BLUETOOTH_AUDIO_TTS_SERVICE_H

#if defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <vector>

struct BluetoothAudioTarget {
    String address;
    String name;
    String type;
    int rssi = 0;
    bool connected = false;
};

class BluetoothAudioTtsService {
public:
    BluetoothAudioTtsService();

    bool begin();
    void loop();

    bool startDiscovery(int durationSeconds = 8);
    std::vector<BluetoothAudioTarget> listTargets() const;

    bool connectTarget(const String& address, String& errorOut);
    bool disconnectTarget(String& errorOut);

    bool queueMp3Playback(const String& source, bool isUrl, String& errorOut);
    bool queueTts(const String& text, const String& voice, String& errorOut);

    String selectedAddress() const { return selectedTargetAddress_; }
    String selectedName() const { return selectedTargetName_; }
    bool hasSelectedTarget() const { return selectedTargetAddress_.length() > 0; }

    String lastMp3Source() const { return lastMp3Source_; }
    bool lastMp3WasUrl() const { return lastMp3WasUrl_; }
    String lastTtsText() const { return lastTtsText_; }
    String lastTtsVoice() const { return lastTtsVoice_; }
    String lastError() const { return lastError_; }
    unsigned long lastCommandAt() const { return lastCommandAt_; }

private:
    bool isAudioTargetName(const String& name) const;
    bool isAudioTargetType(const String& type) const;

    String selectedTargetAddress_;
    String selectedTargetName_;

    String lastMp3Source_;
    bool lastMp3WasUrl_ = false;

    String lastTtsText_;
    String lastTtsVoice_;

    String lastError_;
    unsigned long lastCommandAt_ = 0;
};

extern BluetoothAudioTtsService* globalBluetoothAudioTtsService;

void registerBluetoothAudioTtsRoutes(AsyncWebServer& server, BluetoothAudioTtsService& service);

#endif // defined(ENABLE_BLUETOOTH_AUDIO_TTS) && defined(ENABLE_BLUETOOTH_DEVICES)

#endif // BLUETOOTH_AUDIO_TTS_SERVICE_H
