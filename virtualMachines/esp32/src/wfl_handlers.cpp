#include "aws_iot_client.h"
#include "broker_client.h"
#include "device_mediator.h"
#include "pmachine.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>

/**
 * WFL (Workflow) Action Handlers for ESP32
 * 
 * Implements handlers for workflow actions triggered via AWS IoT:
 * - Trigger workflows based on sensor events
 * - Execute workflow steps
 * - Query workflow status
 * - Handle workflow results
 */

// External references
extern AwsIotClient* globalAwsIotClient;
extern BrokerClient* globalBrokerClient;
extern DeviceMediator* globalDeviceMediator;

#ifdef ENABLE_PMACHINE
extern pmachine::PMachine pm;
#endif

// ============================================================================
// Workflow Trigger Handler
// ============================================================================

void handleWflTrigger(const WflActionRequest& request) {
    Serial.printf("Handling WFL Trigger: %s\n", request.workflowId.c_str());
    
    bool success = false;
    JsonDocument result;
    
    // Extract parameters
    String workflowId = request.workflowId;
    
    // Route to appropriate handler based on workflow ID
    if (workflowId == "motion-detected-workflow") {
        // Handle motion detection workflow
        String location = request.parameters["location"].as<String>();
        
        Serial.printf("Motion detected at: %s\n", location.c_str());
        
        // Turn on relay
        if (globalDeviceMediator) {
            success = globalDeviceMediator->setActuator("RELAY", 1);
        }
        
        // Send notification via broker
        if (globalBrokerClient && success) {
            JsonDocument notification;
            notification["type"] = "motion-alert";
            notification["location"] = location;
            notification["timestamp"] = millis();
            
            String payload;
            serializeJson(notification, payload);
            
            globalBrokerClient->broadcastMessage("alerts", payload.c_str());
        }
        
        result["action"] = "relay-activated";
        result["location"] = location;
    }
    else if (workflowId == "temperature-alert-workflow") {
        // Handle temperature alert workflow
        float temperature = request.parameters["temperature"];
        
        Serial.printf("Temperature alert: %.2f°C\n", temperature);
        
        // Send HTTP webhook
        HTTPClient http;
        String webhookUrl = request.parameters["webhookUrl"].as<String>();
        
        if (!webhookUrl.isEmpty()) {
            http.begin(webhookUrl);
            http.addHeader("Content-Type", "application/json");
            
            JsonDocument webhook;
            webhook["event"] = "temperature-alert";
            webhook["temperature"] = temperature;
            webhook["deviceId"] = request.sourceDevice;
            webhook["timestamp"] = millis();
            
            String webhookPayload;
            serializeJson(webhook, webhookPayload);
            
            int httpCode = http.POST(webhookPayload);
            success = (httpCode == 200 || httpCode == 201);
            
            http.end();
        }
        
        result["webhookSent"] = success;
        result["temperature"] = temperature;
    }
    else if (workflowId == "alexa-relay-control") {
        // Handle Alexa-triggered relay control
        String action = request.parameters["action"].as<String>();
        
        Serial.printf("Alexa relay control: %s\n", action.c_str());
        
        if (globalDeviceMediator) {
            if (action == "TurnOn") {
                success = globalDeviceMediator->setActuator("RELAY", 1);
            } else if (action == "TurnOff") {
                success = globalDeviceMediator->setActuator("RELAY", 0);
            }
        }
        
        result["action"] = action;
        result["relayState"] = success ? (action == "TurnOn" ? "on" : "off") : "error";
    }
    else if (workflowId.startsWith("scene-")) {
        // Handle scene activation
        String sceneId = workflowId.substring(6); // Remove "scene-" prefix
        
        Serial.printf("Activating scene: %s\n", sceneId.c_str());
        
        // Execute scene actions via broker
        if (globalBrokerClient) {
            JsonDocument scenePayload;
            scenePayload["sceneId"] = sceneId;
            scenePayload["action"] = "activate";
            scenePayload["timestamp"] = millis();
            
            String payload;
            serializeJson(scenePayload, payload);
            
            success = globalBrokerClient->sendMessage(
                "scene-controller",
                "scene-activation",
                payload.c_str()
            );
        }
        
        result["sceneId"] = sceneId;
        result["activated"] = success;
    }
    else {
        // Unknown workflow - try to execute as pcode workflow
        #ifdef ENABLE_PMACHINE
        pmachine::Status pmStatus = pm.getStatus();
        if (pmStatus.running) {
            // PMachine doesn't have loadProgram(path) or execute() methods
            // This is a placeholder for future implementation
            Serial.printf("PMachine workflow execution not yet implemented for: %s\n", workflowId.c_str());
            success = false;
            result["workflowId"] = workflowId;
            result["executed"] = success;
        } else {
            result["error"] = "PMachine not running";
        }
        #else
        result["error"] = "PMachine not enabled";
        #endif
    }
    
    // Send result back to AWS IoT
    if (globalAwsIotClient) {
        globalAwsIotClient->sendWflResult(request, success, result);
    }
}

// ============================================================================
// Workflow Execute Handler
// ============================================================================

void handleWflExecute(const WflActionRequest& request) {
    Serial.printf("Handling WFL Execute: %s\n", request.workflowId.c_str());
    
    bool success = false;
    JsonDocument result;
    
    // Execute workflow step
    String stepId = request.parameters["stepId"].as<String>();
    String stepType = request.parameters["stepType"].as<String>();
    
    if (stepType == "device-control") {
        String deviceId = request.parameters["deviceId"].as<String>();
        String action = request.parameters["action"].as<String>();
        
        if (globalBrokerClient) {
            JsonDocument payload;
            payload["action"] = action;
            payload["stepId"] = stepId;
            payload["timestamp"] = millis();
            
            String payloadStr;
            serializeJson(payload, payloadStr);
            
            success = globalBrokerClient->sendMessage(
                deviceId.c_str(),
                "device-control",
                payloadStr.c_str()
            );
        }
        
        result["deviceId"] = deviceId;
        result["action"] = action;
    }
    else if (stepType == "sensor-read") {
        String sensorId = request.parameters["sensorId"].as<String>();
        
        if (globalDeviceMediator) {
            float value;
            success = globalDeviceMediator->readSensor(sensorId.c_str(), value);
            
            if (success) {
                result["sensorId"] = sensorId;
                result["value"] = value;
            }
        }
    }
    else if (stepType == "delay") {
        int delayMs = request.parameters["delayMs"];
        delay(delayMs);
        success = true;
        result["delayMs"] = delayMs;
    }
    else if (stepType == "http-request") {
        String url = request.parameters["url"].as<String>();
        String method = request.parameters["method"].as<String>();
        
        HTTPClient http;
        http.begin(url);
        
        int httpCode = -1;
        if (method == "GET") {
            httpCode = http.GET();
        } else if (method == "POST") {
            String body = request.parameters["body"].as<String>();
            http.addHeader("Content-Type", "application/json");
            httpCode = http.POST(body);
        }
        
        success = (httpCode >= 200 && httpCode < 300);
        result["httpCode"] = httpCode;
        
        if (success) {
            result["response"] = http.getString();
        }
        
        http.end();
    }
    
    result["stepId"] = stepId;
    result["stepType"] = stepType;
    
    // Send result
    if (globalAwsIotClient) {
        globalAwsIotClient->sendWflResult(request, success, result);
    }
}

// ============================================================================
// Workflow Query Handler
// ============================================================================

void handleWflQuery(const WflActionRequest& request) {
    Serial.printf("Handling WFL Query: %s\n", request.workflowId.c_str());
    
    JsonDocument result;
    bool success = true;
    
    // Query workflow status
    String workflowId = request.workflowId;
    
    // Check if workflow is running in pmachine
    #ifdef ENABLE_PMACHINE
    pmachine::Status pmStatus = pm.getStatus();
    if (pmStatus.running) {
        result["workflowId"] = workflowId;
        result["status"] = "running";
        result["programCounter"] = pmStatus.pc;
        result["numPages"] = pmStatus.numPages;
    } else {
        result["status"] = "not-running";
    }
    #else
    result["status"] = "pmachine-disabled";
    #endif
    
    // Query device states
    if (globalDeviceMediator) {
        result["devices"].to<JsonObject>();
        JsonObject devices = result["devices"];
        
        // Get relay state
        float relayState;
        if (globalDeviceMediator->readSensor("RELAY", relayState)) {
            devices["relay"] = (relayState > 0) ? "on" : "off";
        }
        
        // Get sensor values
        float temperature;
        if (globalDeviceMediator->readSensor("TEMPERATURE", temperature)) {
            devices["temperature"] = temperature;
        }
    }
    
    // Query broker queue depths
    if (globalBrokerClient) {
        result["queues"].to<JsonObject>();
        JsonObject queues = result["queues"];
        
        auto queueNames = globalBrokerClient->listQueues();
        for (const auto& queueName : queueNames) {
            int depth = globalBrokerClient->getQueueSize(queueName.c_str());
            queues[queueName] = depth;
        }
    }
    
    result["timestamp"] = millis();
    
    // Send result
    if (globalAwsIotClient) {
        globalAwsIotClient->sendWflResult(request, success, result);
    }
}

// ============================================================================
// Sensor Event to WFL Trigger
// ============================================================================

void triggerWflFromSensorEvent(const char* sensorId, float value, const char* condition) {
    if (!globalAwsIotClient) return;
    
    Serial.printf("Sensor event: %s = %.2f (%s)\n", sensorId, value, condition);
    
    // Determine which workflow to trigger based on sensor and condition
    String workflowId;
    
    if (strcmp(sensorId, "motion_sensor_1") == 0 && value > 0) {
        workflowId = "motion-detected-workflow";
    }
    else if (strcmp(sensorId, "temp_sensor_1") == 0 && value > 30.0) {
        workflowId = "temperature-alert-workflow";
    }
    
    if (!workflowId.isEmpty()) {
        JsonDocument params;
        params["sensorId"] = sensorId;
        params["value"] = value;
        params["condition"] = condition;
        params["timestamp"] = millis();
        
        globalAwsIotClient->triggerWflWorkflow(workflowId.c_str(), params);
    }
}

// ============================================================================
// Registration Function
// ============================================================================

void registerWflHandlers() {
    if (!globalAwsIotClient) {
        Serial.println("AWS IoT Client not initialized");
        return;
    }
    
    Serial.println("Registering WFL handlers...");
    
    // Register action type handlers
    globalAwsIotClient->registerWflHandler("trigger", handleWflTrigger);
    globalAwsIotClient->registerWflHandler("execute", handleWflExecute);
    globalAwsIotClient->registerWflHandler("query", handleWflQuery);
    
    Serial.println("WFL handlers registered successfully");
}

// ============================================================================
// Workflow Integration with Broker
// ============================================================================

void integrateWflWithBroker() {
    if (!globalBrokerClient) return;
    
    // Create workflow-related queues
    globalBrokerClient->createQueue("wfl-triggers", 50, true);
    globalBrokerClient->createQueue("wfl-results", 50, true);
    globalBrokerClient->createQueue("wfl-events", 100, false);
    
    Serial.println("WFL broker integration complete");
}

// Made with Bob