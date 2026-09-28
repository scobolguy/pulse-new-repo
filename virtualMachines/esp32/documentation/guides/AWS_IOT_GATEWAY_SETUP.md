# AWS IoT Gateway Setup Guide

Complete guide for connecting ESP32 devices to AWS IoT Core, enabling Alexa Smart Home integration, and triggering WFL (Workflow) actions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [AWS IoT Core Setup](#aws-iot-core-setup)
4. [ESP32 Configuration](#esp32-configuration)
5. [Alexa Smart Home Integration](#alexa-smart-home-integration)
6. [WFL Workflow Integration](#wfl-workflow-integration)
7. [Testing and Troubleshooting](#testing-and-troubleshooting)
8. [Security Best Practices](#security-best-practices)

---

## Overview

This integration enables:

- **Secure MQTT connection** to AWS IoT Core using X.509 certificates
- **Alexa Smart Home** voice control for ESP32 devices
- **WFL workflow triggers** from sensor events and Alexa commands
- **Device Shadow** for state synchronization
- **Proactive state reporting** to Alexa

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Alexa     │◄────────┤  AWS IoT     │◄────────┤   ESP32     │
│   Service   │         │   Core       │         │   Device    │
└─────────────┘         └──────────────┘         └─────────────┘
                              │                         │
                              │                         │
                              ▼                         ▼
                        ┌──────────────┐         ┌─────────────┐
                        │  Lambda      │         │  WFL        │
                        │  Functions   │         │  Broker     │
                        └──────────────┘         └─────────────┘
```

---

## Prerequisites

### Hardware
- ESP32 development board (ESP32, ESP32-S3, or ESP32-C3)
- USB cable for programming
- Sensors/actuators (optional: relay, temperature sensor, etc.)

### Software
- [PlatformIO](https://platformio.org/) or Arduino IDE
- [AWS CLI](https://aws.amazon.com/cli/) v2.x
- [Python 3.x](https://www.python.org/) with esptool
- PowerShell 5.1+ (Windows) or Bash (Linux/Mac)

### AWS Account
- Active AWS account with IoT Core access
- IAM user with permissions:
  - `iot:*`
  - `lambda:*` (for Alexa integration)
  - `logs:*` (for CloudWatch)

---

## AWS IoT Core Setup

### Step 1: Create IoT Thing

Run the automated setup script:

```powershell
# Windows PowerShell
.\scripts\setup-aws-iot-certs.ps1 -ThingName "esp32-device-01" -CreateNew -Region "us-east-1"
```

Or manually via AWS CLI:

```bash
# Create Thing
aws iot create-thing --thing-name esp32-device-01

# Create certificate
aws iot create-keys-and-certificate \
  --set-as-active \
  --certificate-pem-outfile certs/device-certificate.pem.crt \
  --public-key-outfile certs/public.pem.key \
  --private-key-outfile certs/private.pem.key
```

### Step 2: Create IoT Policy

Create a policy file `iot-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:us-east-1:*:client/esp32-device-01"
    },
    {
      "Effect": "Allow",
      "Action": ["iot:Publish", "iot:Receive"],
      "Resource": [
        "arn:aws:iot:us-east-1:*:topic/$aws/things/esp32-device-01/*",
        "arn:aws:iot:us-east-1:*:topic/alexa/*",
        "arn:aws:iot:us-east-1:*:topic/wfl/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": [
        "arn:aws:iot:us-east-1:*:topicfilter/$aws/things/esp32-device-01/*",
        "arn:aws:iot:us-east-1:*:topicfilter/alexa/*",
        "arn:aws:iot:us-east-1:*:topicfilter/wfl/*"
      ]
    }
  ]
}
```

Apply the policy:

```bash
aws iot create-policy --policy-name esp32-device-01-Policy --policy-document file://iot-policy.json
aws iot attach-policy --policy-name esp32-device-01-Policy --target <certificate-arn>
```

### Step 3: Get IoT Endpoint

```bash
aws iot describe-endpoint --endpoint-type iot:Data-ATS
```

Save the endpoint URL (e.g., `xxxxx.iot.us-east-1.amazonaws.com`).

---

## ESP32 Configuration

### Step 1: Install Dependencies

Add to `platformio.ini`:

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

lib_deps =
    bblanchon/ArduinoJson@^6.21.0
    knolleary/PubSubClient@^2.8
    lorol/LittleFS_esp32@^1.0.6
```

### Step 2: Upload Certificates

1. Create `data/certs/` directory in your project
2. Copy certificates:
   - `AmazonRootCA1.pem`
   - `device-certificate.pem.crt`
   - `private.pem.key`

3. Upload filesystem:
```bash
pio run --target uploadfs
```

### Step 3: Configure Device

Edit `config/aws-iot-config.json`:

```json
{
  "version": "1.0.0",
  "aws": {
    "iot": {
      "endpoint": "xxxxx.iot.us-east-1.amazonaws.com",
      "region": "us-east-1",
      "thingName": "esp32-device-01",
      "clientId": "esp32-device-01",
      "port": 8883,
      "certificates": {
        "rootCa": "/certs/AmazonRootCA1.pem",
        "deviceCert": "/certs/device-certificate.pem.crt",
        "privateKey": "/certs/private.pem.key"
      }
    },
    "alexa": {
      "enabled": true,
      "skillId": "amzn1.ask.skill.YOUR-SKILL-ID"
    },
    "wfl": {
      "enabled": true,
      "brokerUrl": "http://your-backend-server:5000"
    }
  }
}
```

### Step 4: Initialize in Code

Add to your `main.cpp`:

```cpp
#include "aws_iot_client.h"
#include "alexa_handlers.cpp"
#include "wfl_handlers.cpp"

AwsIotClient* globalAwsIotClient = nullptr;

void setup() {
    Serial.begin(115200);
    
    // Initialize WiFi
    WiFi.begin("YOUR_SSID", "YOUR_PASSWORD");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected");
    
    // Initialize LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS mount failed");
        return;
    }
    
    // Initialize AWS IoT client
    globalAwsIotClient = new AwsIotClient();
    
    AwsIotConfig config;
    config.endpoint = "xxxxx.iot.us-east-1.amazonaws.com";
    config.thingName = "esp32-device-01";
    config.rootCaPath = "/certs/AmazonRootCA1.pem";
    config.deviceCertPath = "/certs/device-certificate.pem.crt";
    config.privateKeyPath = "/certs/private.pem.key";
    config.alexaEnabled = true;
    config.wflEnabled = true;
    
    if (globalAwsIotClient->initialize(config)) {
        Serial.println("AWS IoT initialized");
        
        if (globalAwsIotClient->connect()) {
            Serial.println("Connected to AWS IoT Core");
            
            // Register handlers
            registerAlexaHandlers();
            registerWflHandlers();
        }
    }
}

void loop() {
    if (globalAwsIotClient) {
        globalAwsIotClient->update();
    }
    delay(10);
}
```

---

## Alexa Smart Home Integration

### Step 1: Create Alexa Smart Home Skill

1. Go to [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask)
2. Click "Create Skill"
3. Choose "Smart Home" model
4. Select "Provision your own" backend

### Step 2: Create Lambda Function

Create `lambda_function.py`:

```python
import json
import boto3

iot_client = boto3.client('iot-data')

def lambda_handler(event, context):
    directive = event['directive']
    endpoint_id = directive['endpoint']['endpointId']
    
    # Forward directive to IoT device
    topic = f'$aws/things/{endpoint_id}/alexa/directive'
    
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(directive)
    )
    
    # Return response
    return {
        'event': {
            'header': {
                'namespace': 'Alexa',
                'name': 'Response',
                'messageId': directive['header']['messageId'],
                'correlationToken': directive['header']['correlationToken'],
                'payloadVersion': '3'
            },
            'endpoint': {
                'endpointId': endpoint_id
            },
            'payload': {}
        }
    }
```

### Step 3: Configure Skill Endpoints

In Alexa Developer Console:
- Set Lambda ARN as skill endpoint
- Enable account linking (optional)
- Add device discovery endpoint

### Step 4: Test with Alexa

```
"Alexa, turn on smart relay"
"Alexa, what's the temperature?"
"Alexa, set brightness to 50%"
```

---

## WFL Workflow Integration

### Step 1: Define Workflows

Create workflow definitions in `config/aws-iot-config.json`:

```json
{
  "wfl": {
    "workflows": [
      {
        "id": "motion-detected-workflow",
        "name": "Motion Detection Handler",
        "trigger": {
          "type": "sensor",
          "sensorId": "motion_sensor_1",
          "condition": "value == true"
        },
        "actions": [
          {
            "type": "alexa-notification",
            "message": "Motion detected"
          },
          {
            "type": "device-control",
            "deviceId": "esp32-relay-01",
            "action": "turnOn"
          }
        ]
      }
    ]
  }
}
```

### Step 2: Trigger Workflows from Sensors

```cpp
void onMotionDetected() {
    if (globalAwsIotClient) {
        JsonDocument params;
        params["location"] = "Living Room";
        params["timestamp"] = millis();
        
        globalAwsIotClient->triggerWflWorkflow(
            "motion-detected-workflow",
            params
        );
    }
}
```

### Step 3: Handle Workflow Results

```cpp
void handleWflResult(const WflActionRequest& request, 
                     bool success, 
                     const JsonDocument& result) {
    Serial.printf("Workflow %s completed: %s\n",
                  request.workflowId.c_str(),
                  success ? "SUCCESS" : "FAILED");
}
```

---

## Testing and Troubleshooting

### Test MQTT Connection

```bash
# Subscribe to test topic
aws iot-data publish \
  --topic '$aws/things/esp32-device-01/test' \
  --payload '{"message":"Hello from AWS"}' \
  --cli-binary-format raw-in-base64-out
```

### Monitor Device Logs

```cpp
// Enable verbose logging
Serial.setDebugOutput(true);
```

### Common Issues

#### Connection Failed
- Verify certificates are uploaded correctly
- Check IoT endpoint URL
- Ensure policy allows connection

#### Alexa Not Responding
- Verify skill is enabled in Alexa app
- Check Lambda function logs in CloudWatch
- Ensure device discovery returns endpoints

#### WFL Not Triggering
- Check broker URL is accessible
- Verify workflow definitions are valid
- Monitor AWS IoT Core logs

### Debug Commands

```bash
# Test certificate
openssl x509 -in device-certificate.pem.crt -text -noout

# Monitor IoT Core logs
aws logs tail /aws/iot/things/esp32-device-01 --follow

# Test Lambda function
aws lambda invoke --function-name AlexaSmartHomeSkill response.json
```

---

## Security Best Practices

### Certificate Management
- Store certificates securely in LittleFS
- Never commit certificates to version control
- Rotate certificates annually
- Use separate certificates per device

### Network Security
- Use TLS 1.2 or higher
- Verify server certificates
- Enable hostname verification
- Use strong cipher suites

### Access Control
- Follow principle of least privilege
- Use specific IoT policies per device
- Enable CloudWatch logging
- Monitor for unusual activity

### Code Security
```cpp
// Don't hardcode credentials
// ❌ Bad
const char* password = "mypassword123";

// ✅ Good - Load from secure storage
String password = loadFromSecureStorage("/config/password");
```

---

## Additional Resources

- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [Alexa Smart Home API](https://developer.amazon.com/docs/smarthome/understand-the-smart-home-skill-api.html)
- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [PubSubClient Library](https://github.com/knolleary/pubsubclient)

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review AWS IoT Core logs
3. Enable debug logging on ESP32
4. Open an issue on GitHub

---

**Last Updated:** 2026-06-17  
**Version:** 1.0.0

Made with Bob