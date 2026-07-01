#ifndef AWS_IOT_CLIENT_H
#define AWS_IOT_CLIENT_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <map>
#include <functional>

/**
 * AWS IoT Client for ESP32
 * 
 * Provides secure MQTT connection to AWS IoT Core with:
 * - X.509 certificate authentication
 * - Shadow device support
 * - Alexa Smart Home integration
 * - WFL action triggers
 */

// Forward declarations
struct AwsIotConfig;
struct AlexaDirective;
struct WflActionRequest;

/**
 * AWS IoT Configuration
 */
struct AwsIotConfig {
    String endpoint;              // AWS IoT endpoint (e.g., xxxxx.iot.us-east-1.amazonaws.com)
    String thingName;             // AWS IoT Thing name
    String clientId;              // MQTT client ID
    int port;                     // MQTT port (default: 8883)
    
    // Certificate paths (stored in LittleFS)
    String rootCaPath;            // Root CA certificate
    String deviceCertPath;        // Device certificate
    String privateKeyPath;        // Private key
    
    // Alexa integration
    bool alexaEnabled;            // Enable Alexa Smart Home
    String alexaSkillId;          // Alexa Skill ID
    
    // WFL integration
    bool wflEnabled;              // Enable WFL triggers
    String wflBrokerUrl;          // WFL broker URL
    
    AwsIotConfig() : port(8883), alexaEnabled(false), wflEnabled(false) {}
};

/**
 * Alexa Directive Structure
 */
struct AlexaDirective {
    String directiveId;
    String namespace_;            // e.g., "Alexa.PowerController"
    String name;                  // e.g., "TurnOn", "TurnOff"
    String endpointId;            // Device endpoint ID
    JsonDocument payload;         // Directive payload
    String correlationToken;      // For response correlation
    
    AlexaDirective() {}
};

/**
 * WFL Action Request
 */
struct WflActionRequest {
    String actionId;
    String workflowId;
    String actionType;            // e.g., "trigger", "execute", "query"
    JsonDocument parameters;      // Action parameters
    String sourceDevice;          // Originating device
    unsigned long timestamp;
    
    WflActionRequest() : timestamp(0) {}
};

/**
 * Callback function types
 */
typedef std::function<void(const AlexaDirective&)> AlexaDirectiveCallback;
typedef std::function<void(const WflActionRequest&)> WflActionCallback;
typedef std::function<void(const char*, const char*)> MessageCallback;

/**
 * AWS IoT Client Class
 */
class AwsIotClient {
public:
    AwsIotClient();
    ~AwsIotClient();
    
    // ========================================================================
    // Initialization
    // ========================================================================
    
    /**
     * Initialize AWS IoT client with configuration
     * @param config AWS IoT configuration
     * @return true if initialization successful
     */
    bool initialize(const AwsIotConfig& config);
    
    /**
     * Load certificates from filesystem
     * @return true if certificates loaded successfully
     */
    bool loadCertificates();
    
    /**
     * Connect to AWS IoT Core
     * @return true if connection successful
     */
    bool connect();
    
    /**
     * Disconnect from AWS IoT Core
     */
    void disconnect();
    
    /**
     * Check if connected
     * @return true if connected
     */
    bool isConnected() const;
    
    /**
     * Shutdown client
     */
    void shutdown();
    
    // ========================================================================
    // MQTT Operations
    // ========================================================================
    
    /**
     * Subscribe to topic
     * @param topic MQTT topic
     * @param callback Message callback
     * @return true if subscription successful
     */
    bool subscribe(const char* topic, MessageCallback callback);
    
    /**
     * Unsubscribe from topic
     * @param topic MQTT topic
     * @return true if unsubscription successful
     */
    bool unsubscribe(const char* topic);
    
    /**
     * Publish message to topic
     * @param topic MQTT topic
     * @param payload Message payload
     * @param qos Quality of Service (0, 1, or 2)
     * @return true if publish successful
     */
    bool publish(const char* topic, const char* payload, int qos = 0);
    
    /**
     * Publish JSON document
     * @param topic MQTT topic
     * @param doc JSON document
     * @param qos Quality of Service
     * @return true if publish successful
     */
    bool publishJson(const char* topic, const JsonDocument& doc, int qos = 0);
    
    // ========================================================================
    // Device Shadow
    // ========================================================================
    
    /**
     * Update device shadow
     * @param state Shadow state JSON
     * @return true if update successful
     */
    bool updateShadow(const JsonDocument& state);
    
    /**
     * Get device shadow
     * @return true if request sent successfully
     */
    bool getShadow();
    
    /**
     * Delete device shadow
     * @return true if delete successful
     */
    bool deleteShadow();
    
    /**
     * Set shadow update callback
     * @param callback Callback function
     */
    void onShadowUpdate(MessageCallback callback);
    
    /**
     * Set shadow delta callback (for desired state changes)
     * @param callback Callback function
     */
    void onShadowDelta(MessageCallback callback);
    
    // ========================================================================
    // Alexa Integration
    // ========================================================================
    
    /**
     * Register Alexa directive handler
     * @param namespace_ Alexa namespace (e.g., "Alexa.PowerController")
     * @param callback Directive callback
     */
    void registerAlexaHandler(const char* namespace_, AlexaDirectiveCallback callback);
    
    /**
     * Send Alexa response
     * @param directive Original directive
     * @param success Response success status
     * @param properties Changed properties (optional)
     * @return true if response sent
     */
    bool sendAlexaResponse(const AlexaDirective& directive, bool success, 
                          const JsonDocument* properties = nullptr);
    
    /**
     * Send Alexa error response
     * @param directive Original directive
     * @param errorType Error type (e.g., "ENDPOINT_UNREACHABLE")
     * @param errorMessage Error message
     * @return true if response sent
     */
    bool sendAlexaError(const AlexaDirective& directive, const char* errorType,
                       const char* errorMessage);
    
    /**
     * Report Alexa state change proactively
     * @param endpointId Device endpoint ID
     * @param properties Changed properties
     * @return true if report sent
     */
    bool reportAlexaStateChange(const char* endpointId, const JsonDocument& properties);
    
    // ========================================================================
    // WFL Integration
    // ========================================================================
    
    /**
     * Register WFL action handler
     * @param actionType Action type (e.g., "trigger", "execute")
     * @param callback Action callback
     */
    void registerWflHandler(const char* actionType, WflActionCallback callback);
    
    /**
     * Trigger WFL workflow
     * @param workflowId Workflow identifier
     * @param parameters Workflow parameters
     * @return true if trigger sent
     */
    bool triggerWflWorkflow(const char* workflowId, const JsonDocument& parameters);
    
    /**
     * Send WFL action result
     * @param request Original action request
     * @param success Result success status
     * @param result Result data
     * @return true if result sent
     */
    bool sendWflResult(const WflActionRequest& request, bool success,
                      const JsonDocument& result);
    
    /**
     * Query WFL workflow status
     * @param workflowId Workflow identifier
     * @return true if query sent
     */
    bool queryWflStatus(const char* workflowId);
    
    // ========================================================================
    // Update Loop
    // ========================================================================
    
    /**
     * Update loop - call periodically to process messages
     */
    void update();
    
    /**
     * Get last error message
     * @return Error message
     */
    const char* getLastError() const { return lastError.c_str(); }
    
    /**
     * Get IoT endpoint
     * @return IoT endpoint
     */
    String getEndpoint() const { return config.endpoint; }
    
private:
    // Configuration
    AwsIotConfig config;
    
    // MQTT client
    WiFiClientSecure wifiClient;
    PubSubClient mqttClient;
    
    // State
    bool initialized;
    bool connected;
    String lastError;
    
    // Certificates
    String rootCa;
    String deviceCert;
    String privateKey;
    
    // Subscriptions
    std::map<String, MessageCallback> subscriptions;
    
    // Alexa handlers
    std::map<String, AlexaDirectiveCallback> alexaHandlers;
    MessageCallback shadowUpdateCallback;
    MessageCallback shadowDeltaCallback;
    
    // WFL handlers
    std::map<String, WflActionCallback> wflHandlers;
    
    // Connection management
    unsigned long lastReconnectAttempt;
    unsigned long lastKeepAlive;
    int reconnectAttempts;
    
    // Helper methods
    void setError(const char* error);
    void clearError();
    bool reconnect();
    void handleMessage(char* topic, byte* payload, unsigned int length);
    void handleAlexaDirective(const JsonDocument& doc);
    void handleWflAction(const JsonDocument& doc);
    String buildShadowTopic(const char* operation);
    String buildAlexaTopic(const char* operation);
    String buildWflTopic(const char* operation);
    static void mqttCallback(char* topic, byte* payload, unsigned int length);
};

// Global AWS IoT client instance
extern AwsIotClient* globalAwsIotClient;

// Initialization helper
void initializeAwsIotClient();

#endif // AWS_IOT_CLIENT_H

// Made with Bob