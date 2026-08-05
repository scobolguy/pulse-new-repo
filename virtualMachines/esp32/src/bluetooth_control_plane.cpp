#if defined(ESP32) && defined(ENABLE_BT_CONTROL_PLANE)

#include "bluetooth_control_plane.h"

#include <BluetoothSerial.h>

#include "control_plane_commands.h"

namespace {
BluetoothSerial gBtSerial;
}

BluetoothControlPlane* globalBluetoothControlPlane = nullptr;

BluetoothControlPlane::BluetoothControlPlane()
    : ready_(false), lastClientConnected_(false) {
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
    btName += "-cp";

    if (!gBtSerial.begin(btName.c_str())) {
        Serial.println("[BT-CP] Failed to start Bluetooth control plane");
        return false;
    }

    ready_ = true;
    Serial.print("[BT-CP] Ready as ");
    Serial.println(btName);
    return true;
}

void BluetoothControlPlane::loop() {
    if (!ready_) {
        return;
    }

    const bool clientConnected = gBtSerial.hasClient();
    if (clientConnected != lastClientConnected_) {
        lastClientConnected_ = clientConnected;
        Serial.println(clientConnected ? "[BT-CP] client connected" : "[BT-CP] client disconnected");
    }

    if (!clientConnected) {
        return;
    }

    controlPlanePollStream(gBtSerial, lineBuffer_, "BT-CP");
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

#endif
