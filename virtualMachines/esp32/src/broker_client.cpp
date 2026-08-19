#include "broker_client.h"
#include <ArduinoJson.h>
#include <LittleFS.h>
#ifdef ESP8266
  #include <ESP8266WiFi.h>
#else
  #include <WiFi.h>
#endif

// Global broker client instance
BrokerClient* globalBrokerClient = nullptr;

void initializeBrokerClient() {
    if (globalBrokerClient == nullptr) {
        globalBrokerClient = new BrokerClient();
    }
}

// ============================================================================
// MessageQueue Implementation
// ============================================================================

MessageQueue::MessageQueue(const std::string& name, int maxSize, bool persistent)
    : name(name), maxSize(maxSize), persistent(persistent) {
    persistPath = "/queues/" + name + ".dat";
    if (persistent) {
        load();
    }
}

MessageQueue::~MessageQueue() {
    if (persistent) {
        save();
    }
}

bool MessageQueue::push(const BrokerMessage& message) {
    if (isFull()) {
        return false;
    }
    
    messages.push_back(message);
    
    if (persistent) {
        save();
    }
    
    return true;
}

bool MessageQueue::pop(BrokerMessage& message) {
    if (isEmpty()) {
        return false;
    }
    
    message = messages.front();
    messages.erase(messages.begin());
    
    if (persistent) {
        save();
    }
    
    return true;
}

bool MessageQueue::peek(BrokerMessage& message) const {
    if (isEmpty()) {
        return false;
    }
    
    message = messages.front();
    return true;
}

bool MessageQueue::save() {
    if (!persistent) return true;
    
    // Create JSON document
    JsonDocument doc;
    JsonArray array = doc.to<JsonArray>();
    
    for (const auto& msg : messages) {
        JsonObject obj = array.add<JsonObject>();
        obj["id"] = msg.id;
        obj["source"] = msg.sourceDevice;
        obj["target"] = msg.targetDevice;
        obj["queue"] = msg.queue;
        obj["payload"] = msg.payload;
        obj["timestamp"] = msg.timestamp;
        obj["priority"] = msg.priority;
    }
    
    // Write to file
    File file = LittleFS.open(persistPath.c_str(), "w");
    if (!file) {
        return false;
    }
    
    serializeJson(doc, file);
    file.close();
    
    return true;
}

bool MessageQueue::load() {
    if (!persistent) return true;
    
    // Open file
    File file = LittleFS.open(persistPath.c_str(), "r");
    if (!file) {
        return false; // File doesn't exist yet, not an error
    }
    
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    file.close();
    
    if (error) {
        return false;
    }
    
    // Load messages
    messages.clear();
    JsonArray array = doc.as<JsonArray>();
    for (JsonObject obj : array) {
        BrokerMessage msg;
        msg.id = obj["id"].as<std::string>();
        msg.sourceDevice = obj["source"].as<std::string>();
        msg.targetDevice = obj["target"].as<std::string>();
        msg.queue = obj["queue"].as<std::string>();
        msg.payload = obj["payload"].as<std::string>();
        msg.timestamp = obj["timestamp"];
        msg.priority = obj["priority"];
        messages.push_back(msg);
    }
    
    return true;
}

void MessageQueue::clear() {
    messages.clear();
    if (persistent) {
        save();
    }
}

// ============================================================================
// BrokerClient Implementation
// ============================================================================

BrokerClient::BrokerClient()
    : brokerUrl(""), brokerPort(5000), discoveryEnabled(true),
      discoveryInterval(30000), initialized(false), discoveryRunning(false),
      udpPort(5353), lastDiscoveryBroadcast(0), lastDeviceCleanup(0) {
    clearError();
}

BrokerClient::~BrokerClient() {
    shutdown();
}

bool BrokerClient::initialize(const BrokerConfig& config) {
    clearError();
    
    brokerUrl = config.url;
    brokerPort = config.port;
    discoveryEnabled = config.discoveryEnabled;
    discoveryInterval = config.discoveryInterval;
    
    // Create queues from config
    for (const auto& queueConfig : config.queues) {
        createQueue(queueConfig.name.c_str(), queueConfig.maxSize, 
                   queueConfig.persistent);
    }
    
    // Start UDP for discovery
    if (discoveryEnabled) {
        if (!udpClient.begin(udpPort)) {
            setError("Failed to start UDP");
            return false;
        }
    }
    
    initialized = true;
    return true;
}

void BrokerClient::setDeviceInfo(const DeviceInfo& info) {
    deviceInfo = info;
}

void BrokerClient::shutdown() {
    stopDiscovery();
    
    // Clean up queues
    for (auto& pair : queues) {
        delete pair.second;
    }
    queues.clear();
    
    udpClient.stop();
    initialized = false;
}

// ============================================================================
// Discovery
// ============================================================================

bool BrokerClient::startDiscovery() {
    if (!initialized || !discoveryEnabled) {
        setError("Not initialized or discovery disabled");
        return false;
    }
    
    discoveryRunning = true;
    lastDiscoveryBroadcast = 0; // Force immediate broadcast
    return true;
}

void BrokerClient::stopDiscovery() {
    discoveryRunning = false;
}

std::vector<DeviceDiscoveryInfo> BrokerClient::discoverDevices() {
    std::vector<DeviceDiscoveryInfo> devices;
    for (const auto& pair : discoveredDevices) {
        devices.push_back(pair.second);
    }
    return devices;
}

bool BrokerClient::registerDevice() {
    if (!initialized) {
        setError("Not initialized");
        return false;
    }
    
    // Create registration JSON
    JsonDocument doc;
    doc["deviceId"] = deviceInfo.id;
    doc["name"] = deviceInfo.name;
    doc["role"] = deviceInfo.role;
    doc["version"] = deviceInfo.version;
    doc["timestamp"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    
    // Send to broker
    std::string response;
    std::string endpoint = brokerUrl + ":" + std::to_string(brokerPort) + "/register";
    return sendHttpPost(endpoint.c_str(), payload.c_str(), response);
}

bool BrokerClient::getDevice(const char* deviceId, DeviceDiscoveryInfo& info) {
    auto it = discoveredDevices.find(deviceId);
    if (it == discoveredDevices.end()) {
        return false;
    }
    info = it->second;
    return true;
}

bool BrokerClient::isDeviceOnline(const char* deviceId) {
    auto it = discoveredDevices.find(deviceId);
    if (it == discoveredDevices.end()) {
        return false;
    }
    
    // Device is online if seen within last 60 seconds
    unsigned long now = millis();
    return (now - it->second.lastSeen) < 60000;
}

void BrokerClient::broadcastDiscovery() {
    if (!discoveryRunning) return;
    
    // Create discovery message
    JsonDocument doc;
    doc["type"] = "discovery";
    doc["deviceId"] = deviceInfo.id;
    doc["role"] = deviceInfo.role;
    doc["ip"] = WiFi.localIP().toString();
    doc["port"] = brokerPort;
    doc["timestamp"] = millis();
    
    String payload;
    serializeJson(doc, payload);
    
    // Broadcast via UDP
    udpClient.beginPacket(IPAddress(255, 255, 255, 255), udpPort);
    udpClient.write((const uint8_t*)payload.c_str(), payload.length());
    udpClient.endPacket();
    
    lastDiscoveryBroadcast = millis();
}

void BrokerClient::listenForDiscovery() {
    if (!discoveryRunning) return;
    
    int packetSize = udpClient.parsePacket();
    if (packetSize == 0) return;
    
    // Read packet
    char buffer[512];
    int len = udpClient.read(buffer, sizeof(buffer) - 1);
    if (len <= 0) return;
    buffer[len] = '\0';
    
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, buffer);
    if (error) return;
    
    // Extract device info
    if (doc["type"] != "discovery") return;
    
    DeviceDiscoveryInfo info;
    info.deviceId = doc["deviceId"].as<std::string>();
    info.role = doc["role"].as<std::string>();
    info.ip = doc["ip"].as<std::string>();
    info.port = doc["port"];
    info.timestamp = doc["timestamp"];
    info.lastSeen = millis();
    
    // Don't add ourselves
    if (info.deviceId == deviceInfo.id) return;
    
    // Add or update device
    discoveredDevices[info.deviceId] = info;
}

void BrokerClient::cleanupStaleDevices() {
    unsigned long now = millis();
    
    // Remove devices not seen in 120 seconds
    auto it = discoveredDevices.begin();
    while (it != discoveredDevices.end()) {
        if (now - it->second.lastSeen > 120000) {
            it = discoveredDevices.erase(it);
        } else {
            ++it;
        }
    }
    
    lastDeviceCleanup = now;
}

// ============================================================================
// Messaging
// ============================================================================

bool BrokerClient::sendMessage(const char* targetDevice, const char* queue,
                               const char* payload) {
    return sendMessageWithPriority(targetDevice, queue, payload, 0);
}

bool BrokerClient::sendMessageWithPriority(const char* targetDevice, 
                                           const char* queue,
                                           const char* payload, int priority) {
    if (!initialized) {
        setError("Not initialized");
        return false;
    }
    
    // Create message JSON
    JsonDocument doc;
    doc["id"] = generateMessageId();
    doc["source"] = deviceInfo.id;
    doc["target"] = targetDevice;
    doc["queue"] = queue;
    doc["payload"] = payload;
    doc["timestamp"] = millis();
    doc["priority"] = priority;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    // Send to broker
    std::string response;
    std::string endpoint = brokerUrl + ":" + std::to_string(brokerPort) + "/send";
    return sendHttpPost(endpoint.c_str(), jsonPayload.c_str(), response);
}

bool BrokerClient::receiveMessage(const char* queue, BrokerMessage& message,
                                 uint32_t timeoutMs) {
    if (!queueExists(queue)) {
        setError("Queue not found");
        return false;
    }
    
    MessageQueue* q = queues[queue];
    
    // Non-blocking check
    if (timeoutMs == 0) {
        return q->pop(message);
    }
    
    // Blocking with timeout
    unsigned long start = millis();
    while (millis() - start < timeoutMs) {
        if (q->pop(message)) {
            return true;
        }
        delay(10); // Small delay to avoid busy-waiting
    }
    
    return false;
}

bool BrokerClient::receiveMessageNonBlocking(const char* queue, 
                                             BrokerMessage& message) {
    return receiveMessage(queue, message, 0);
}

int BrokerClient::broadcastMessage(const char* queue, const char* payload) {
    int count = 0;
    
    for (const auto& pair : discoveredDevices) {
        if (sendMessage(pair.first.c_str(), queue, payload)) {
            count++;
        }
    }
    
    return count;
}

// ============================================================================
// Queue Management
// ============================================================================

bool BrokerClient::createQueue(const char* name, int maxSize, bool persistent) {
    if (queueExists(name)) {
        setError("Queue already exists");
        return false;
    }
    
    queues[name] = new MessageQueue(name, maxSize, persistent);
    return true;
}

bool BrokerClient::deleteQueue(const char* name) {
    auto it = queues.find(name);
    if (it == queues.end()) {
        setError("Queue not found");
        return false;
    }
    
    delete it->second;
    queues.erase(it);
    return true;
}

int BrokerClient::getQueueSize(const char* name) {
    if (!queueExists(name)) {
        return -1;
    }
    return queues[name]->size();
}

bool BrokerClient::queueExists(const char* name) {
    return queues.find(name) != queues.end();
}

std::vector<std::string> BrokerClient::listQueues() {
    std::vector<std::string> names;
    for (const auto& pair : queues) {
        names.push_back(pair.first);
    }
    return names;
}

// ============================================================================
// Update Loop
// ============================================================================

void BrokerClient::update() {
    if (!initialized) return;
    
    unsigned long now = millis();
    
    // Broadcast discovery
    if (discoveryRunning && (now - lastDiscoveryBroadcast >= discoveryInterval)) {
        broadcastDiscovery();
    }
    
    // Listen for discovery
    if (discoveryRunning) {
        listenForDiscovery();
    }
    
    // Cleanup stale devices every 30 seconds
    if (now - lastDeviceCleanup >= 30000) {
        cleanupStaleDevices();
    }
}

// ============================================================================
// Helper Methods
// ============================================================================

void BrokerClient::setError(const char* error) {
    lastError = error;
}

void BrokerClient::clearError() {
    lastError = "";
}

bool BrokerClient::sendHttpPost(const char* endpoint, const char* payload,
                                std::string& response) {
    #ifdef ESP8266
    httpClient.begin(wifiClient, endpoint);
    #else
    httpClient.begin(endpoint);
    #endif
    httpClient.addHeader("Content-Type", "application/json");
    
    int httpCode = httpClient.POST(payload);
    
    if (httpCode > 0) {
        response = httpClient.getString().c_str();
        httpClient.end();
        return (httpCode == 200 || httpCode == 201);
    }
    
    httpClient.end();
    setError("HTTP POST failed");
    return false;
}

bool BrokerClient::sendHttpGet(const char* endpoint, std::string& response) {
    #ifdef ESP8266
    httpClient.begin(wifiClient, endpoint);
    #else
    httpClient.begin(endpoint);
    #endif
    
    int httpCode = httpClient.GET();
    
    if (httpCode > 0) {
        response = httpClient.getString().c_str();
        httpClient.end();
        return (httpCode == 200);
    }
    
    httpClient.end();
    setError("HTTP GET failed");
    return false;
}

std::string BrokerClient::generateMessageId() {
    static unsigned long counter = 0;
    char id[64];
    snprintf(id, sizeof(id), "%s-%lu-%lu", 
             deviceInfo.id.c_str(), millis(), counter++);
    return std::string(id);
}

// Made with Bob
