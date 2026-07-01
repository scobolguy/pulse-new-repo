#include "aws_iot_client.h"
#include <LittleFS.h>

// Global instance
AwsIotClient* globalAwsIotClient = nullptr;

void initializeAwsIotClient() {
    if (globalAwsIotClient == nullptr) {
        globalAwsIotClient = new AwsIotClient();
    }
}

// Static callback wrapper
void AwsIotClient::mqttCallback(char* topic, byte* payload, unsigned int length) {
    if (globalAwsIotClient != nullptr) {
        globalAwsIotClient->handleMessage(topic, payload, length);
    }
}

// ============================================================================
// Constructor / Destructor
// ============================================================================

AwsIotClient::AwsIotClient()
    : mqttClient(wifiClient), initialized(false), connected(false),
      lastReconnectAttempt(0), lastKeepAlive(0), reconnectAttempts(0) {
    clearError();
}

AwsIotClient::~AwsIotClient() {
    shutdown();
}

// ============================================================================
// Initialization
// ============================================================================

bool AwsIotClient::initialize(const AwsIotConfig& cfg) {
    clearError();
    config = cfg;
    
    // Validate configuration
    if (config.endpoint.isEmpty() || config.thingName.isEmpty()) {
        setError("Invalid configuration: endpoint and thingName required");
        return false;
    }
    
    // Set default client ID if not provided
    if (config.clientId.isEmpty()) {
        config.clientId = config.thingName;
    }
    
    // Load certificates
    if (!loadCertificates()) {
        setError("Failed to load certificates");
        return false;
    }
    
    // Configure MQTT client
    mqttClient.setServer(config.endpoint.c_str(), config.port);
    mqttClient.setCallback(AwsIotClient::mqttCallback);
    mqttClient.setBufferSize(4096); // Increase buffer for Alexa messages
    
    initialized = true;
    return true;
}

bool AwsIotClient::loadCertificates() {
    // Load Root CA
    File caFile = LittleFS.open(config.rootCaPath, "r");
    if (!caFile) {
        setError("Failed to open Root CA file");
        return false;
    }
    rootCa = caFile.readString();
    caFile.close();
    
    // Load Device Certificate
    File certFile = LittleFS.open(config.deviceCertPath, "r");
    if (!certFile) {
        setError("Failed to open device certificate file");
        return false;
    }
    deviceCert = certFile.readString();
    certFile.close();
    
    // Load Private Key
    File keyFile = LittleFS.open(config.privateKeyPath, "r");
    if (!keyFile) {
        setError("Failed to open private key file");
        return false;
    }
    privateKey = keyFile.readString();
    keyFile.close();
    
    // Configure WiFiClientSecure
    wifiClient.setCACert(rootCa.c_str());
    wifiClient.setCertificate(deviceCert.c_str());
    wifiClient.setPrivateKey(privateKey.c_str());
    
    return true;
}

bool AwsIotClient::connect() {
    if (!initialized) {
        setError("Client not initialized");
        return false;
    }
    
    if (connected) {
        return true;
    }
    
    Serial.printf("Connecting to AWS IoT: %s\n", config.endpoint.c_str());
    
    // Attempt connection
    if (mqttClient.connect(config.clientId.c_str())) {
        Serial.println("Connected to AWS IoT Core");
        connected = true;
        reconnectAttempts = 0;
        
        // Subscribe to shadow topics
        String shadowUpdateTopic = buildShadowTopic("update/accepted");
        String shadowDeltaTopic = buildShadowTopic("update/delta");
        mqttClient.subscribe(shadowUpdateTopic.c_str());
        mqttClient.subscribe(shadowDeltaTopic.c_str());
        
        // Subscribe to Alexa topics if enabled
        if (config.alexaEnabled) {
            String alexaTopic = buildAlexaTopic("directive");
            mqttClient.subscribe(alexaTopic.c_str());
            Serial.printf("Subscribed to Alexa topic: %s\n", alexaTopic.c_str());
        }
        
        // Subscribe to WFL topics if enabled
        if (config.wflEnabled) {
            String wflTopic = buildWflTopic("action");
            mqttClient.subscribe(wflTopic.c_str());
            Serial.printf("Subscribed to WFL topic: %s\n", wflTopic.c_str());
        }
        
        return true;
    }
    
    int state = mqttClient.state();
    Serial.printf("AWS IoT connection failed, state: %d\n", state);
    setError("Connection failed");
    return false;
}

void AwsIotClient::disconnect() {
    if (connected) {
        mqttClient.disconnect();
        connected = false;
    }
}

bool AwsIotClient::isConnected() const {
    return connected && const_cast<PubSubClient&>(mqttClient).connected();
}

void AwsIotClient::shutdown() {
    disconnect();
    subscriptions.clear();
    alexaHandlers.clear();
    wflHandlers.clear();
    initialized = false;
}

// ============================================================================
// MQTT Operations
// ============================================================================

bool AwsIotClient::subscribe(const char* topic, MessageCallback callback) {
    if (!isConnected()) {
        setError("Not connected");
        return false;
    }
    
    if (mqttClient.subscribe(topic)) {
        subscriptions[String(topic)] = callback;
        return true;
    }
    
    setError("Subscribe failed");
    return false;
}

bool AwsIotClient::unsubscribe(const char* topic) {
    if (!isConnected()) {
        setError("Not connected");
        return false;
    }
    
    subscriptions.erase(String(topic));
    return mqttClient.unsubscribe(topic);
}

bool AwsIotClient::publish(const char* topic, const char* payload, int qos) {
    if (!isConnected()) {
        setError("Not connected");
        return false;
    }
    
    return mqttClient.publish(topic, payload, qos > 0);
}

bool AwsIotClient::publishJson(const char* topic, const JsonDocument& doc, int qos) {
    String payload;
    serializeJson(doc, payload);
    return publish(topic, payload.c_str(), qos);
}

// ============================================================================
// Device Shadow
// ============================================================================

bool AwsIotClient::updateShadow(const JsonDocument& state) {
    JsonDocument doc;
    doc["state"]["reported"] = state;
    
    String topic = buildShadowTopic("update");
    return publishJson(topic.c_str(), doc, 1);
}

bool AwsIotClient::getShadow() {
    String topic = buildShadowTopic("get");
    return publish(topic.c_str(), "", 1);
}

bool AwsIotClient::deleteShadow() {
    String topic = buildShadowTopic("delete");
    return publish(topic.c_str(), "", 1);
}

void AwsIotClient::onShadowUpdate(MessageCallback callback) {
    shadowUpdateCallback = callback;
}

void AwsIotClient::onShadowDelta(MessageCallback callback) {
    shadowDeltaCallback = callback;
}

// ============================================================================
// Alexa Integration
// ============================================================================

void AwsIotClient::registerAlexaHandler(const char* namespace_, AlexaDirectiveCallback callback) {
    alexaHandlers[String(namespace_)] = callback;
}

bool AwsIotClient::sendAlexaResponse(const AlexaDirective& directive, bool success,
                                     const JsonDocument* properties) {
    JsonDocument response;
    
    // Build response structure
    response["event"]["header"]["namespace"] = "Alexa";
    response["event"]["header"]["name"] = success ? "Response" : "ErrorResponse";
    response["event"]["header"]["messageId"] = String(millis());
    response["event"]["header"]["correlationToken"] = directive.correlationToken;
    response["event"]["header"]["payloadVersion"] = "3";
    
    response["event"]["endpoint"]["endpointId"] = directive.endpointId;
    
    if (success && properties != nullptr) {
        response["event"]["payload"] = *properties;
    }
    
    String topic = buildAlexaTopic("response");
    return publishJson(topic.c_str(), response, 1);
}

bool AwsIotClient::sendAlexaError(const AlexaDirective& directive, const char* errorType,
                                  const char* errorMessage) {
    JsonDocument response;
    
    response["event"]["header"]["namespace"] = "Alexa";
    response["event"]["header"]["name"] = "ErrorResponse";
    response["event"]["header"]["messageId"] = String(millis());
    response["event"]["header"]["correlationToken"] = directive.correlationToken;
    response["event"]["header"]["payloadVersion"] = "3";
    
    response["event"]["payload"]["type"] = errorType;
    response["event"]["payload"]["message"] = errorMessage;
    
    String topic = buildAlexaTopic("response");
    return publishJson(topic.c_str(), response, 1);
}

bool AwsIotClient::reportAlexaStateChange(const char* endpointId, const JsonDocument& properties) {
    JsonDocument report;
    
    report["event"]["header"]["namespace"] = "Alexa";
    report["event"]["header"]["name"] = "ChangeReport";
    report["event"]["header"]["messageId"] = String(millis());
    report["event"]["header"]["payloadVersion"] = "3";
    
    report["event"]["endpoint"]["endpointId"] = endpointId;
    report["event"]["payload"]["change"]["properties"] = properties;
    
    String topic = buildAlexaTopic("event");
    return publishJson(topic.c_str(), report, 1);
}

// ============================================================================
// WFL Integration
// ============================================================================

void AwsIotClient::registerWflHandler(const char* actionType, WflActionCallback callback) {
    wflHandlers[String(actionType)] = callback;
}

bool AwsIotClient::triggerWflWorkflow(const char* workflowId, const JsonDocument& parameters) {
    JsonDocument request;
    
    request["actionId"] = String(millis());
    request["workflowId"] = workflowId;
    request["actionType"] = "trigger";
    request["parameters"] = parameters;
    request["sourceDevice"] = config.thingName;
    request["timestamp"] = millis();
    
    String topic = buildWflTopic("trigger");
    return publishJson(topic.c_str(), request, 1);
}

bool AwsIotClient::sendWflResult(const WflActionRequest& request, bool success,
                                 const JsonDocument& result) {
    JsonDocument response;
    
    response["actionId"] = request.actionId;
    response["workflowId"] = request.workflowId;
    response["success"] = success;
    response["result"] = result;
    response["timestamp"] = millis();
    
    String topic = buildWflTopic("result");
    return publishJson(topic.c_str(), response, 1);
}

bool AwsIotClient::queryWflStatus(const char* workflowId) {
    JsonDocument query;
    
    query["actionId"] = String(millis());
    query["workflowId"] = workflowId;
    query["actionType"] = "query";
    query["sourceDevice"] = config.thingName;
    query["timestamp"] = millis();
    
    String topic = buildWflTopic("query");
    return publishJson(topic.c_str(), query, 1);
}

// ============================================================================
// Update Loop
// ============================================================================

void AwsIotClient::update() {
    if (!initialized) return;
    
    // Reconnect if disconnected
    if (!isConnected()) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt > 5000) {
            lastReconnectAttempt = now;
            reconnectAttempts++;
            Serial.printf("Reconnecting to AWS IoT (attempt %d)...\n", reconnectAttempts);
            reconnect();
        }
        return;
    }
    
    // Process MQTT messages
    mqttClient.loop();
    
    // Send keep-alive
    unsigned long now = millis();
    if (now - lastKeepAlive > 30000) {
        lastKeepAlive = now;
        // AWS IoT handles keep-alive automatically via MQTT ping
    }
}

// ============================================================================
// Helper Methods
// ============================================================================

void AwsIotClient::setError(const char* error) {
    lastError = error;
    Serial.printf("AWS IoT Error: %s\n", error);
}

void AwsIotClient::clearError() {
    lastError = "";
}

bool AwsIotClient::reconnect() {
    return connect();
}

void AwsIotClient::handleMessage(char* topic, byte* payload, unsigned int length) {
    // Convert payload to string
    char* message = new char[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';
    
    String topicStr = String(topic);
    
    Serial.printf("Received message on topic: %s\n", topic);
    
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, message);
    
    if (error) {
        Serial.printf("JSON parse error: %s\n", error.c_str());
        delete[] message;
        return;
    }
    
    // Handle shadow updates
    if (topicStr.indexOf("/shadow/update/accepted") >= 0) {
        if (shadowUpdateCallback) {
            shadowUpdateCallback(topic, message);
        }
    }
    // Handle shadow delta
    else if (topicStr.indexOf("/shadow/update/delta") >= 0) {
        if (shadowDeltaCallback) {
            shadowDeltaCallback(topic, message);
        }
    }
    // Handle Alexa directives
    else if (config.alexaEnabled && topicStr.indexOf("/alexa/directive") >= 0) {
        handleAlexaDirective(doc);
    }
    // Handle WFL actions
    else if (config.wflEnabled && topicStr.indexOf("/wfl/action") >= 0) {
        handleWflAction(doc);
    }
    // Handle custom subscriptions
    else {
        auto it = subscriptions.find(topicStr);
        if (it != subscriptions.end() && it->second) {
            it->second(topic, message);
        }
    }
    
    delete[] message;
}

void AwsIotClient::handleAlexaDirective(const JsonDocument& doc) {
    AlexaDirective directive;
    
    // Parse directive
    if (doc["directive"].is<JsonObject>()) {
        // Access nested objects directly without intermediate conversion
        if (doc["directive"]["header"].is<JsonObject>()) {
            directive.directiveId = doc["directive"]["header"]["messageId"].as<String>();
            directive.namespace_ = doc["directive"]["header"]["namespace"].as<String>();
            directive.name = doc["directive"]["header"]["name"].as<String>();
            directive.correlationToken = doc["directive"]["header"]["correlationToken"].as<String>();
        }
        
        if (doc["directive"]["endpoint"].is<JsonObject>()) {
            directive.endpointId = doc["directive"]["endpoint"]["endpointId"].as<String>();
        }
        
        if (doc["directive"]["payload"].is<JsonObject>()) {
            directive.payload = doc["directive"]["payload"];
        }
    }
    
    Serial.printf("Alexa Directive: %s.%s for endpoint %s\n",
                  directive.namespace_.c_str(), directive.name.c_str(),
                  directive.endpointId.c_str());
    
    // Find and call handler
    auto it = alexaHandlers.find(directive.namespace_);
    if (it != alexaHandlers.end() && it->second) {
        it->second(directive);
    } else {
        Serial.printf("No handler registered for namespace: %s\n", directive.namespace_.c_str());
        sendAlexaError(directive, "INVALID_DIRECTIVE", "No handler for this directive");
    }
}

void AwsIotClient::handleWflAction(const JsonDocument& doc) {
    WflActionRequest request;
    
    // Parse action request
    request.actionId = doc["actionId"].as<String>();
    request.workflowId = doc["workflowId"].as<String>();
    request.actionType = doc["actionType"].as<String>();
    request.sourceDevice = doc["sourceDevice"].as<String>();
    request.timestamp = doc["timestamp"];
    
    if (doc["parameters"].is<JsonObject>()) {
        // Copy parameters object
        JsonObjectConst params = doc["parameters"].as<JsonObjectConst>();
        for (JsonPairConst kv : params) {
            request.parameters[kv.key().c_str()] = kv.value();
        }
    }
    
    Serial.printf("WFL Action: %s for workflow %s\n",
                  request.actionType.c_str(), request.workflowId.c_str());
    
    // Find and call handler
    auto it = wflHandlers.find(request.actionType);
    if (it != wflHandlers.end() && it->second) {
        it->second(request);
    } else {
        Serial.printf("No handler registered for action type: %s\n", request.actionType.c_str());
    }
}

String AwsIotClient::buildShadowTopic(const char* operation) {
    return "$aws/things/" + config.thingName + "/shadow/" + operation;
}

String AwsIotClient::buildAlexaTopic(const char* operation) {
    return "$aws/things/" + config.thingName + "/alexa/" + operation;
}

String AwsIotClient::buildWflTopic(const char* operation) {
    return "$aws/things/" + config.thingName + "/wfl/" + operation;
}

// Made with Bob