# AWS IoT Gateway for ESP32

## Overview

The AWS IoT Gateway is a compile-time feature that enables ESP32 devices to connect to AWS IoT Core, integrate with Alexa Smart Home, and trigger WFL (Workflow) actions.

## Quick Start

### 1. Build with AWS IoT Support

Use one of the AWS IoT-enabled build environments:

```bash
# For standard ESP32
pio run -e esp32dev_aws_iot

# For ESP32-CAM with AWS IoT
pio run -e esp32cam_aws_iot
```

### 2. Setup AWS IoT Certificates

Run the automated setup script:

```powershell
.\scripts\setup-aws-iot-certs.ps1 -ThingName "esp32-device-01" -CreateNew -Region "us-east-1"
```

### 3. Upload Certificates to Device

Copy certificates to `data/certs/` folder and upload filesystem:

```bash
pio run -e esp32dev_aws_iot --target uploadfs
```

### 4. Flash Firmware

```bash
pio run -e esp32dev_aws_iot --target upload
```

## Features

### ✅ AWS IoT Core Integration
- Secure MQTT connection with X.509 certificates
- Device Shadow support
- Automatic reconnection
- TLS 1.2 encryption

### ✅ Alexa Smart Home
- Voice control for ESP32 devices
- Support for multiple capabilities:
  - PowerController (on/off)
  - BrightnessController (dimming)
  - TemperatureSensor (reading)
  - ColorController (RGB)
  - LockController (lock/unlock)
  - SceneController (scenes)
- Proactive state reporting

### ✅ WFL Workflow Integration
- Trigger workflows from sensor events
- Execute workflow steps remotely
- Query workflow status
- Integration with local broker

## HTTP API Endpoints

### Status
```http
GET /api/aws-iot/status
```

### Connection Control
```http
POST /api/aws-iot/connect
POST /api/aws-iot/disconnect
```

### Device Shadow
```http
GET /api/aws-iot/shadow
POST /api/aws-iot/shadow
Body: {"temperature": 25.5, "relay": "on"}
```

### WFL Workflows
```http
POST /api/aws-iot/wfl/trigger
Body: {
  "workflowId": "motion-detected-workflow",
  "parameters": {"location": "Living Room"}
}
```

### Alexa State Reporting
```http
POST /api/aws-iot/alexa/report-state
Body: {
  "endpointId": "esp32-relay-01",
  "properties": {
    "namespace": "Alexa.PowerController",
    "name": "powerState",
    "value": "ON"
  }
}
```

## Configuration

Edit `config/aws-iot-config.json`:

```json
{
  "aws": {
    "iot": {
      "endpoint": "xxxxx.iot.us-east-1.amazonaws.com",
      "thingName": "esp32-device-01",
      "port": 8883
    },
    "alexa": {
      "enabled": true,
      "skillId": "amzn1.ask.skill.YOUR-SKILL-ID"
    },
    "wfl": {
      "enabled": true,
      "brokerUrl": "http://your-backend:5000"
    }
  }
}
```

## Build Flags

The feature is enabled with the `ENABLE_AWS_IOT` flag:

```ini
build_flags = 
    -DENABLE_AWS_IOT
```

## Dependencies

- `knolleary/PubSubClient@^2.8` - MQTT client
- `bblanchon/ArduinoJson` - JSON parsing
- WiFiClientSecure - TLS support

## Example Usage

### Control Relay via Alexa

```cpp
void handleAlexaPowerController(const AlexaDirective& directive) {
    bool turnOn = (directive.name == "TurnOn");
    digitalWrite(RELAY_PIN, turnOn ? HIGH : LOW);
    
    // Send response
    JsonDocument properties;
    properties["namespace"] = "Alexa.PowerController";
    properties["name"] = "powerState";
    properties["value"] = turnOn ? "ON" : "OFF";
    
    globalAwsIotClient->sendAlexaResponse(directive, true, &properties);
}
```

### Trigger Workflow from Sensor

```cpp
void onMotionDetected() {
    JsonDocument params;
    params["location"] = "Living Room";
    params["timestamp"] = millis();
    
    globalAwsIotClient->triggerWflWorkflow(
        "motion-detected-workflow",
        params
    );
}
```

## Troubleshooting

### Connection Issues
- Verify certificates are uploaded correctly
- Check AWS IoT endpoint URL
- Ensure IoT policy allows connection

### Alexa Not Responding
- Verify skill is enabled in Alexa app
- Check Lambda function logs
- Ensure device discovery returns endpoints

### High Memory Usage
- AWS IoT requires ~40KB RAM for TLS
- Use ESP32 with PSRAM for camera + AWS IoT
- Consider disabling other features if needed

## Documentation

- [Complete Setup Guide](./AWS_IOT_GATEWAY_SETUP.md)
- [AWS IoT Core Docs](https://docs.aws.amazon.com/iot/)
- [Alexa Smart Home API](https://developer.amazon.com/docs/smarthome/)

## Support

For issues or questions, see the troubleshooting section in the [setup guide](./AWS_IOT_GATEWAY_SETUP.md).

---

**Version:** 1.0.0  
**Last Updated:** 2026-06-17

Made with Bob