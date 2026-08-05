#pragma once

#if defined(ESP32) && defined(ENABLE_BT_CONTROL_PLANE)

#include <Arduino.h>

class BluetoothControlPlane {
public:
    BluetoothControlPlane();
    bool begin(const String& deviceName);
    void loop();
    bool isReady() const { return ready_; }

private:
    bool ready_;
    String lineBuffer_;
};

extern BluetoothControlPlane* globalBluetoothControlPlane;

void initializeBluetoothControlPlane(const String& deviceName);
void bluetoothControlPlaneLoop();
bool bluetoothControlPlaneClientConnected();
int bluetoothControlPlaneHttpPost(
    const String& url,
    const String& body,
    String& responseBody,
    uint16_t timeoutMs
);

#endif
