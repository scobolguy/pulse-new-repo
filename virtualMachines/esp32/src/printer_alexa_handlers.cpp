#ifdef ENABLE_PRINTER_SCANNER

#include "PrinterService.h"
#include "aws_iot_client.h"
#include <ArduinoJson.h>

/**
 * Alexa Smart Home Handlers for Printer/Scanner Control
 * 
 * Implements handlers for printer and scanner capabilities:
 * - PowerController (check online status)
 * - PrintController (print test page, cancel jobs)
 * - ScanController (start scan, cancel scan)
 * - EndpointHealth (device status reporting)
 */

// External references
extern AwsIotClient* globalAwsIotClient;
extern PrinterService* globalPrinterService;

// ============================================================================
// Printer Controller Handler
// ============================================================================

void handleAlexaPrinterController(const AlexaDirective& directive) {
    Serial.printf("Handling PrinterController: %s\n", directive.name.c_str());
    
    if (!globalPrinterService) {
        Serial.println("PrinterService not initialized");
        if (globalAwsIotClient) {
            globalAwsIotClient->sendAlexaError(
                directive, "INTERNAL_ERROR",
                "Printer service not available"
            );
        }
        return;
    }
    
    bool success = false;
    JsonDocument params;
    
    if (directive.name == "PrintTestPage") {
        success = globalPrinterService->handleAlexaPrintCommand(
            directive.endpointId, "PrintTestPage", params
        );
    }
    else if (directive.name == "CancelPrint") {
        success = globalPrinterService->handleAlexaPrintCommand(
            directive.endpointId, "CancelPrint", params
        );
    }
    else if (directive.name == "GetPrinterStatus") {
        String status;
        success = globalPrinterService->getStatus(directive.endpointId, status);
        
        if (success && globalAwsIotClient) {
            JsonDocument properties;
            properties["namespace"] = "Alexa.PrinterController";
            properties["name"] = "printerStatus";
            properties["value"] = status;
            properties["timeOfSample"] = millis();
            properties["uncertaintyInMilliseconds"] = 500;
            
            globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
            return;
        }
    }
    
    // Send response to Alexa
    if (success && globalAwsIotClient) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.PrinterController";
        properties["name"] = "printerState";
        properties["value"] = "PROCESSING";
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 500;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
    } else if (globalAwsIotClient) {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to communicate with printer"
        );
    }
}

// ============================================================================
// Scanner Controller Handler
// ============================================================================

void handleAlexaScannerController(const AlexaDirective& directive) {
    Serial.printf("Handling ScannerController: %s\n", directive.name.c_str());
    
    if (!globalPrinterService) {
        Serial.println("PrinterService not initialized");
        if (globalAwsIotClient) {
            globalAwsIotClient->sendAlexaError(
                directive, "INTERNAL_ERROR",
                "Scanner service not available"
            );
        }
        return;
    }
    
    bool success = false;
    JsonDocument params;
    
    if (directive.name == "StartScan") {
        // Extract scan parameters from directive payload
        if (directive.payload.containsKey("resolution")) {
            params["resolution"] = directive.payload["resolution"];
        }
        if (directive.payload.containsKey("format")) {
            params["format"] = directive.payload["format"];
        }
        if (directive.payload.containsKey("color")) {
            params["color"] = directive.payload["color"];
        }
        
        success = globalPrinterService->handleAlexaPrintCommand(
            directive.endpointId, "StartScan", params
        );
    }
    else if (directive.name == "CancelScan") {
        success = globalPrinterService->handleAlexaPrintCommand(
            directive.endpointId, "CancelScan", params
        );
    }
    else if (directive.name == "GetScannerStatus") {
        String status;
        success = globalPrinterService->getStatus(directive.endpointId, status);
        
        if (success && globalAwsIotClient) {
            JsonDocument properties;
            properties["namespace"] = "Alexa.ScannerController";
            properties["name"] = "scannerStatus";
            properties["value"] = status;
            properties["timeOfSample"] = millis();
            properties["uncertaintyInMilliseconds"] = 500;
            
            globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
            return;
        }
    }
    
    // Send response to Alexa
    if (success && globalAwsIotClient) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.ScannerController";
        properties["name"] = "scannerState";
        properties["value"] = "PROCESSING";
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 500;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
    } else if (globalAwsIotClient) {
        globalAwsIotClient->sendAlexaError(
            directive, "ENDPOINT_UNREACHABLE",
            "Unable to communicate with scanner"
        );
    }
}

// ============================================================================
// Power Controller Handler (for printers/scanners)
// ============================================================================

void handleAlexaPrinterPowerController(const AlexaDirective& directive) {
    Serial.printf("Handling PowerController for printer/scanner: %s\n", directive.name.c_str());
    
    if (!globalPrinterService) {
        Serial.println("PrinterService not initialized");
        if (globalAwsIotClient) {
            globalAwsIotClient->sendAlexaError(
                directive, "INTERNAL_ERROR",
                "Printer service not available"
            );
        }
        return;
    }
    
    bool success = false;
    JsonDocument params;
    
    if (directive.name == "TurnOn") {
        // Check if device is online
        success = globalPrinterService->checkDeviceOnline(directive.endpointId);
    }
    else if (directive.name == "TurnOff") {
        // Most network printers don't support power off
        success = false;
    }
    
    // Send response to Alexa
    if (success && globalAwsIotClient) {
        JsonDocument properties;
        properties["namespace"] = "Alexa.PowerController";
        properties["name"] = "powerState";
        properties["value"] = (directive.name == "TurnOn") ? "ON" : "OFF";
        properties["timeOfSample"] = millis();
        properties["uncertaintyInMilliseconds"] = 500;
        
        globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
        
        // Report state change proactively
        globalAwsIotClient->reportAlexaStateChange(
            directive.endpointId.c_str(), properties
        );
    } else if (globalAwsIotClient) {
        if (directive.name == "TurnOff") {
            globalAwsIotClient->sendAlexaError(
                directive, "NOT_SUPPORTED_IN_CURRENT_MODE",
                "Power off not supported for network printers"
            );
        } else {
            globalAwsIotClient->sendAlexaError(
                directive, "ENDPOINT_UNREACHABLE",
                "Device is offline or unreachable"
            );
        }
    }
}

// ============================================================================
// Endpoint Health Handler
// ============================================================================

void handleAlexaPrinterEndpointHealth(const AlexaDirective& directive) {
    Serial.printf("Handling EndpointHealth for printer/scanner: %s\n", directive.name.c_str());
    
    if (!globalPrinterService || !globalAwsIotClient) {
        return;
    }
    
    // Get device state
    JsonDocument state = globalPrinterService->getAlexaDeviceState(directive.endpointId);
    
    if (state.containsKey("error")) {
        globalAwsIotClient->sendAlexaError(
            directive, "NO_SUCH_ENDPOINT",
            "Device not found"
        );
        return;
    }
    
    // Build health response
    JsonDocument properties;
    properties["namespace"] = "Alexa.EndpointHealth";
    properties["name"] = "connectivity";
    
    if (state["online"].as<bool>()) {
        properties["value"]["value"] = "OK";
    } else {
        properties["value"]["value"] = "UNREACHABLE";
    }
    
    properties["timeOfSample"] = millis();
    properties["uncertaintyInMilliseconds"] = 500;
    
    globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
}

// ============================================================================
// Registration Function
// ============================================================================

void registerPrinterAlexaHandlers() {
    if (!globalAwsIotClient) {
        Serial.println("AWS IoT Client not initialized");
        return;
    }
    
    if (!globalPrinterService) {
        Serial.println("PrinterService not initialized");
        return;
    }
    
    Serial.println("Registering Printer/Scanner Alexa handlers...");
    
    // Register capability handlers
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.PrinterController", handleAlexaPrinterController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.ScannerController", handleAlexaScannerController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.PowerController.Printer", handleAlexaPrinterPowerController
    );
    
    globalAwsIotClient->registerAlexaHandler(
        "Alexa.EndpointHealth.Printer", handleAlexaPrinterEndpointHealth
    );
    
    Serial.println("Printer/Scanner Alexa handlers registered successfully");
}

// ============================================================================
// Proactive State Reporting
// ============================================================================

void reportPrinterStateToAlexa(const String& deviceId) {
    if (!globalAwsIotClient || !globalPrinterService) return;
    
    JsonDocument state = globalPrinterService->getAlexaDeviceState(deviceId);
    
    if (state.containsKey("error")) return;
    
    // Report connectivity
    JsonDocument connectivityProps;
    connectivityProps["namespace"] = "Alexa.EndpointHealth";
    connectivityProps["name"] = "connectivity";
    
    if (state["online"].as<bool>()) {
        connectivityProps["value"]["value"] = "OK";
    } else {
        connectivityProps["value"]["value"] = "UNREACHABLE";
    }
    
    connectivityProps["timeOfSample"] = millis();
    connectivityProps["uncertaintyInMilliseconds"] = 500;
    
    globalAwsIotClient->reportAlexaStateChange(deviceId.c_str(), connectivityProps);
    
    // Report device-specific status
    String deviceType = state["type"].as<String>();
    String status = state["status"].as<String>();
    
    JsonDocument statusProps;
    
    if (deviceType == "printer") {
        statusProps["namespace"] = "Alexa.PrinterController";
        statusProps["name"] = "printerStatus";
    } else if (deviceType == "scanner") {
        statusProps["namespace"] = "Alexa.ScannerController";
        statusProps["name"] = "scannerStatus";
    }
    
    statusProps["value"] = status;
    statusProps["timeOfSample"] = millis();
    statusProps["uncertaintyInMilliseconds"] = 500;
    
    globalAwsIotClient->reportAlexaStateChange(deviceId.c_str(), statusProps);
}

#endif // ENABLE_PRINTER_SCANNER

// Made with Bob