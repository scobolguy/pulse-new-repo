# ESP32 Printer/Scanner Controller with Alexa Integration

## Overview

This ESP32 node provides network control for printers and scanners that use port 9100 (raw TCP/IP printing) with full Alexa voice control integration through AWS IoT.

## Features

- **UPnP/SSDP Discovery**: Automatically discover all UPnP-enabled devices including printers and scanners
- **Network Device Discovery**: Scan network for printers and scanners on port 9100
- **Port 9100 Support**: Control any printer/scanner that supports raw TCP/IP printing (most network printers)
- **Alexa Voice Control**: Control printers and scanners using voice commands through Alexa
- **REST API**: Full HTTP API for device management and control
- **Status Monitoring**: Real-time device status tracking and health monitoring
- **Multiple Device Types**: Support for both printers and scanners
- **PCL/ESC/P Commands**: Send printer control commands
- **Scan Operations**: Initiate and control scanning operations

## Hardware Requirements

- ESP32 development board
- Network connection (WiFi)
- Network printers/scanners on the same network

## Software Requirements

- PlatformIO
- Arduino framework for ESP32
- Libraries (automatically installed):
  - ESP Async WebServer
  - ArduinoJson
  - PubSubClient (for AWS IoT)

## Build Configuration

### Build Environment

Use the `esp32_printer_scanner` environment in platformio.ini:

```bash
pio run -e esp32_printer_scanner
pio run -e esp32_printer_scanner -t upload
```

### Build Flags

The following flags are automatically set:
- `-DENABLE_PRINTER_SCANNER`: Enables printer/scanner service
- `-DENABLE_AWS_IOT`: Enables AWS IoT and Alexa integration
- `-DENABLE_PMACHINE`: Enables workflow automation

## Configuration

### Printer/Scanner Configuration File

Create `/config/printers.json` on the ESP32 filesystem:

```json
{
  "devices": [
    {
      "id": "printer-192-168-1-100",
      "name": "Office HP LaserJet",
      "ipAddress": "192.168.1.100",
      "port": 9100,
      "type": "printer",
      "model": "HP LaserJet Pro M404dn"
    },
    {
      "id": "scanner-192-168-1-102",
      "name": "Document Scanner",
      "ipAddress": "192.168.1.102",
      "port": 8610,
      "type": "scanner",
      "model": "Epson WorkForce"
    }
  ]
}
```

### AWS IoT Configuration

For Alexa integration, configure AWS IoT in `/config/aws-iot-config.json`:

```json
{
  "endpoint": "xxxxx.iot.us-east-1.amazonaws.com",
  "thingName": "ESP32-PrinterController",
  "clientId": "ESP32-PrinterController",
  "port": 8883,
  "rootCaPath": "/certs/root-ca.pem",
  "deviceCertPath": "/certs/device-cert.pem",
  "privateKeyPath": "/certs/private-key.pem",
  "alexaEnabled": true,
  "alexaSkillId": "amzn1.ask.skill.xxxxx"
}
```

## REST API Endpoints

### Device Management

#### List All Devices
```
GET /api/printers
```

Response:
```json
{
  "devices": [
    {
      "id": "printer-192-168-1-100",
      "name": "Office HP LaserJet",
      "ipAddress": "192.168.1.100",
      "port": 9100,
      "type": "printer",
      "online": true,
      "status": "idle",
      "lastSeen": 1234567890
    }
  ]
}
```

#### Get Device Info
```
GET /api/printers/{deviceId}
```

#### Add Device
```
POST /api/printers
Content-Type: application/json

{
  "id": "printer-192-168-1-100",
  "name": "Office Printer",
  "ipAddress": "192.168.1.100",
  "port": 9100,
  "type": "printer"
}
```

#### Remove Device
```
DELETE /api/printers/{deviceId}
```

#### Discover Devices (Port Scan)
```
POST /api/printers/discover
Content-Type: application/json

{
  "networkPrefix": "192.168.1"
}
```

#### Discover UPnP Devices
```
POST /api/printers/discover/upnp
```

Response:
```json
{
  "success": true,
  "message": "UPnP discovery completed",
  "devicesFound": 3,
  "devices": [
    {
      "usn": "uuid:12345678-1234-1234-1234-123456789abc::urn:schemas-upnp-org:device:Printer:1",
      "friendlyName": "HP LaserJet Pro M404dn",
      "manufacturer": "HP",
      "modelName": "LaserJet Pro M404dn",
      "ipAddress": "192.168.1.100",
      "port": 9100,
      "isPrinter": true,
      "isScanner": false
    }
  ]
}
```

#### List UPnP Devices
```
GET /api/printers/upnp
```

### Printer Operations

#### Print Text Document
```
POST /api/printers/{deviceId}/print
Content-Type: application/json

{
  "content": "Hello World!\nThis is a test print.",
  "type": "text"
}
```

#### Print Test Page
```
POST /api/printers/{deviceId}/test
```

#### Send PCL Command
```
POST /api/printers/{deviceId}/print
Content-Type: application/json

{
  "content": "\x1BE",
  "type": "pcl"
}
```

#### Cancel Print Job
```
POST /api/printers/{deviceId}/cancel
```

### Scanner Operations

#### Start Scan
```
POST /api/scanners/{deviceId}/scan

### Alexa Discovery

#### Get Alexa Discovery Response
```
GET /api/printers/alexa/discovery
```

Returns an Alexa-compatible discovery response including ALL devices (managed printers/scanners AND all discovered UPnP devices).

Response format (Alexa Discovery Response v3):
```json
{
  "event": {
    "header": {
      "namespace": "Alexa.Discovery",
      "name": "Discover.Response",
      "payloadVersion": "3",
      "messageId": "12345"
    },
    "payload": {
      "endpoints": [
        {
          "endpointId": "printer-192-168-1-100",
          "manufacturerName": "HP",
          "friendlyName": "Office HP LaserJet",
          "description": "printer at 192.168.1.100",
          "displayCategories": ["PRINTER"],
          "capabilities": [
            {
              "type": "AlexaInterface",
              "interface": "Alexa",
              "version": "3"
            },
            {
              "type": "AlexaInterface",
              "interface": "Alexa.PowerController",
              "version": "3"
            },
            {
              "type": "AlexaInterface",
              "interface": "Alexa.PrinterController",
              "version": "1",
              "configuration": {
                "supportedOperations": ["PrintTestPage", "CancelPrint", "GetPrinterStatus"]
              }
            }
          ]
        }
      ]
    }
  }
}
```

#### Get Device Capabilities
```
GET /api/printers/alexa/capabilities/{deviceId}
```

Returns the Alexa capabilities for a specific device (works for both managed devices and UPnP devices).

Content-Type: application/json

{
  "resolution": 300,
  "format": "PDF",
  "color": "COLOR"
}
```

#### Cancel Scan
```
POST /api/printers/{deviceId}/cancel
```

### Status Monitoring

#### Get Device Status
```
GET /api/printers/{deviceId}/status
```

Response:
```json
{
  "deviceId": "printer-192-168-1-100",
  "status": "idle",
  "timestamp": 1234567890
}
```

### Configuration

#### Save Configuration
```
POST /api/printers/config/save
```

#### Load Configuration
```
POST /api/printers/config/load
```

## Alexa Voice Commands

### Setup

1. Enable the Alexa Smart Home skill linked to your AWS IoT account
2. Discover devices: "Alexa, discover devices"
3. Devices will appear as "Office HP LaserJet", "Document Scanner", etc.

### Printer Commands

- "Alexa, turn on Office Printer" - Check if printer is online
- "Alexa, print test page on Office Printer" - Print a test page
- "Alexa, cancel print job on Office Printer" - Cancel current print job
- "Alexa, what's the status of Office Printer?" - Get printer status

### Scanner Commands

## Alexa Integration for ALL Devices

The ESP32 node automatically exposes ALL discovered devices to Alexa, not just printers and scanners!

### What Gets Exposed to Alexa

1. **Managed Devices** - Printers and scanners you manually add or that are discovered via port scanning
2. **ALL UPnP Devices** - Every device discovered via UPnP/SSDP including:
   - Printers
   - Scanners
   - Smart TVs
   - Media Servers
   - Media Renderers (Speakers, Chromecast, etc.)
   - Smart Home Devices
   - Routers
   - NAS devices
   - Any UPnP-enabled device

### Alexa Device Categories

Devices are automatically categorized for Alexa:

| Device Type | Alexa Category | Voice Commands |
|-------------|----------------|----------------|
| Printer | PRINTER | "Alexa, print test page on Office Printer" |
| Scanner | SCANNER | "Alexa, start scan on Document Scanner" |
| MediaServer | TV | "Alexa, turn on Media Server" |
| MediaRenderer | SPEAKER | "Alexa, turn on Living Room Speaker" |
| Other UPnP | OTHER | "Alexa, turn on [device name]" |

### Alexa Capabilities by Device

#### Printers
- **Alexa.PowerController** - Check online status
- **Alexa.PrinterController** - Print operations
  - PrintTestPage
  - CancelPrint
  - GetPrinterStatus
- **Alexa.EndpointHealth** - Connectivity status

#### Scanners
- **Alexa.PowerController** - Check online status
- **Alexa.ScannerController** - Scan operations
  - StartScan
  - CancelScan
  - GetScannerStatus
  - Supported formats: PDF, JPEG, PNG
- **Alexa.EndpointHealth** - Connectivity status

#### All Other UPnP Devices
- **Alexa.PowerController** - Basic on/off control
- **Alexa.EndpointHealth** - Connectivity status

### How to Use

1. **Discover UPnP Devices**
   ```bash
   curl -X POST http://esp32-ip/api/printers/discover/upnp
   ```

2. **Get Alexa Discovery Response**
   ```bash
   curl http://esp32-ip/api/printers/alexa/discovery
   ```
   This returns ALL devices in Alexa Discovery Response v3 format

3. **Say "Alexa, discover devices"**
   - Alexa will find all exposed devices
   - Devices appear in Alexa app
   - Control via voice commands

### Example: Controlling a Smart TV via Alexa

```bash
# 1. Discover UPnP devices (finds your Smart TV)
curl -X POST http://esp32-ip/api/printers/discover/upnp

# 2. Check what was found
curl http://esp32-ip/api/printers/upnp

# 3. Get Alexa discovery info
curl http://esp32-ip/api/printers/alexa/discovery

# 4. In Alexa app: "Discover devices"
# 5. Say: "Alexa, turn on Living Room TV"
```

### Supported Voice Commands

#### For Printers
- "Alexa, turn on Office Printer" (checks if online)
- "Alexa, print test page on Office Printer"
- "Alexa, cancel print job on Office Printer"
- "Alexa, what's the status of Office Printer?"

#### For Scanners
- "Alexa, turn on Document Scanner" (checks if online)
- "Alexa, start scan on Document Scanner"
- "Alexa, cancel scan on Document Scanner"

### Device Usefulness Guide

**VERY Useful (Need ESP32 Bridge):**
- ✅ **Network Printers** - No native Alexa support
- ✅ **Network Scanners** - No native Alexa support
- ✅ **Android TV Boxes** - Most don't have Alexa integration!
  - Nvidia Shield (older models)
  - Xiaomi Mi Box
  - Generic Android TV boxes
  - Kodi boxes
- ✅ **Media Servers** (Plex, Kodi, Jellyfin) - No native Alexa support
- ✅ **Older Smart TVs** - May not have Alexa integration
- ✅ **NAS Devices** (Synology, QNAP) - No native Alexa support
- ✅ **IP Cameras** - No native Alexa support
- ✅ **Legacy UPnP Devices** - Older devices without cloud integration
- ✅ **Chromecast** (1st/2nd gen) - Limited Alexa support

**Redundant (Already Alexa-Enabled):**
- ❌ **Fire TV Sticks** - Already have Alexa built-in
- ❌ **Fire TV Cube** - Already has Alexa built-in
- ❌ **Echo Devices** - Already are Alexa devices
- ❌ **Ring Doorbells** - Already integrate with Alexa
- ❌ **Smart Plugs** (TP-Link, Wemo, etc.) - Already have Alexa skills
- ❌ **Newer Chromecast with Google TV** - Has Google Assistant (use Google Home instead)

### Why This Still Discovers Everything

The ESP32 discovers ALL UPnP devices because:
1. **You might want local control** - No cloud dependency
2. **Unified interface** - Control everything through one system
3. **Custom automation** - Create workflows with all devices
4. **Offline operation** - Works without internet
5. **Privacy** - No data sent to device manufacturers

### Filtering Devices

You can filter out redundant devices by:
1. Not adding them to your Alexa account (just don't say "discover devices")
2. Removing them from the device list via API

### Android TV Box Example

Android TV boxes are perfect candidates for this ESP32 bridge because most don't have native Alexa support:

```bash
# 1. Discover your Android TV box via UPnP
curl -X POST http://esp32-ip/api/printers/discover/upnp

# 2. Check what was found
curl http://esp32-ip/api/printers/upnp
# Look for devices with "Android" or your box model name

# 3. Get Alexa discovery info
curl http://esp32-ip/api/printers/alexa/discovery

# 4. In Alexa app: "Discover devices"
# Your Android TV box will appear as a controllable device

# 5. Voice commands:
# "Alexa, turn on Living Room Android TV"
# "Alexa, turn off Living Room Android TV"
```

**What Works:**
- Power on/off (if box supports Wake-on-LAN or network standby)
- Status checking ("Is Android TV online?")
- Basic control through UPnP

**What Doesn't Work:**
- Content playback control (use Android TV's own voice remote)
- App launching (not supported via UPnP)
- Volume control (unless exposed via UPnP)

**Best Use Cases:**
- Turn on Android TV box before you get to the couch
- Check if box is online/responsive
- Power off box when leaving home
- Include in "Movie Night" Alexa routines

3. Modifying the code to skip certain device types

Example: Skip Fire TV devices in discovery:
```cpp
// In onUPnPDeviceDiscovered()
if (upnpDevice.friendlyName.indexOf("Fire TV") != -1) {
    Serial.println("Skipping Fire TV (already Alexa-enabled)");
    return;
}
```

- "Alexa, what's the status of Document Scanner?"

#### For Other UPnP Devices
- "Alexa, turn on [device name]"
- "Alexa, turn off [device name]"
- "Alexa, is [device name] online?"

### Integration with AWS IoT

When AWS IoT is enabled (`ENABLE_AWS_IOT`), the ESP32:
1. Connects to AWS IoT Core via MQTT
2. Registers all devices with Alexa Smart Home
3. Handles Alexa directives in real-time
4. Reports device state changes proactively
5. Maintains device health status

### Device Endpoint IDs

- **Managed devices**: Use configured ID (e.g., `printer-192-168-1-100`)
- **UPnP devices**: Auto-generated from USN (e.g., `upnp-uuid-12345678-...`)

All endpoint IDs are unique and persistent across reboots.


- "Alexa, turn on Document Scanner" - Check if scanner is online
- "Alexa, start scan on Document Scanner" - Start a scan operation
- "Alexa, cancel scan on Document Scanner" - Cancel current scan
- "Alexa, what's the status of Document Scanner?" - Get scanner status

## Alexa Smart Home Capabilities

The following Alexa capabilities are implemented:


## UPnP/SSDP Discovery

The service includes full UPnP (Universal Plug and Play) support using SSDP (Simple Service Discovery Protocol) for automatic device discovery.

### How UPnP Discovery Works

1. **Multicast Discovery**: Sends M-SEARCH requests to multicast address 239.255.255.250:1900
2. **Device Response**: UPnP devices respond with their location URL
3. **Description Fetch**: Retrieves detailed device information via HTTP
4. **Automatic Registration**: Printers and scanners are automatically added to the device list

### Supported UPnP Device Types

- `urn:schemas-upnp-org:device:Printer:1` - Basic printer
- `urn:schemas-upnp-org:device:Printer:2` - Enhanced printer
- `urn:schemas-upnp-org:device:Scanner:1` - Basic scanner
- `urn:schemas-upnp-org:device:Scanner:2` - Enhanced scanner
- `urn:schemas-upnp-org:device:MultiFunction:1` - Multifunction device (printer + scanner)

### UPnP Discovery Advantages

- **Automatic**: No need to know IP addresses
- **Fast**: Discovers devices in seconds
- **Comprehensive**: Gets manufacturer, model, serial number
- **Standards-Based**: Works with any UPnP-compliant device
- **All Devices**: Discovers ALL UPnP devices on network, not just printers

### UPnP vs Port Scanning

| Feature | UPnP Discovery | Port Scanning |
|---------|---------------|---------------|
| Speed | Fast (3-5 seconds) | Slow (2-5 minutes) |
| Device Info | Detailed (name, model, etc.) | Limited (IP only) |
| Network Load | Low | High |
| Accuracy | High | Medium |
| All Devices | Yes | Printers/scanners only |

### Using UPnP Discovery

```bash
# Discover all UPnP devices
curl -X POST http://esp32-ip/api/printers/discover/upnp

# List discovered UPnP devices
curl http://esp32-ip/api/printers/upnp
```

### UPnP Device Information

Each discovered UPnP device includes:
- **USN**: Unique Service Name (identifier)
- **Friendly Name**: Human-readable device name
- **Manufacturer**: Device manufacturer
- **Model Name**: Device model
- **Model Number**: Model number
- **Serial Number**: Device serial number
- **IP Address**: Network IP address
- **Port**: Service port
- **Device Type**: UPnP device type
- **Capabilities**: isPrinter, isScanner flags

### PrinterController
- `PrintTestPage`: Print a test page
- `CancelPrint`: Cancel current print job
- `GetPrinterStatus`: Query printer status

### ScannerController
- `StartScan`: Initiate a scan operation
- `CancelScan`: Cancel current scan
- `GetScannerStatus`: Query scanner status

### PowerController
- `TurnOn`: Check device online status
- `TurnOff`: Not supported (returns error)

### EndpointHealth
- Reports device connectivity status
- Proactive state change notifications

## Supported Printer Protocols

### Port 9100 (Raw TCP/IP)
- Most network printers support this protocol
- Direct socket printing
- No driver required on ESP32

### PCL (Printer Command Language)
- HP printers and compatibles
- Send PCL commands directly

### ESC/P (Epson Standard Code for Printers)
- Epson printers and compatibles
- Legacy dot matrix printer support

## Network Discovery

The service can automatically discover printers and scanners on your network:

1. Scans IP range (e.g., 192.168.1.1-254)
2. Probes port 9100 for printers
3. Probes port 8610 for SANE network scanners
4. Adds discovered devices automatically

Discovery can take several minutes for a full /24 network scan.

## Status Monitoring

The service automatically monitors device status every 30 seconds:

- **online**: Device is reachable on the network
- **offline**: Device is not responding
- **idle**: Device is ready for jobs
- **printing**: Printer is currently printing
- **scanning**: Scanner is currently scanning
- **error**: Device reported an error

## Troubleshooting

### Printer Not Discovered

1. Verify printer is on the same network
2. Check printer has port 9100 enabled
3. Verify firewall allows port 9100
4. Try manual device addition via API

### Print Job Not Working

1. Check device status via API
2. Verify printer supports raw TCP/IP printing
3. Try printing test page from printer's web interface
4. Check ESP32 serial output for errors

### Alexa Not Responding

1. Verify AWS IoT connection is active
2. Check Alexa skill is enabled
3. Rediscover devices in Alexa app
4. Check AWS IoT logs for errors

### Scanner Not Working

1. Verify scanner supports network scanning
2. Check port 8610 is open (SANE protocol)
3. Some scanners may use different ports
4. Consult scanner documentation

## Example Usage

### Python Script to Print

```python
import requests

# Print text document
response = requests.post(
    'http://esp32-ip/api/printers/printer-192-168-1-100/print',
    json={
        'content': 'Hello from Python!',
        'type': 'text'
    }
)
print(response.json())
```

### cURL Examples

```bash
# Discover devices
curl -X POST http://esp32-ip/api/printers/discover \
  -H "Content-Type: application/json" \
  -d '{"networkPrefix":"192.168.1"}'

# Print test page
curl -X POST http://esp32-ip/api/printers/printer-192-168-1-100/test

# Get device status
curl http://esp32-ip/api/printers/printer-192-168-1-100/status

# Start scan
curl -X POST http://esp32-ip/api/scanners/scanner-192-168-1-102/scan \
  -H "Content-Type: application/json" \
  -d '{"resolution":300,"format":"PDF","color":"COLOR"}'
```

## Architecture

### Components

1. **PrinterService**: Core service managing devices and operations
2. **printer_routes.cpp**: HTTP API endpoints
3. **printer_alexa_handlers.cpp**: Alexa Smart Home integration
4. **PrinterService.h**: Service interface and data structures

### Data Flow

```
Alexa Voice Command
    ↓
AWS IoT Core
    ↓
ESP32 (MQTT)
    ↓
Alexa Handler
    ↓
PrinterService
    ↓
Network Printer (Port 9100)
```

## Performance

- **Discovery**: ~2-5 minutes for /24 network
- **Print Job**: <1 second latency
- **Status Check**: <500ms per device
- **Alexa Response**: <2 seconds end-to-end

## Security Considerations

1. **Network Isolation**: Consider VLAN for printer network
2. **Firewall Rules**: Restrict port 9100 access
3. **AWS IoT**: Uses X.509 certificates for authentication
4. **No Authentication**: REST API has no built-in auth (add reverse proxy)

## Future Enhancements

- [ ] IPP (Internet Printing Protocol) support
- [ ] Print job queue management
- [ ] Printer capability detection
- [ ] Scan result retrieval
- [ ] Print job history
- [ ] Ink/toner level monitoring
- [ ] Multi-page document support
- [ ] PDF rendering for printing

## License

Made with Bob

## Support

For issues and questions, refer to the main project documentation.