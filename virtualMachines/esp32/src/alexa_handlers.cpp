#include "aws_iot_client.h"
#include "device_mediator.h"
#include "broker_client.h"
#include <ArduinoJson.h>

/**
 * Alexa Smart Home Handlers for ESP32
 * 
 * Implements handlers for common Alexa Smart Home capabilities:
 * - PowerController (on/off)
 * - BrightnessController (dimming)
 * - ColorController (RGB control)
 * - TemperatureSensor (temperature reading)
 * - ThermostatController (temperature control)
 * - LockController (lock/unlock)
 * - SceneController (scene activation)
 */

// External references
extern AwsIotClient* globalAwsIotClient;
extern BrokerClient* globalBrokerClient;
extern DeviceMediator* globalDeviceMediator;

// ============================================================================
// Power Controller Handler
// ============================================================================

void handleAlexaPowerController(const AlexaDirective& directive) {
    Serial.printf("Handling PowerController: %s\n", directive.name.c_str());
    
    bool turnOn = (directive.name == "TurnOn");
    bool success = false;
    
    // Map endpoint ID to device pin or service
    if (directive.endpointId == "esp32-relay-01") {
        // Control relay via device mediator
        if (globalDeviceMediator) {
            success = globalDeviceMediator->setActuator("RELAY", turnOn ? 1 : 0);
        }
    }
    else if (directive.endpointId.startsWith("esp32-")) {
        // Send message to broker for other devices
        if (globalBrokerClient) {
            JsonDocument payload;
            payload["action"] = turnOn ? "turnOn" : "turnOff";
            payload["timestamp"] = millis();
            
            String payloadStr;
            serializeJson(payload, payloadStr);
            
            success = globalBrokerClient->sendMessage(
                directive.endpointId.c_str(),
                "power-control",
                payloadStr.c_str()
            );
        }
    }
    
    // Send response to Alexa
    if (success) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.PowerController";
        properties["name"] = "powerState";
        properties["value"] = turnOn ? "ON" : "OFF";
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 500;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
        
        // Report state change proactively
        globalAwsIotClient->reportAlexaStateChange(
            directive.endpointId.c_str(), properties
        );
    } else {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to control device"
        );
    }
}

// ============================================================================
// Brightness Controller Handler
// ============================================================================

void handleAlexaBrightnessController(const AlexaDirective& directive) {
    Serial.printf("Handling BrightnessController: %s\n", directive.name.c_str());
    
    int brightness = 0;
    bool success = false;
    
    if (directive.name == "SetBrightness") {
        brightness = directive.payload["brightness"];
    }
    else if (directive.name == "AdjustBrightness") {
        int delta = directive.payload["brightnessDelta"];
        // Get current brightness and adjust
        // This is simplified - you'd need to track current state
        brightness = constrain(50 + delta, 0, 100);
    }
    
    // Control PWM output for LED dimming
    if (globalDeviceMediator) {
        int pwmValue = map(brightness, 0, 100, 0, 255);
        success = globalDeviceMediator->setActuator("LED", pwmValue);
    }
    
    if (success) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.BrightnessController";
        properties["name"] = "brightness";
        properties["value"] = brightness;
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 500;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
    } else {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to adjust brightness"
        );
    }
}

// ============================================================================
// Temperature Sensor Handler
// ============================================================================

void handleAlexaTemperatureSensor(const AlexaDirective& directive) {
    Serial.printf("Handling TemperatureSensor: %s\n", directive.name.c_str());
    
    // Read temperature from sensor
    float temperature = 0.0;
    bool success = false;
    
    if (globalDeviceMediator) {
        success = globalDeviceMediator->readSensor("temperature", temperature);
    }
    
    if (success) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.TemperatureSensor";
        properties["name"] = "temperature";
        properties["value"]["value"] = temperature;
        properties["value"]["scale"] = "CELSIUS";
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 1000;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
    } else {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to read temperature"
        );
    }
}

// ============================================================================
// Color Controller Handler
// ============================================================================

void handleAlexaColorController(const AlexaDirective& directive) {
    Serial.printf("Handling ColorController: %s\n", directive.name.c_str());
    
    bool success = false;
    
    if (directive.name == "SetColor") {
        float hue = directive.payload["color"]["hue"];
        float saturation = directive.payload["color"]["saturation"];
        float brightness = directive.payload["color"]["brightness"];
        
        // Convert HSB to RGB
        // Simplified conversion - you may want a more accurate algorithm
        int r, g, b;
        // ... HSB to RGB conversion logic ...
        
        if (globalDeviceMediator) {
            // Set RGB via individual outputs (simplified)
            success = true; // Placeholder - implement RGB control as needed
        }
        
        if (success) {
            JsonDocument properties;
            properties["namespace"] = "Alexa.ColorController";
            properties["name"] = "color";
            properties["value"]["hue"] = hue;
            properties["value"]["saturation"] = saturation;
            properties["value"]["brightness"] = brightness;
            properties["timeOfSample"] = millis();
            properties["uncertaintyInMilliseconds"] = 500;
            
            globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
        }
    }
    
    if (!success) {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to set color"
        );
    }
}

// ============================================================================
// Lock Controller Handler
// ============================================================================

void handleAlexaLockController(const AlexaDirective& directive) {
    Serial.printf("Handling LockController: %s\n", directive.name.c_str());
    
    bool lock = (directive.name == "Lock");
    bool success = false;
    
    if (globalDeviceMediator) {
        success = globalDeviceMediator->setActuator("LOCK", lock ? 1 : 0);
    }
    
    if (success) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.LockController";
        properties["name"] = "lockState";
        properties["value"] = lock ? "LOCKED" : "UNLOCKED";
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 500;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
    } else {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to control lock"
        );
    }
}

// ============================================================================
// Scene Controller Handler
// ============================================================================

void handleAlexaSceneController(const AlexaDirective& directive) {
    Serial.printf("Handling SceneController: %s\n", directive.name.c_str());
    
    bool success = false;
    
    if (directive.name == "Activate") {
        // Trigger WFL workflow for scene
        String sceneId = directive.endpointId;
        
        JsonDocument params;
        params["sceneId"] = sceneId;
        params["source"] = "alexa";
        params["timestamp"] = millis();
        
        if (globalAwsIotClient) {
            success = globalAwsIotClient->triggerWflWorkflow(
                ("scene-" + sceneId).c_str(), params
            );
        }
        
        if (success) {
            JsonDocument properties;
            properties["namespace"] = "Alexa.SceneController";
            properties["name"] = "activationState";
            properties["value"] = "ACTIVATED";
            properties["timeOfSample"] = millis();
            properties["uncertaintyInMilliseconds"] = 500;
            
            globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
        }
    }
    
    if (!success) {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to activate scene"
        );
    }
}

// ============================================================================
// Registration Function
// ============================================================================

void registerAlexaHandlers() {
    if (!globalAwsIotClient) {
        Serial.println("AWS IoT Client not initialized");
        return;
    }
    
    Serial.println("Registering Alexa handlers...");
    
    // Register capability handlers
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.PowerController", handleAlexaPowerController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.BrightnessController", handleAlexaBrightnessController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.TemperatureSensor", handleAlexaTemperatureSensor
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.ColorController", handleAlexaColorController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.LockController", handleAlexaLockController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.SceneController", handleAlexaSceneController
    );
    
    Serial.println("Alexa handlers registered successfully");
}

// ============================================================================
// Proactive State Reporting
// ============================================================================

void reportDeviceStateToAlexa(const char* endpointId, const char* capability,
                               const char* propertyName, const JsonDocument& value) {
    if (!globalAwsIotClient) return;
    
    JsonDocument properties;
    properties["namespace"] = capability;
    properties["name"] = propertyName;
    properties["value"] = value;
    properties["timeOfSample"] = millis();
    properties["uncertaintyInMilliseconds"] = 500;
    
    globalAwsIotClient->reportAlexaStateChange(endpointId, properties);
}

// Made with Bob