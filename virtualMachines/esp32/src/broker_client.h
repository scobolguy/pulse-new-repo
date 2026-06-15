#ifndef BROKER_CLIENT_H
#define BROKER_CLIENT_H

#include <Arduino.h>
#ifdef ESP8266
  #include <ESP8266HTTPClient.h>
#else
  #include <HTTPClient.h>
#endif
#include <WiFiUDP.h>
#include <map>
#include <vector>
#include <string>
#include "device_registry.h"

// Forward declarations
struct DeviceDiscoveryInfo;
struct BrokerMessage;
class MessageQueue;

/**
 * Device Discovery Information
 */
struct DeviceDiscoveryInfo {
    std::string deviceId;
    std::string role;
    std::string ip;
    int port;
    unsigned long timestamp;
    unsigned long lastSeen;
    
    DeviceDiscoveryInfo() : deviceId(""), role(""), ip(""), port(0), 
                           timestamp(0), lastSeen(0) {}
};

/**
 * Broker Message
 */
struct BrokerMessage {
    std::string id;
    std::string sourceDevice;
    std::string targetDevice;
    std::string queue;
    std::string payload;
    unsigned long timestamp;
    int priority;
    
    BrokerMessage() : id(""), sourceDevice(""), targetDevice(""), 
                     queue(""), payload(""), timestamp(0), priority(0) {}
};

/**
 * Message Queue
 * 
 * FIFO queue for broker messages with optional persistence.
 */
class MessageQueue {
public:
    MessageQueue(const std::string& name, int maxSize, bool persistent);
    ~MessageQueue();
    
    /**
     * Push message to queue
     * @param message Message to push
     * @return true if successful, false if queue full
     */
    bool push(const BrokerMessage& message);
    
    /**
     * Pop message from queue
     * @param message Output parameter for popped message
     * @return true if successful, false if queue empty
     */
    bool pop(BrokerMessage& message);
    
    /**
     * Peek at front message without removing
     * @param message Output parameter for front message
     * @return true if successful, false if queue empty
     */
    bool peek(BrokerMessage& message) const;
    
    /**
     * Get queue size
     * @return Number of messages in queue
     */
    int size() const { return messages.size(); }
    
    /**
     * Check if queue is empty
     * @return true if empty
     */
    bool isEmpty() const { return messages.empty(); }
    
    /**
     * Check if queue is full
     * @return true if full
     */
    bool isFull() const { return messages.size() >= maxSize; }
    
    /**
     * Get queue name
     * @return Queue name
     */
    std::string getName() const { return name; }
    
    /**
     * Save queue to persistent storage
     * @return true if successful
     */
    bool save();
    
    /**
     * Load queue from persistent storage
     * @return true if successful
     */
    bool load();
    
    /**
     * Clear all messages
     */
    void clear();
    
private:
    std::string name;
    int maxSize;
    bool persistent;
    std::vector<BrokerMessage> messages;
    std::string persistPath;
};

/**
 * Broker Client
 * 
 * Provides inter-device messaging via HTTP broker and UDP device discovery.
 * Supports request/response, fire-and-forget, and broadcast patterns.
 */
class BrokerClient {
public:
    BrokerClient();
    ~BrokerClient();
    
    // ========================================================================
    // Initialization
    // ========================================================================
    
    /**
     * Initialize broker client with configuration
     * @param config Broker configuration from registry
     * @return true if initialization successful
     */
    bool initialize(const BrokerConfig& config);
    
    /**
     * Set device information for discovery
     * @param info Device information
     */
    void setDeviceInfo(const DeviceInfo& info);
    
    /**
     * Shutdown broker client
     */
    void shutdown();
    
    // ========================================================================
    // Discovery
    // ========================================================================
    
    /**
     * Start device discovery (UDP broadcast)
     * @return true if discovery started
     */
    bool startDiscovery();
    
    /**
     * Stop device discovery
     */
    void stopDiscovery();
    
    /**
     * Discover devices on network
     * @return Vector of discovered devices
     */
    std::vector<DeviceDiscoveryInfo> discoverDevices();
    
    /**
     * Register this device with broker
     * @return true if registration successful
     */
    bool registerDevice();
    
    /**
     * Get device by ID
     * @param deviceId Device identifier
     * @param info Output parameter for device info
     * @return true if device found
     */
    bool getDevice(const char* deviceId, DeviceDiscoveryInfo& info);
    
    /**
     * Check if device is online
     * @param deviceId Device identifier
     * @return true if device seen recently
     */
    bool isDeviceOnline(const char* deviceId);
    
    // ========================================================================
    // Messaging
    // ========================================================================
    
    /**
     * Send message to target device
     * @param targetDevice Target device ID
     * @param queue Queue name
     * @param payload Message payload
     * @return true if send successful
     */
    bool sendMessage(const char* targetDevice, const char* queue, 
                    const char* payload);
    
    /**
     * Send message with priority
     * @param targetDevice Target device ID
     * @param queue Queue name
     * @param payload Message payload
     * @param priority Message priority (higher = more important)
     * @return true if send successful
     */
    bool sendMessageWithPriority(const char* targetDevice, const char* queue,
                                 const char* payload, int priority);
    
    /**
     * Receive message from queue (blocking with timeout)
     * @param queue Queue name
     * @param message Output parameter for received message
     * @param timeoutMs Timeout in milliseconds (0 = non-blocking)
     * @return true if message received
     */
    bool receiveMessage(const char* queue, BrokerMessage& message, 
                       uint32_t timeoutMs = 0);
    
    /**
     * Receive message non-blocking
     * @param queue Queue name
     * @param message Output parameter for received message
     * @return true if message received
     */
    bool receiveMessageNonBlocking(const char* queue, BrokerMessage& message);
    
    /**
     * Broadcast message to all devices
     * @param queue Queue name
     * @param payload Message payload
     * @return Number of devices message sent to
     */
    int broadcastMessage(const char* queue, const char* payload);
    
    // ========================================================================
    // Queue Management
    // ========================================================================
    
    /**
     * Create message queue
     * @param name Queue name
     * @param maxSize Maximum queue size
     * @param persistent Enable persistence
     * @return true if created successfully
     */
    bool createQueue(const char* name, int maxSize, bool persistent = false);
    
    /**
     * Delete message queue
     * @param name Queue name
     * @return true if deleted successfully
     */
    bool deleteQueue(const char* name);
    
    /**
     * Get queue size
     * @param name Queue name
     * @return Number of messages in queue, -1 if queue not found
     */
    int getQueueSize(const char* name);
    
    /**
     * Check if queue exists
     * @param name Queue name
     * @return true if queue exists
     */
    bool queueExists(const char* name);
    
    /**
     * List all queues
     * @return Vector of queue names
     */
    std::vector<std::string> listQueues();
    
    // ========================================================================
    // Status and Diagnostics
    // ========================================================================
    
    /**
     * Check if broker client is initialized
     * @return true if initialized
     */
    bool isInitialized() const { return initialized; }
    
    /**
     * Check if discovery is running
     * @return true if discovery active
     */
    bool isDiscoveryRunning() const { return discoveryRunning; }
    
    /**
     * Get number of discovered devices
     * @return Device count
     */
    int getDeviceCount() const { return discoveredDevices.size(); }
    
    /**
     * Get last error message
     * @return Error message string
     */
    const char* getLastError() const { return lastError.c_str(); }
    
    /**
     * Get broker URL
     * @return Broker URL
     */
    std::string getBrokerUrl() const { return brokerUrl; }
    
    /**
     * Update loop - call periodically to handle discovery and heartbeat
     */
    void update();
    
private:
    // Configuration
    std::string brokerUrl;
    int brokerPort;
    bool discoveryEnabled;
    int discoveryInterval;
    DeviceInfo deviceInfo;
    
    // State
    bool initialized;
    bool discoveryRunning;
    std::string lastError;
    
    // HTTP client
    HTTPClient httpClient;
    #ifdef ESP8266
    WiFiClient wifiClient;
    #endif
    
    // UDP for discovery
    WiFiUDP udpClient;
    int udpPort;
    
    // Discovered devices
    std::map<std::string, DeviceDiscoveryInfo> discoveredDevices;
    unsigned long lastDiscoveryBroadcast;
    unsigned long lastDeviceCleanup;
    
    // Message queues
    std::map<std::string, MessageQueue*> queues;
    
    // Helper methods
    void setError(const char* error);
    void clearError();
    bool sendHttpPost(const char* endpoint, const char* payload, std::string& response);
    bool sendHttpGet(const char* endpoint, std::string& response);
    void broadcastDiscovery();
    void listenForDiscovery();
    void cleanupStaleDevices();
    std::string generateMessageId();
};

// Global broker client instance
extern BrokerClient* globalBrokerClient;

// Initialization helper
void initializeBrokerClient();

#endif // BROKER_CLIENT_H

// Made with Bob
