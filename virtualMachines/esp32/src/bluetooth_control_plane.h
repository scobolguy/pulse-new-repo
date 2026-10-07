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
    bool lastClientConnected_;
    String lineBuffer_;
};

extern BluetoothControlPlane* globalBluetoothControlPlane;

void initializeBluetoothControlPlane(const String& deviceName);
void bluetoothControlPlaneLoop();

#endif
