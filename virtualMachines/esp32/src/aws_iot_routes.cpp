#ifdef ENABLE_AWS_IOT

#include "aws_iot_routes.h"
#include "aws_iot_client.h"
#include <ArduinoJson.h>
#include <LittleFS.h>

// External references
extern AwsIotClient* globalAwsIotClient;

// Forward declarations from handler files
extern void registerAlexaHandlers();
extern void registerWflHandlers();
extern void integrateWflWithBroker();

// ============================================================================
// Initialization
// ============================================================================

bool initializeAwsIotGateway() {
    Serial.println("Initializing AWS IoT Gateway...");
    
    // Load configuration
    File configFile = LittleFS.open("/config/aws-iot-config.json", "r");
    if (!configFile) {
        Serial.println("ERROR: AWS IoT config file not found");
        return false;
    }
    
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, configFile);
    configFile.close();
    
    if (error) {
        Serial.printf("ERROR: Failed to parse AWS IoT config: %s\n", error.c_str());
        return false;
    }
    
    // Initialize AWS IoT client
    if (globalAwsIotClient == nullptr) {
        globalAwsIotClient = new AwsIotClient();
    }
    
    AwsIotConfig config;
    config.endpoint = doc["aws"]["iot"]["endpoint"].as<String>();
    config.thingName = doc["aws"]["iot"]["thingName"].as<String>();
    config.clientId = doc["aws"]["iot"]["clientId"].as<String>();
    config.port = doc["aws"]["iot"]["port"] | 8883;
    config.rootCaPath = doc["aws"]["iot"]["certificates"]["rootCa"].as<String>();
    config.deviceCertPath = doc["aws"]["iot"]["certificates"]["deviceCert"].as<String>();
    config.privateKeyPath = doc["aws"]["iot"]["certificates"]["privateKey"].as<String>();
    config.alexaEnabled = doc["aws"]["alexa"]["enabled"] | false;
    config.alexaSkillId = doc["aws"]["alexa"]["skillId"].as<String>();
    config.wflEnabled = doc["aws"]["wfl"]["enabled"] | false;
    config.wflBrokerUrl = doc["aws"]["wfl"]["brokerUrl"].as<String>();
    
    if (!globalAwsIotClient->initialize(config)) {
        Serial.printf("ERROR: AWS IoT initialization failed: %s\n",
                     globalAwsIotClient->getLastError());
        return false;
    }
    
    Serial.println("✓ AWS IoT client initialized");
    
    // Connect to AWS IoT Core
    if (!globalAwsIotClient->connect()) {
        Serial.printf("ERROR: AWS IoT connection failed: %s\n",
                     globalAwsIotClient->getLastError());
        return false;
    }
    
    Serial.println("✓ Connected to AWS IoT Core");
    
    // Register handlers
    if (config.alexaEnabled) {
        registerAlexaHandlers();
        Serial.println("✓ Alexa handlers registered");
    }
    
    if (config.wflEnabled) {
        registerWflHandlers();
        integrateWflWithBroker();
        Serial.println("✓ WFL handlers registered");
    }
    
    Serial.println("AWS IoT Gateway initialized successfully");
    return true;
}

void shutdownAwsIotGateway() {
    if (globalAwsIotClient) {
        globalAwsIotClient->shutdown();
        Serial.println("AWS IoT Gateway shutdown");
    }
}

void updateAwsIotGateway() {
    if (globalAwsIotClient) {
        globalAwsIotClient->update();
    }
}

// ============================================================================
// HTTP API Routes
// ============================================================================

void registerAwsIotRoutes(AsyncWebServer& server) {
    Serial.println("Registering AWS IoT routes...");
    
    // GET /api/aws-iot/status - Get AWS IoT connection status
    server.on("/api/aws-iot/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        JsonDocument doc;
        
        if (globalAwsIotClient) {
            doc["enabled"] = true;
            doc["connected"] = globalAwsIotClient->isConnected();
            doc["endpoint"] = globalAwsIotClient->getEndpoint();
            
            if (!globalAwsIotClient->isConnected()) {
                doc["error"] = globalAwsIotClient->getLastError();
            }
        } else {
            doc["enabled"] = false;
            doc["connected"] = false;
        }
        
        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });
    
    // POST /api/aws-iot/connect - Connect to AWS IoT
    server.on("/api/aws-iot/connect", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (!globalAwsIotClient) {
            request->send(500, "application/json", "{\"error\":\"AWS IoT not initialized\"}");
            return;
        }
        
        bool success = globalAwsIotClient->connect();
        
        JsonDocument doc;
        doc["success"] = success;
        doc["connected"] = globalAwsIotClient->isConnected();
        
        if (!success) {
            doc["error"] = globalAwsIotClient->getLastError();
        }
        
        String response;
        serializeJson(doc, response);
        request->send(success ? 200 : 500, "application/json", response);
    });
    
    // POST /api/aws-iot/disconnect - Disconnect from AWS IoT
    server.on("/api/aws-iot/disconnect", HTTP_POST, [](AsyncWebServerRequest* request) {
        if (globalAwsIotClient) {
            globalAwsIotClient->disconnect();
        }
        
        request->send(200, "application/json", "{\"success\":true,\"connected\":false}");
    });
    
    // GET /api/aws-iot/shadow - Get device shadow
    server.on("/api/aws-iot/shadow", HTTP_GET, [](AsyncWebServerRequest* request) {
        if (!globalAwsIotClient || !globalAwsIotClient->isConnected()) {
            request->send(500, "application/json", "{\"error\":\"Not connected to AWS IoT\"}");
            return;
        }
        
        bool success = globalAwsIotClient->getShadow();
        
        JsonDocument doc;
        doc["success"] = success;
        doc["message"] = success ? "Shadow request sent" : "Failed to request shadow";
        
        String response;
        serializeJson(doc, response);
        request->send(success ? 200 : 500, "application/json", response);
    });
    
    // POST /api/aws-iot/shadow - Update device shadow
    server.on("/api/aws-iot/shadow", HTTP_POST, [](AsyncWebServerRequest* request) {
        // Body handler will be set below
    }, NULL, [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        if (!globalAwsIotClient || !globalAwsIotClient->isConnected()) {
            request->send(500, "application/json", "{\"error\":\"Not connected to AWS IoT\"}");
            return;
        }
        
        // Parse JSON body
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, data, len);
        
        if (error) {
            request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
            return;
        }
        
        // Update shadow
        bool success = globalAwsIotClient->updateShadow(doc);
        
        JsonDocument response;
        response["success"] = success;
        response["message"] = success ? "Shadow updated" : "Failed to update shadow";
        
        String responseStr;
        serializeJson(response, responseStr);
        request->send(success ? 200 : 500, "application/json", responseStr);
    });
    
    // POST /api/aws-iot/wfl/trigger - Trigger WFL workflow
    server.on("/api/aws-iot/wfl/trigger", HTTP_POST, [](AsyncWebServerRequest* request) {
        // Body handler will be set below
    }, NULL, [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        if (!globalAwsIotClient || !globalAwsIotClient->isConnected()) {
            request->send(500, "application/json", "{\"error\":\"Not connected to AWS IoT\"}");
            return;
        }
        
        // Parse JSON body
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, data, len);
        
        if (error) {
            request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
            return;
        }
        
        String workflowId = doc["workflowId"].as<String>();
        JsonDocument params = doc["parameters"];
        
        if (workflowId.isEmpty()) {
            request->send(400, "application/json", "{\"error\":\"workflowId required\"}");
            return;
        }
        
        // Trigger workflow
        bool success = globalAwsIotClient->triggerWflWorkflow(workflowId.c_str(), params);
        
        JsonDocument response;
        response["success"] = success;
        response["workflowId"] = workflowId;
        response["message"] = success ? "Workflow triggered" : "Failed to trigger workflow";
        
        String responseStr;
        serializeJson(response, responseStr);
        request->send(success ? 200 : 500, "application/json", responseStr);
    });
    
    // POST /api/aws-iot/alexa/report-state - Report state change to Alexa
    server.on("/api/aws-iot/alexa/report-state", HTTP_POST, [](AsyncWebServerRequest* request) {
        // Body handler will be set below
    }, NULL, [](AsyncWebServerRequest* request, uint8_t* data, size_t len, size_t index, size_t total) {
        if (!globalAwsIotClient || !globalAwsIotClient->isConnected()) {
            request->send(500, "application/json", "{\"error\":\"Not connected to AWS IoT\"}");
            return;
        }
        
        // Parse JSON body
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, data, len);
        
        if (error) {
            request->send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
            return;
        }
        
        String endpointId = doc["endpointId"].as<String>();
        JsonDocument properties = doc["properties"];
        
        if (endpointId.isEmpty()) {
            request->send(400, "application/json", "{\"error\":\"endpointId required\"}");
            return;
        }
        
        // Report state change
        bool success = globalAwsIotClient->reportAlexaStateChange(endpointId.c_str(), properties);
        
        JsonDocument response;
        response["success"] = success;
        response["endpointId"] = endpointId;
        response["message"] = success ? "State reported" : "Failed to report state";
        
        String responseStr;
        serializeJson(response, responseStr);
        request->send(success ? 200 : 500, "application/json", responseStr);
    });
    
    // GET /api/aws-iot/config - Get AWS IoT configuration
    server.on("/api/aws-iot/config", HTTP_GET, [](AsyncWebServerRequest* request) {
        File configFile = LittleFS.open("/config/aws-iot-config.json", "r");
        if (!configFile) {
            request->send(404, "application/json", "{\"error\":\"Config file not found\"}");
            return;
        }
        
        String config = configFile.readString();
        configFile.close();
        
        request->send(200, "application/json", config);
    });
    
    Serial.println("✓ AWS IoT routes registered");
}

#endif // ENABLE_AWS_IOT

// Made with Bob