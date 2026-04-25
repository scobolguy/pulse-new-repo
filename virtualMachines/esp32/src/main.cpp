// main.cpp
// ESP32 VM minimal network provisioning and presence announcement using PlatformIO
// Uses WiFiManager for smartphone provisioning and UDP broadcast for presence

#include <WiFiManager.h> // https://github.com/tzapu/WiFiManager
#include <WiFi.h>
#include <WiFiUdp.h>

#define ANNOUNCE_PORT 4210
#define ANNOUNCE_INTERVAL 10000 // ms

WiFiUDP udp;
unsigned long lastAnnounce = 0;

void announcePresence() {
    String msg = String("ESP32-VM online: ") + WiFi.macAddress() + " IP: " + WiFi.localIP().toString();
    udp.beginPacket("255.255.255.255", ANNOUNCE_PORT);
    udp.write((const uint8_t*)msg.c_str(), msg.length());
    udp.endPacket();
}

void setup() {
    Serial.begin(115200);
    delay(1000);
    WiFiManager wifiManager;
    // Uncomment to force portal every boot for testing:
    // wifiManager.resetSettings();
    if (!wifiManager.autoConnect("ESP32-Setup")) {
        Serial.println("Failed to connect and hit timeout");
        ESP.restart();
    }
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
    udp.begin(ANNOUNCE_PORT);
    announcePresence();
}

void loop() {
    if (millis() - lastAnnounce > ANNOUNCE_INTERVAL) {
        announcePresence();
        lastAnnounce = millis();
    }
    // Add VM logic here
}
